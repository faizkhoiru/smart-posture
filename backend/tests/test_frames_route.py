import io

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.db import Base, get_db
from app.main import app
from app.models import Device
from app.mqtt_client import get_or_create_runtime_state


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

    # Inisialisasi device uji
    async with session_factory() as session:
        dev = Device(id="spc-001", name="Chair Test", status="online")
        session.add(dev)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_upload_frame_unauthorized(async_app_client: AsyncClient):
    # Tanpa header X-Device-Key -> 401
    resp = await async_app_client.post(
        "/api/devices/spc-001/frames",
        headers={"Content-Type": "image/jpeg"},
        content=b"dummy_jpeg",
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.asyncio
async def test_upload_frame_too_large(async_app_client: AsyncClient):
    # Payload melebihi MAX_FRAME_BYTES -> 400
    large_payload = b"x" * (settings.MAX_FRAME_BYTES + 100)
    resp = await async_app_client.post(
        "/api/devices/spc-001/frames",
        headers={
            "X-Device-Key": settings.DEVICE_API_KEY,
            "Content-Type": "image/jpeg",
        },
        content=large_payload,
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "payload_too_large"


@pytest.mark.asyncio
async def test_upload_frame_chair_not_occupied(async_app_client: AsyncClient):
    # Kursi status empty -> 409
    rt = get_or_create_runtime_state("spc-001")
    rt.chair = "empty"

    resp = await async_app_client.post(
        "/api/devices/spc-001/frames",
        headers={
            "X-Device-Key": settings.DEVICE_API_KEY,
            "Content-Type": "image/jpeg",
        },
        content=b"valid_bytes",
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "chair_not_occupied"


@pytest.mark.asyncio
async def test_upload_frame_success(async_app_client: AsyncClient):
    # Kursi status occupied, key benar, frame valid -> 202
    rt = get_or_create_runtime_state("spc-001")
    rt.chair = "occupied"

    resp = await async_app_client.post(
        "/api/devices/spc-001/frames",
        headers={
            "X-Device-Key": settings.DEVICE_API_KEY,
            "Content-Type": "image/jpeg",
        },
        content=b"\xff\xd8\xff\xe0" + b"dummy_jpeg_header",
    )
    assert resp.status_code == 202
    assert resp.json() == {"accepted": True}


@pytest.mark.asyncio
async def test_upload_frame_multipart_success(async_app_client: AsyncClient):
    # Format multipart/form-data
    rt = get_or_create_runtime_state("spc-001")
    rt.chair = "occupied"

    files = {"image": ("frame.jpg", io.BytesIO(b"\xff\xd8\xff\xe0dummy"), "image/jpeg")}
    resp = await async_app_client.post(
        "/api/devices/spc-001/frames",
        headers={"X-Device-Key": settings.DEVICE_API_KEY},
        files=files,
    )
    assert resp.status_code == 202
    assert resp.json() == {"accepted": True}
