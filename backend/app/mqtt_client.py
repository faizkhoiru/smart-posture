import asyncio
import datetime
import json
import logging
from typing import Any

import paho.mqtt.client as mqtt
from pydantic import ValidationError
from sqlalchemy import select

from app.config import settings
from app.db import async_session_maker
from app.models import Device, DeviceConfig, LoadCellReading
from app.posture_logic import PostureInternalState
from app.schemas import (
    MqttConfigSetPayload,
    MqttEventPayload,
    MqttStatusPayload,
    MqttTelemetryPayload,
)
from app.session_service import (
    close_orphan_sessions_for_offline_devices,
    close_session,
    start_session,
)
from app.ws_manager import ws_manager

logger = logging.getLogger(__name__)


class DeviceRuntimeState:
    """Menyimpan runtime in-memory state terbaru per device untuk respon cepat."""

    def __init__(self) -> None:
        self.chair: str = "empty"  # empty | occupied | calibrating
        self.posture: str | None = None  # good_posture | warning | bad_posture | pose_unavailable | None
        self.camera: str = "off"  # on | off
        self.device: str = "offline"  # online | offline | sensor_error
        self.analysis: str = "ok"  # ok | analysis_unavailable
        self.load_kg: float | None = None
        self.load_is_estimate: bool = True
        self.muted_until: datetime.datetime | None = None
        self.updated_at: datetime.datetime = datetime.datetime.now(datetime.UTC)
        # Posture internal state untuk decide()
        self.posture_internal: PostureInternalState = PostureInternalState()

    def to_ws_state_dict(self) -> dict[str, Any]:
        return {
            "type": "state",
            "chair": self.chair,
            "posture": self.posture,
            "camera": self.camera,
            "device": self.device,
            "analysis": self.analysis,
            "load": {
                "kg": self.load_kg,
                "is_estimate": self.load_is_estimate,
            },
            "muted_until": self.muted_until.isoformat() if self.muted_until else None,
            "updated_at": self.updated_at.isoformat(),
        }


# In-memory runtime state dictionary: device_id -> DeviceRuntimeState
device_runtime_states: dict[str, DeviceRuntimeState] = {}


def get_or_create_runtime_state(device_id: str) -> DeviceRuntimeState:
    if device_id not in device_runtime_states:
        device_runtime_states[device_id] = DeviceRuntimeState()
    return device_runtime_states[device_id]


async def broadcast_device_state(device_id: str) -> None:
    rt = get_or_create_runtime_state(device_id)
    await ws_manager.broadcast(device_id, rt.to_ws_state_dict())


