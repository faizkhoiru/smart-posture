import datetime
import logging
from collections import deque
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models import CalibrationProfile, Device, LoadCellReading
from app.pose import PoseResult
from app.posture_logic import compute_features

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/devices", tags=["calibration"])

# In-memory buffer untuk pose valid terbaru per device (maksimal 30 frame)
# device_id -> deque[PoseResult]
device_recent_poses: dict[str, deque[PoseResult]] = {}


def record_recent_pose(device_id: str, pose: PoseResult) -> None:
    if device_id not in device_recent_poses:
        device_recent_poses[device_id] = deque(maxlen=30)
    device_recent_poses[device_id].append(pose)


class CalibrateLoadBody(BaseModel):
    step: str  # "empty" | "occupied"
    known_weight_kg: float | None = None


class CalibratePostureBody(BaseModel):
    frames: int = 15


@router.post("/{device_id}/calibrate/load")
async def calibrate_load(
    device_id: str,
    body: CalibrateLoadBody,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    # 1. Pastikan device terdaftar
    dev_res = await db.execute(select(Device).where(Device.id == device_id))
    dev = dev_res.scalars().first()
    if not dev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "device_not_found", "message": "Perangkat tidak ditemukan"}},
        )

    # 2. Ambil atau buat CalibrationProfile
    prof_res = await db.execute(
        select(CalibrationProfile)
        .where(CalibrationProfile.device_id == device_id)
        .order_by(desc(CalibrationProfile.calibrated_at))
    )
    profile = prof_res.scalars().first()
    now_utc = datetime.datetime.now(datetime.UTC)

    if not profile:
        profile = CalibrationProfile(
            device_id=device_id,
            tare=None,
            scale=None,
            baseline=None,
            calibrated_at=now_utc,
        )
        db.add(profile)

    # 3. Ambil 5 pembacaan terbaru dari DB
    readings_res = await db.execute(
        select(LoadCellReading)
        .where(LoadCellReading.device_id == device_id)
        .order_by(desc(LoadCellReading.timestamp))
        .limit(5)
    )
    readings = readings_res.scalars().all()

    if body.step == "empty":
        # Ambil rata-rata 5 pembacaan load cell terbaru dari DB sebagai tare
        if readings:
            raw_sums = [
                (r.load_left_raw or 0) + (r.load_right_raw or 0)
                for r in readings
                if r.load_left_raw is not None and r.load_right_raw is not None
            ]
            avg_raw = sum(raw_sums) / len(raw_sums) if raw_sums else 0.0
            profile.tare = round(avg_raw, 2)
        else:
            profile.tare = 0.0

        profile.calibrated_at = now_utc
        await db.commit()
        await db.refresh(profile)

        return {
            "ok": True,
            "profile": {
                "tare": profile.tare,
                "scale": profile.scale,
                "calibrated_at": profile.calibrated_at.isoformat(),
            },
        }

    elif body.step == "occupied":
        # Hitung scale dari known_weight_kg jika ada
        tare = profile.tare or 0.0
        if readings and body.known_weight_kg and body.known_weight_kg > 0:
            raw_sums = [
                (r.load_left_raw or 0) + (r.load_right_raw or 0)
                for r in readings
                if r.load_left_raw is not None and r.load_right_raw is not None
            ]
            avg_raw = sum(raw_sums) / len(raw_sums) if raw_sums else tare
            net_raw = abs(avg_raw - tare)
            # scale = net_raw / known_weight
            profile.scale = round(net_raw / body.known_weight_kg, 2) if net_raw > 0 else 1.0
        else:
            if profile.scale is None:
                profile.scale = 1000.0  # default estimasi scale

        profile.calibrated_at = now_utc
        await db.commit()
        await db.refresh(profile)

        return {
            "ok": True,
            "profile": {
                "tare": profile.tare,
                "scale": profile.scale,
                "calibrated_at": profile.calibrated_at.isoformat(),
            },
        }

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "invalid_step", "message": "Step harus 'empty' atau 'occupied'"}},
        )


@router.post("/{device_id}/calibrate/posture")
async def calibrate_posture(
    device_id: str,
    body: CalibratePostureBody,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    dev_res = await db.execute(select(Device).where(Device.id == device_id))
    dev = dev_res.scalars().first()
    if not dev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "device_not_found", "message": "Perangkat tidak ditemukan"}},
        )

    # Ambil frame dari antrean buffer in-memory
    recent = list(device_recent_poses.get(device_id, deque()))
    target_count = max(1, body.frames)
    candidates = recent[-target_count:] if recent else []

    # Filter frame yang ok=True dan confidence >= MIN_VISIBILITY
    min_vis = settings.MIN_VISIBILITY
    valid_frames = [p for p in candidates if p.ok and p.confidence >= min_vis]

    warnings: list[str] = []
    if len(valid_frames) < (target_count / 2):
        warnings.append("Frame valid tidak cukup, kalibrasi mungkin tidak akurat")

    baseline: dict[str, float] = {}
    if valid_frames:
        computed_list: list[dict[str, float]] = []
        for p in valid_frames:
            kp_dict = {kp.name: kp for kp in p.keypoints}
            feats = compute_features(kp_dict, settings.VIEW_MODE)
            computed_list.append(feats)

        # Hitung rata-rata setiap fitur
        all_keys = set().union(*(d.keys() for d in computed_list))
        for k in all_keys:
            vals = [d[k] for d in computed_list if k in d]
            if vals:
                baseline[k] = round(sum(vals) / len(vals), 4)

        # Tipe frontend di pwa/src/types/api.ts:
        # baseline: { side_angle?, head_offset?, shoulder_slope?, ear_shoulder_ratio? }
        if "ear_shoulder_hip_angle" in baseline:
            baseline["side_angle"] = baseline["ear_shoulder_hip_angle"]
    else:
        # Default fallback baseline jika tidak ada frame
        if settings.VIEW_MODE == "side":
            baseline = {"side_angle": 165.0, "head_offset": 0.05}
        else:
            baseline = {"ear_shoulder_ratio": 0.5, "shoulder_slope": 0.0}

    # Simpan ke CalibrationProfile
    now_utc = datetime.datetime.now(datetime.UTC)
    prof_res = await db.execute(
        select(CalibrationProfile)
        .where(CalibrationProfile.device_id == device_id)
        .order_by(desc(CalibrationProfile.calibrated_at))
    )
    profile = prof_res.scalars().first()
    if not profile:
        profile = CalibrationProfile(
            device_id=device_id,
            tare=None,
            scale=None,
            baseline=baseline,
            calibrated_at=now_utc,
        )
        db.add(profile)
    else:
        profile.baseline = baseline
        profile.calibrated_at = now_utc

    await db.commit()
    await db.refresh(profile)

    return {
        "ok": True,
        "baseline": baseline,
        "warnings": warnings,
    }
