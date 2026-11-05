import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Device, DeviceConfig, PostureEvent, SittingSession
from app.mqtt_client import broadcast_device_state, get_or_create_runtime_state, mqtt_service
from app.schemas import (
    DeviceLatestStateSchema,
    DeviceSummarySchema,
    LoadInfoSchema,
    MqttConfigSetPayload,
    UniformErrorResponse,
)
from app.ws_manager import ws_manager

router = APIRouter(tags=["devices"])


# WebSocket Endpoint
@router.websocket("/ws/devices/{device_id}")
async def websocket_device_endpoint(websocket: WebSocket, device_id: str) -> None:
    await ws_manager.connect(device_id, websocket)

    # Kirim state terbaru saat pertama connect
    last_state = ws_manager.get_last_state(device_id)
    if not last_state:
        rt = get_or_create_runtime_state(device_id)
        last_state = rt.to_ws_state_dict()

    try:
        await websocket.send_json(last_state)
    except Exception:
        pass

    try:
        # Loop hanya mendengarkan sampai client disconnect
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        await ws_manager.disconnect(device_id, websocket)


# REST Endpoints
@router.get("/api/devices", response_model=list[DeviceSummarySchema])
async def get_devices(db: AsyncSession = Depends(get_db)) -> list[DeviceSummarySchema]:
    result = await db.execute(select(Device))
    devices = result.scalars().all()

    return [
        DeviceSummarySchema(
            id=d.id,
            name=d.name,
            status=d.status,  # type: ignore
            last_seen=d.last_seen.isoformat() if d.last_seen else None,
        )
        for d in devices
    ]


@router.get(
    "/api/devices/{device_id}/latest",
    response_model=DeviceLatestStateSchema,
    responses={404: {"model": UniformErrorResponse}},
)
async def get_device_latest(
    device_id: str,
    db: AsyncSession = Depends(get_db),
) -> DeviceLatestStateSchema | JSONResponse:
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalars().first()

    if not device:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": {
                    "code": "device_not_found",
                    "message": "Perangkat tidak ditemukan",
                }
            },
        )

    rt = get_or_create_runtime_state(device_id)

    updated_at_str = (
        rt.updated_at.isoformat()
        if rt.updated_at
        else (device.last_seen.isoformat() if device.last_seen else datetime.datetime.now(datetime.UTC).isoformat())
    )

    return DeviceLatestStateSchema(
        chair=rt.chair,  # type: ignore
        posture=rt.posture,  # type: ignore
        camera=rt.camera,  # type: ignore
        device=device.status,  # type: ignore
        load=LoadInfoSchema(
            kg=rt.load_kg,
            is_estimate=rt.load_is_estimate,
        ),
        updated_at=updated_at_str,
    )


@router.get("/api/devices/{device_id}/sessions")
async def get_device_sessions(
    device_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    query = (
        select(SittingSession)
        .where(SittingSession.device_id == device_id)
        .order_by(desc(SittingSession.started_at))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    sessions = result.scalars().all()

    return [
        {
            "id": s.id,
            "device_id": s.device_id,
            "started_at": s.started_at.isoformat(),
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "total_sit_s": s.total_sit_s,
            "good_s": s.good_s,
            "bad_s": s.bad_s,
            "alert_count": s.alert_count,
        }
        for s in sessions
    ]


@router.get("/api/devices/{device_id}/events")
async def get_device_events(
    device_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    query = select(PostureEvent).where(PostureEvent.device_id == device_id)
    if status_filter:
        query = query.where(PostureEvent.status == status_filter)

    query = query.order_by(desc(PostureEvent.timestamp)).offset(offset).limit(limit)
    result = await db.execute(query)
    events = result.scalars().all()

    return [
        {
            "id": e.id,
            "device_id": e.device_id,
            "timestamp": e.timestamp.isoformat(),
            "status": e.status,
            "confidence": e.confidence,
            "keypoints": e.keypoints or [],
            "durasi": e.durasi,
            "acknowledged_at": e.acknowledged_at.isoformat() if e.acknowledged_at else None,
        }
        for e in events
    ]


class DeviceConfigUpdate(BaseModel):
    occupied_threshold: float | None = None
    release_threshold: float | None = None
    debounce_ms: int | None = None
    capture_interval_ms: int | None = None
    min_visibility: float | None = None
    tolerance_seconds: int | None = None
    warning_min_frames: int | None = None
    remind_interval: int | None = None
    view_mode: str | None = None
    camera_state: str | None = None


@router.put("/api/devices/{device_id}/config")
async def update_device_config(
    device_id: str,
    body: DeviceConfigUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    dev_res = await db.execute(select(Device).where(Device.id == device_id))
    dev = dev_res.scalars().first()
    if not dev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "device_not_found", "message": "Perangkat tidak ditemukan"}},
        )

    cfg_res = await db.execute(select(DeviceConfig).where(DeviceConfig.device_id == device_id))
    cfg = cfg_res.scalars().first()
    if not cfg:
        cfg = DeviceConfig(device_id=device_id)
        db.add(cfg)

    # Update field yang diberikan
    update_data = body.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        if v is not None:
            setattr(cfg, k, v)

    await db.commit()
    await db.refresh(cfg)

    # Publish ke MQTT config/set
    hw_config = MqttConfigSetPayload(
        occupied_threshold=cfg.occupied_threshold,
        release_threshold=cfg.release_threshold,
        debounce_ms=cfg.debounce_ms,
        capture_interval_ms=cfg.capture_interval_ms,
    )
    mqtt_service.publish_config_set(device_id, hw_config)

    return {
        "occupied_threshold": cfg.occupied_threshold,
        "release_threshold": cfg.release_threshold,
        "debounce_ms": cfg.debounce_ms,
        "capture_interval_ms": cfg.capture_interval_ms,
        "min_visibility": cfg.min_visibility,
        "tolerance_seconds": cfg.tolerance_seconds,
        "warning_min_frames": cfg.warning_min_frames,
        "remind_interval": cfg.remind_interval,
        "view_mode": cfg.view_mode,
        "camera_state": cfg.camera_state,
    }


class AckAlertBody(BaseModel):
    event_id: int


@router.post("/api/devices/{device_id}/alerts/ack")
async def ack_alert(
    device_id: str,
    body: AckAlertBody,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    ev_res = await db.execute(
        select(PostureEvent).where(
            PostureEvent.id == body.event_id,
            PostureEvent.device_id == device_id,
        )
    )
    event = ev_res.scalars().first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "event_not_found", "message": "Event tidak ditemukan"}},
        )

    event.acknowledged_at = datetime.datetime.now(datetime.UTC)
    await db.commit()
    return {"ok": True}


class MuteAlertBody(BaseModel):
    minutes: int


@router.post("/api/devices/{device_id}/alerts/mute")
async def mute_alert(
    device_id: str,
    body: MuteAlertBody,
) -> dict[str, str]:
    rt = get_or_create_runtime_state(device_id)
    muted_until = datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=body.minutes)
    rt.muted_until = muted_until
    rt.updated_at = datetime.datetime.now(datetime.UTC)

    await broadcast_device_state(device_id)
    return {"muted_until": muted_until.isoformat()}
