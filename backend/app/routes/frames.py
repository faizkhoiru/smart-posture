import datetime
import logging
import time
from collections import deque
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import async_session_maker, get_db
from app.models import CalibrationProfile, Device, DeviceConfig, PostureEvent
from app.mqtt_client import broadcast_device_state, get_or_create_runtime_state
from app.pose import analyze
from app.posture_logic import decide
from app.routes.calibration import record_recent_pose
from app.ws_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/devices", tags=["frames"])

# Rate limit tracking per device: device_id -> deque of timestamps (seconds)
_device_request_timestamps: dict[str, deque[float]] = {}


def check_rate_limit(device_id: str, max_fps: int) -> bool:
    """Sliding window rate limit in-memory per device."""
    now = time.time()
    if device_id not in _device_request_timestamps:
        _device_request_timestamps[device_id] = deque()

    timestamps = _device_request_timestamps[device_id]
    while timestamps and now - timestamps[0] > 1.0:
        timestamps.popleft()

    if len(timestamps) >= max_fps:
        return False

    timestamps.append(now)
    return True


async def process_frame_background(device_id: str, jpeg_bytes: bytes) -> None:
    t_start = time.monotonic()
    now_utc = datetime.datetime.now(datetime.UTC)

    # 1. Debug frame saving jika DEBUG_SAVE_FRAMES diaktifkan
    if settings.DEBUG_SAVE_FRAMES:
        debug_dir = Path("/tmp/debug_frames") / device_id
        try:
            debug_dir.mkdir(parents=True, exist_ok=True)
            timestamp_str = int(time.time() * 1000)
            file_path = debug_dir / f"frame_{timestamp_str}.jpg"
            file_path.write_bytes(jpeg_bytes)
            logger.warning("DEBUG_SAVE_FRAMES aktif — gambar tersimpan ke disk: %s", file_path)
        except Exception as e:
            logger.error("Failed to save debug frame: %s", e)

    # 2. Pose estimation
    t_pose_start = time.monotonic()
    pose_result = await analyze(jpeg_bytes)
    pose_latency = (time.monotonic() - t_pose_start) * 1000
    record_recent_pose(device_id, pose_result)

    rt = get_or_create_runtime_state(device_id)

    # Cek jika inferensi gagal total
    if not pose_result.ok:
        rt.analysis = "analysis_unavailable"
        await broadcast_device_state(device_id)
        return
    else:
        if rt.analysis != "ok":
            rt.analysis = "ok"

    # 3. Ambil Config & CalibrationProfile dari DB untuk evaluasi posture
    async with async_session_maker() as session:
        cfg_res = await session.execute(
            select(DeviceConfig).where(DeviceConfig.device_id == device_id)
        )
        cfg = cfg_res.scalars().first()

        prof_res = await session.execute(
            select(CalibrationProfile)
            .where(CalibrationProfile.device_id == device_id)
            .order_by(desc(CalibrationProfile.calibrated_at))
        )
        profile = prof_res.scalars().first()

        # 4. Evaluasi Posture
        decision = decide(
            pose=pose_result,
            profile=profile,
            config=cfg or settings,
            state=rt.posture_internal,
            now=now_utc,
        )

        # Update state internal dan status
        rt.posture_internal = decision.new_state
        prev_status = rt.posture
        rt.posture = decision.status
        rt.updated_at = now_utc

        # 5. Simpan PostureEvent ke DB
        kp_dicts = [kp.to_dict() for kp in pose_result.keypoints]
        posture_event = PostureEvent(
            device_id=device_id,
            timestamp=now_utc,
            status=decision.status,
            confidence=pose_result.confidence,
            keypoints=kp_dicts,
            durasi=0,  # placeholder
            acknowledged_at=None,
        )
        session.add(posture_event)
        await session.commit()
        await session.refresh(posture_event)

        # 6. Broadcast pose message via ws_manager
        pose_msg = {
            "type": "pose",
            "timestamp": now_utc.isoformat(),
            "confidence": pose_result.confidence,
            "keypoints": kp_dicts,
        }
        await ws_manager.broadcast(device_id, pose_msg)
        elapsed_total = (time.monotonic() - t_start) * 1000
        logger.info(
            f"[PERF] frame->WS latency: {elapsed_total:.1f}ms (pose: {pose_latency:.1f}ms) device={device_id}"
        )

        # 7. Jika status postur berubah, broadcast pesan state
        if prev_status != decision.status:
            await broadcast_device_state(device_id)

        # 8. Jika bad_posture baru muncul
        if decision.status == "bad_posture" and prev_status != "bad_posture":
            alert_msg = {
                "type": "alert",
                "event_id": posture_event.id,
                "level": "bad_posture",
                "message": "Postur Anda mulai membungkuk. Silakan tegakkan tubuh secara perlahan agar lebih nyaman.",
                "remind_interval_s": cfg.remind_interval if cfg else settings.REMIND_INTERVAL_S,
                "timestamp": now_utc.isoformat(),
            }
            await ws_manager.broadcast(device_id, alert_msg)

        # 9. Jika pulih (alert_clear=True)
        if decision.alert_clear:
            clear_msg = {
                "type": "alert_clear",
                "timestamp": now_utc.isoformat(),
            }
            await ws_manager.broadcast(device_id, clear_msg)


@router.post("/{device_id}/frames", status_code=status.HTTP_202_ACCEPTED)
async def upload_frame(
    device_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    x_device_key: str | None = Header(None, alias="X-Device-Key"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    if not x_device_key or x_device_key != settings.DEVICE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "unauthorized", "message": "Kunci perangkat tidak valid"}},
        )

    content_type = request.headers.get("content-type", "")
    body_bytes = b""

    if "multipart/form-data" in content_type:
        form = await request.form()
        image_upload = form.get("image")
        if not image_upload or not hasattr(image_upload, "read"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": {"code": "invalid_frame", "message": "Frame image tidak ditemukan"}},
            )
        if image_upload.content_type != "image/jpeg":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": {"code": "invalid_format", "message": "Format harus image/jpeg"}},
            )
        body_bytes = await image_upload.read()
    elif "image/jpeg" in content_type:
        body_bytes = await request.body()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "invalid_format", "message": "Content-Type harus image/jpeg"}},
        )

    if len(body_bytes) > settings.MAX_FRAME_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "payload_too_large", "message": "Ukuran gambar melebihi batas"}},
        )

    device_res = await db.execute(select(Device).where(Device.id == device_id))
    device = device_res.scalars().first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "device_not_found", "message": "Perangkat tidak ditemukan"}},
        )

    if not check_rate_limit(device_id, settings.MAX_FPS_PER_DEVICE):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": {"code": "rate_limited", "message": "Melebihi batas frame per detik"}},
        )

    rt = get_or_create_runtime_state(device_id)
    if rt.chair != "occupied":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "chair_not_occupied", "message": "Kursi tidak dalam status occupied"}},
        )

    background_tasks.add_task(process_frame_background, device_id, body_bytes)
    return {"accepted": True}
