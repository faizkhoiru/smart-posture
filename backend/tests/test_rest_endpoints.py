import datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import Base, get_db
from app.main import app
from app.models import Device, DeviceConfig, PostureEvent, SittingSession


@pytest.fixture
async def async_app_client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    async with session_factory() as session:
        dev = Device(id="spc-001", name="Chair Test", status="online")
        cfg = DeviceConfig(device_id="spc-001")
        session.add_all([dev, cfg])

        now = datetime.datetime.now(datetime.UTC)
        sess = SittingSession(
            device_id="spc-001",
            started_at=now,
            ended_at=now + datetime.timedelta(seconds=60),
            total_sit_s=60,
            good_s=40,
            bad_s=20,
            alert_count=1,
        )
        session.add(sess)

        ev = PostureEvent(
            device_id="spc-001",
            timestamp=now,
            status="bad_posture",
            confidence=0.88,
            keypoints=[{"name": "nose", "x": 0.5, "y": 0.5, "visibility": 0.9}],
            durasi=20,
        )
        session.add(ev)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_get_sessions(async_app_client: AsyncClient):
    resp = await async_app_client.get("/api/devices/spc-001/sessions")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["total_sit_s"] == 60
    assert data[0]["alert_count"] == 1


@pytest.mark.asyncio
async def test_get_events(async_app_client: AsyncClient):
    resp = await async_app_client.get("/api/devices/spc-001/events")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["status"] == "bad_posture"
    assert "keypoints" in data[0]
    assert data[0]["durasi"] == 20


@pytest.mark.asyncio
async def test_update_config(async_app_client: AsyncClient):
    resp = await async_app_client.put(
        "/api/devices/spc-001/config",
        json={"tolerance_seconds": 10, "view_mode": "front"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["tolerance_seconds"] == 10
    assert data["view_mode"] == "front"


@pytest.mark.asyncio
async def test_ack_alert(async_app_client: AsyncClient):
    # Dapatkan event id dulu
    ev_resp = await async_app_client.get("/api/devices/spc-001/events")
    event_id = ev_resp.json()[0]["id"]

    resp = await async_app_client.post(
        "/api/devices/spc-001/alerts/ack",
        json={"event_id": event_id},
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


@pytest.mark.asyncio
async def test_mute_alert(async_app_client: AsyncClient):
    resp = await async_app_client.post(
        "/api/devices/spc-001/alerts/mute",
        json={"minutes": 5},
    )
    assert resp.status_code == 200
    assert "muted_until" in resp.json()
