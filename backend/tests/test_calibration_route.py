import datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import Base, get_db
from app.main import app
from app.models import Device, LoadCellReading
from app.pose import Keypoint, PoseResult
from app.routes.calibration import record_recent_pose


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
        session.add(dev)
        now = datetime.datetime.now(datetime.UTC)
        for i in range(5):
            r = LoadCellReading(
                device_id="spc-001",
                timestamp=now + datetime.timedelta(seconds=i),
                load_left_raw=1000,
                load_right_raw=1000,
                presence=False,
            )
            session.add(r)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_calibrate_load_flow(async_app_client: AsyncClient):
    # Step 1: empty -> tare
    resp_empty = await async_app_client.post(
        "/api/devices/spc-001/calibrate/load",
        json={"step": "empty"},
    )
    assert resp_empty.status_code == 200
    data_empty = resp_empty.json()
    assert data_empty["ok"] is True
    assert data_empty["profile"]["tare"] == 2000.0

    # Step 2: occupied -> scale
    resp_occ = await async_app_client.post(
        "/api/devices/spc-001/calibrate/load",
        json={"step": "occupied", "known_weight_kg": 50.0},
    )
    assert resp_occ.status_code == 200
    data_occ = resp_occ.json()
    assert data_occ["ok"] is True
    assert data_occ["profile"]["tare"] == 2000.0


@pytest.mark.asyncio
async def test_calibrate_posture_flow(async_app_client: AsyncClient):
    # Record beberapa frame ke in-memory buffer
    for _ in range(10):
        kps = [
            Keypoint(name="left_ear", x=0.5, y=0.2, visibility=0.9),
            Keypoint(name="left_shoulder", x=0.5, y=0.5, visibility=0.9),
            Keypoint(name="left_hip", x=0.5, y=0.8, visibility=0.9),
        ]
        record_recent_pose("spc-001", PoseResult(ok=True, confidence=0.9, keypoints=kps))

    resp = await async_app_client.post(
        "/api/devices/spc-001/calibrate/posture",
        json={"frames": 10},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "baseline" in data
    assert "side_angle" in data["baseline"]
