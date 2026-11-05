import datetime
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Device, PostureEvent, SittingSession

logger = logging.getLogger(__name__)


def ensure_utc(dt: datetime.datetime | None) -> datetime.datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.UTC)
    return dt.astimezone(datetime.UTC)


async def start_session(
    db: AsyncSession,
    device_id: str,
    timestamp: datetime.datetime,
) -> SittingSession:
    timestamp = ensure_utc(timestamp) or datetime.datetime.now(datetime.UTC)
    # Cek apakah sudah ada sesi yang masih aktif (ended_at is None)
    query = (
        select(SittingSession)
        .where(
            SittingSession.device_id == device_id,
            SittingSession.ended_at.is_(None),
        )
        .order_by(SittingSession.started_at.desc())
    )
    result = await db.execute(query)
    active_session = result.scalars().first()

    if active_session:
        logger.info("Session already active for device %s (id: %s)", device_id, active_session.id)
        return active_session

    new_session = SittingSession(
        device_id=device_id,
        started_at=timestamp,
        ended_at=None,
        total_sit_s=0,
        good_s=0,
        bad_s=0,
        alert_count=0,
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    logger.info("Started sitting session %s for device %s", new_session.id, device_id)
    return new_session


async def close_session(
    db: AsyncSession,
    device_id: str,
    timestamp: datetime.datetime,
) -> SittingSession | None:
    timestamp = ensure_utc(timestamp) or datetime.datetime.now(datetime.UTC)
    query = (
        select(SittingSession)
        .where(
            SittingSession.device_id == device_id,
            SittingSession.ended_at.is_(None),
        )
        .order_by(SittingSession.started_at.desc())
    )
    result = await db.execute(query)
    active_session = result.scalars().first()

    if not active_session:
        logger.info("No active session to close for device %s", device_id)
        return None

    started_at_utc = ensure_utc(active_session.started_at) or timestamp
    # Pastikan timestamp penutupan tidak lebih awal dari timestamp mulai
    ended_at = timestamp if timestamp >= started_at_utc else started_at_utc
    total_seconds = int((ended_at - started_at_utc).total_seconds())

    # Hitung good_s, bad_s, alert_count dari PostureEvent yang terjadi selama rentang sesi
    events_query = (
        select(PostureEvent)
        .where(
            PostureEvent.device_id == device_id,
            PostureEvent.timestamp >= started_at_utc,
            PostureEvent.timestamp <= ended_at,
        )
        .order_by(PostureEvent.timestamp.asc())
    )
    events_result = await db.execute(events_query)
    events = events_result.scalars().all()

    good_s = 0
    bad_s = 0
    alert_count = 0

    for ev in events:
        if ev.status == "good_posture":
            good_s += ev.durasi
        elif ev.status == "bad_posture":
            bad_s += ev.durasi
            alert_count += 1

    active_session.ended_at = ended_at
    active_session.total_sit_s = max(total_seconds, 0)
    active_session.good_s = good_s
    active_session.bad_s = bad_s
    active_session.alert_count = alert_count

    await db.commit()
    await db.refresh(active_session)
    logger.info(
        "Closed sitting session %s for device %s (total: %ds)",
        active_session.id,
        device_id,
        active_session.total_sit_s,
    )
    return active_session


async def close_orphan_sessions_for_offline_devices(
    db: AsyncSession,
    heartbeat_timeout_s: int,
    current_time: datetime.datetime | None = None,
) -> list[SittingSession]:
    if current_time is None:
        current_time = datetime.datetime.now(datetime.UTC)
    current_time = ensure_utc(current_time) or datetime.datetime.now(datetime.UTC)

    # Cari device offline atau yang last_seen sudah lewat batas
    cutoff_time = current_time - datetime.timedelta(seconds=heartbeat_timeout_s)

    devices_query = select(Device).where(
        (Device.status == "offline") | (Device.last_seen < cutoff_time)
    )
    devices_result = await db.execute(devices_query)
    devices = devices_result.scalars().all()

    closed_sessions: list[SittingSession] = []
    for dev in devices:
        # Tandai offline jika belum
        if dev.status != "offline":
            dev.status = "offline"

        # Tutup sesi aktif jika ada
        closed = await close_session(db, dev.id, dev.last_seen or current_time)
        if closed:
            closed_sessions.append(closed)

    if closed_sessions:
        await db.commit()

    return closed_sessions