class MqttService:
    def __init__(self) -> None:
        self.client: mqtt.Client | None = None
        self.loop: asyncio.AbstractEventLoop | None = None
        self.offline_checker_task: asyncio.Task | None = None
        self.is_running: bool = False

    def get_client(self) -> mqtt.Client:
        if self.client is None:
            self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
            if settings.MQTT_USERNAME and settings.MQTT_PASSWORD:
                self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
            self.client.on_connect = self._on_connect
            self.client.on_message = self._on_message
        return self.client

    def _on_connect(
        self,
        client: mqtt.Client,
        userdata: Any,
        flags: Any,
        reason_code: Any,
        properties: Any = None,
    ) -> None:
        if reason_code == 0 or getattr(reason_code, "is_failure", False) is False:
            logger.info("Connected to MQTT broker: %s:%s", settings.MQTT_HOST, settings.MQTT_PORT)
            prefix = settings.MQTT_TOPIC_PREFIX
            topics = [
                (f"{prefix}/+/telemetry", 0),
                (f"{prefix}/+/status", 1),
                (f"{prefix}/+/event", 1),
                (f"{prefix}/+/config/state", 1),
            ]
            client.subscribe(topics)
            logger.info("Subscribed to topics: %s", topics)
        else:
            logger.error("Failed to connect to MQTT broker, reason_code: %s", reason_code)

    def _on_message(self, client: mqtt.Client, userdata: Any, msg: mqtt.MQTTMessage) -> None:
        topic = msg.topic
        payload_str = msg.payload.decode("utf-8", errors="replace")
        logger.debug("MQTT message on %s: %s", topic, payload_str)

        try:
            payload_data = json.loads(payload_str)
        except Exception as e:
            logger.warning("Invalid JSON in MQTT topic %s: %s (payload: %s)", topic, e, payload_str)
            return

        if self.loop and self.loop.is_running():
            asyncio.run_coroutine_threadsafe(self.handle_message(topic, payload_data), self.loop)
        else:
            logger.warning("Event loop is not running, dropping MQTT message for %s", topic)

    async def handle_message(self, topic: str, data: dict[str, Any]) -> None:
        parts = topic.split("/")
        if len(parts) < 3:
            return

        device_id = parts[1]
        msg_type = parts[2]

        try:
            if msg_type == "telemetry":
                await self._handle_telemetry(device_id, data)
            elif msg_type == "status":
                await self._handle_status(device_id, data)
            elif msg_type == "event":
                await self._handle_event(device_id, data)
            elif msg_type == "config" and len(parts) >= 4 and parts[3] == "state":
                await self._handle_config_state(device_id, data)
        except ValidationError as ve:
            logger.warning("Pydantic validation error for %s on device %s: %s", msg_type, device_id, ve)
        except Exception as ex:
            logger.error("Error processing MQTT message on %s: %s", topic, ex, exc_info=True)

    async def _ensure_device_exists(self, device_id: str, firmware: str | None = None) -> None:
        async with async_session_maker() as session:
            result = await session.execute(select(Device).where(Device.id == device_id))
            device = result.scalars().first()
            if not device:
                device = Device(
                    id=device_id,
                    name=f"Smart Chair {device_id}",
                    status="online",
                    last_seen=datetime.datetime.now(datetime.UTC),
                    firmware_version=firmware,
                )
                session.add(device)
                config = DeviceConfig(
                    device_id=device_id,
                    occupied_threshold=20.0,
                    release_threshold=10.0,
                    debounce_ms=2000,
                    capture_interval_ms=1000,
                    min_visibility=settings.MIN_VISIBILITY,
                    tolerance_seconds=settings.TOLERANCE_SECONDS,
                    warning_min_frames=settings.WARNING_MIN_FRAMES,
                    remind_interval=settings.REMIND_INTERVAL_S,
                    view_mode=settings.VIEW_MODE,
                    camera_state="off",
                )
                session.add(config)
                await session.commit()

    async def _handle_telemetry(self, device_id: str, data: dict[str, Any]) -> None:
        payload = MqttTelemetryPayload.model_validate(data)
        await self._ensure_device_exists(device_id, payload.firmware_version)

        rt = get_or_create_runtime_state(device_id)
        rt.device = "online"
        rt.load_kg = payload.load_total_kg
        rt.load_is_estimate = payload.load_is_estimate
        if payload.camera_state:
            rt.camera = payload.camera_state
        if payload.presence:
            rt.chair = "occupied"
        rt.updated_at = payload.timestamp

        async with async_session_maker() as session:
            dev_result = await session.execute(select(Device).where(Device.id == device_id))
            dev = dev_result.scalars().first()
            if dev:
                dev.last_seen = payload.timestamp
                dev.status = "online"
                if payload.firmware_version:
                    dev.firmware_version = payload.firmware_version

            reading = LoadCellReading(
                device_id=device_id,
                timestamp=payload.timestamp,
                load_left_raw=payload.load_left_raw,
                load_right_raw=payload.load_right_raw,
                estimated_load=payload.load_total_kg,
                load_is_estimate=payload.load_is_estimate,
                presence=payload.presence,
                sensor_status="ok",
            )
            session.add(reading)
            await session.commit()

    async def _handle_status(self, device_id: str, data: dict[str, Any]) -> None:
        payload = MqttStatusPayload.model_validate(data)
        await self._ensure_device_exists(device_id)

        rt = get_or_create_runtime_state(device_id)
        prev_dev = rt.device
        rt.device = payload.state
        rt.updated_at = payload.timestamp

        async with async_session_maker() as session:
            result = await session.execute(select(Device).where(Device.id == device_id))
            dev = result.scalars().first()
            if dev:
                dev.status = payload.state
                dev.last_seen = payload.timestamp
                await session.commit()

        if payload.state == "offline":
            async with async_session_maker() as session:
                await close_session(session, device_id, payload.timestamp)

        if prev_dev != payload.state:
            await broadcast_device_state(device_id)

    async def _handle_event(self, device_id: str, data: dict[str, Any]) -> None:
        payload = MqttEventPayload.model_validate(data)
        await self._ensure_device_exists(device_id)

        rt = get_or_create_runtime_state(device_id)
        rt.device = "online"
        rt.updated_at = payload.timestamp

        async with async_session_maker() as session:
            dev_res = await session.execute(select(Device).where(Device.id == device_id))
            dev = dev_res.scalars().first()
            if dev:
                dev.last_seen = payload.timestamp

            if payload.type == "occupied":
                rt.chair = "occupied"
                rt.camera = "on"
                await start_session(session, device_id, payload.timestamp)
            elif payload.type == "empty":
                rt.chair = "empty"
                rt.camera = "off"
                rt.posture = None
                rt.posture_internal.reset()
                await close_session(session, device_id, payload.timestamp)
            elif payload.type == "sensor_error":
                rt.device = "sensor_error"
                if dev:
                    dev.status = "sensor_error"
                await session.commit()
            elif payload.type == "sensor_ok":
                rt.device = "online"
                if dev:
                    dev.status = "online"
                await session.commit()
            elif payload.type == "camera_on":
                rt.camera = "on"
            elif payload.type == "camera_off":
                rt.camera = "off"

        await broadcast_device_state(device_id)

    async def _handle_config_state(self, device_id: str, data: dict[str, Any]) -> None:
        logger.info("Received config state for device %s: %s", device_id, data)

    def publish_config_set(self, device_id: str, config: MqttConfigSetPayload) -> None:
        if self.client and self.client.is_connected():
            topic = f"{settings.MQTT_TOPIC_PREFIX}/{device_id}/config/set"
            self.client.publish(topic, config.model_dump_json(), qos=1)
            logger.info("Published config/set to %s: %s", topic, config.model_dump_json())
        else:
            logger.warning("Cannot publish config/set: MQTT client not connected")

    async def check_offline_devices_loop(self) -> None:
        while self.is_running:
            try:
                await asyncio.sleep(5)
                async with async_session_maker() as session:
                    closed = await close_orphan_sessions_for_offline_devices(
                        session,
                        heartbeat_timeout_s=settings.HEARTBEAT_TIMEOUT_S,
                    )
                    if closed:
                        for s in closed:
                            rt = get_or_create_runtime_state(s.device_id)
                            rt.device = "offline"
                            await broadcast_device_state(s.device_id)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in check_offline_devices_loop: %s", e)

    async def start(self) -> None:
        self.is_running = True
        self.loop = asyncio.get_running_loop()
        client = self.get_client()
        try:
            client.connect_async(settings.MQTT_HOST, settings.MQTT_PORT, 60)
            client.loop_start()
            self.offline_checker_task = asyncio.create_task(self.check_offline_devices_loop())
            logger.info("MqttService started")
        except Exception as e:
            logger.warning("Failed to start MQTT connection to %s:%s: %s", settings.MQTT_HOST, settings.MQTT_PORT, e)

    async def stop(self) -> None:
        self.is_running = False
        if self.offline_checker_task:
            self.offline_checker_task.cancel()
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
        logger.info("MqttService stopped")


mqtt_service = MqttService()
