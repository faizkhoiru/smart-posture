import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# MQTT Schemas
class MqttTelemetryPayload(BaseModel):
    device_id: str
    timestamp: datetime.datetime
    load_left_raw: int | None = None
    load_right_raw: int | None = None
    load_total_kg: float | None = None
    load_is_estimate: bool = True
    presence: bool = False
    camera_state: Literal["on", "off"] | None = None
    rssi: int | None = None
    firmware_version: str | None = None


class MqttStatusPayload(BaseModel):
    device_id: str
    state: Literal["online", "offline"]
    timestamp: datetime.datetime


class MqttEventDetail(BaseModel):
    source: str | None = None
    reason: str | None = None


class MqttEventPayload(BaseModel):
    device_id: str
    timestamp: datetime.datetime
    type: Literal["occupied", "empty", "sensor_error", "sensor_ok", "camera_on", "camera_off"]
    detail: dict[str, Any] | MqttEventDetail | None = None


class MqttConfigSetPayload(BaseModel):
    occupied_threshold: float = 20.0
    release_threshold: float = 10.0
    debounce_ms: int = 2000
    capture_interval_ms: int = 1000


# REST & WS Schemas
class LoadInfoSchema(BaseModel):
    kg: float | None = None
    is_estimate: bool = True


class KeypointSchema(BaseModel):
    name: Literal[
        "nose",
        "left_ear",
        "right_ear",
        "left_shoulder",
        "right_shoulder",
        "left_hip",
        "right_hip",
    ]
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    visibility: float = Field(ge=0.0, le=1.0)


class DeviceSummarySchema(BaseModel):
    id: str
    name: str
    status: Literal["online", "offline", "sensor_error"]
    last_seen: str | None = None


class DeviceLatestStateSchema(BaseModel):
    chair: Literal["empty", "occupied", "calibrating"]
    posture: Literal["good_posture", "warning", "bad_posture", "pose_unavailable"] | None = None
    camera: Literal["on", "off"]
    device: Literal["online", "offline", "sensor_error"]
    load: LoadInfoSchema
    updated_at: str


class ErrorDetail(BaseModel):
    code: str
    message: str


class UniformErrorResponse(BaseModel):
    error: ErrorDetail
