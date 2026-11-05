import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import Base
from app.models import Device, PostureEvent
from app.session_service import (
    close_orphan_sessions_for_offline_devices,
    close_session,
    ensure_utc,
    start_session,
)


@pytest.fixture
async def test_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_start_session_creates_new(test_session: AsyncSession):
    now = datetime.datetime.now(datetime.UTC)
    # Buat device dulu
    dev = Device(id="spc-001", name="Chair 1", status="online", last_seen=now)
    test_session.add(dev)
    await test_session.commit()

    session = await start_session(test_session, "spc-001", now)
    assert session.id is not None
    assert session.device_id == "spc-001"
    assert ensure_utc(session.started_at) == now
    assert session.ended_at is None

    # Jika dipanggil lagi saat masih aktif, mengembalikan sesi yang sama
    session2 = await start_session(test_session, "spc-001", now + datetime.timedelta(seconds=5))
    assert session2.id == session.id


@pytest.mark.asyncio
async def test_close_session_calculates_duration_and_stats(test_session: AsyncSession):
    t0 = datetime.datetime.now(datetime.UTC)
    dev = Device(id="spc-001", name="Chair 1", status="online", last_seen=t0)
    test_session.add(dev)
    await test_session.commit()

    await start_session(test_session, "spc-001", t0)

    # Tambah event postur
    t1 = t0 + datetime.timedelta(seconds=10)
    ev1 = PostureEvent(
        device_id="spc-001",
        timestamp=t1,
        status="good_posture",
        confidence=0.9,
        durasi=10,
    )
    t2 = t0 + datetime.timedelta(seconds=20)
    ev2 = PostureEvent(
        device_id="spc-001",
        timestamp=t2,
        status="bad_posture",
        confidence=0.85,
        durasi=15,
    )
    test_session.add_all([ev1, ev2])
    await test_session.commit()

    t_end = t0 + datetime.timedelta(seconds=40)
    closed = await close_session(test_session, "spc-001", t_end)

    assert closed is not None
    assert ensure_utc(closed.ended_at) == t_end
    assert closed.total_sit_s == 40
    assert closed.good_s == 10
    assert closed.bad_s == 15
    assert closed.alert_count == 1


@pytest.mark.asyncio
async def test_close_orphan_sessions(test_session: AsyncSession):
    t0 = datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=100)
    dev = Device(id="spc-002", name="Chair 2", status="online", last_seen=t0)
    test_session.add(dev)
    await test_session.commit()

    await start_session(test_session, "spc-002", t0)

    now = datetime.datetime.now(datetime.UTC)
    # Heartbeat timeout 30s -> dev last_seen 100s yang lalu harus dianggap timeout/offline
    closed_list = await close_orphan_sessions_for_offline_devices(
        test_session,
        heartbeat_timeout_s=30,
        current_time=now,
    )

    assert len(closed_list) == 1
    assert closed_list[0].device_id == "spc-002"
    assert ensure_utc(closed_list[0].ended_at) == t0
    assert dev.status == "offline"
