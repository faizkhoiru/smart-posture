import pytest
from pydantic import ValidationError

from app.schemas import (
    MqttConfigSetPayload,
    MqttEventPayload,
    MqttStatusPayload,
    MqttTelemetryPayload,
)


def test_telemetry_payload_valid():
    data = {
        "device_id": "spc-001",
        "timestamp": "2026-11-01T08:30:00Z",
        "load_left_raw": 123456,
        "load_right_raw": 120987,
        "load_total_kg": 62.4,
        "load_is_estimate": True,
        "presence": True,
        "camera_state": "on",
        "rssi": -58,
        "firmware_version": "0.1.0",
    }
    obj = MqttTelemetryPayload.model_validate(data)
    assert obj.device_id == "spc-001"
    assert obj.load_total_kg == 62.4
    assert obj.presence is True


def test_telemetry_payload_missing_required():
    data = {
        "load_left_raw": 123456,
        # missing device_id and timestamp
    }
    with pytest.raises(ValidationError):
        MqttTelemetryPayload.model_validate(data)


def test_status_payload_valid():
    data = {
        "device_id": "spc-001",
        "state": "online",
        "timestamp": "2026-11-01T08:30:10Z",
    }
    obj = MqttStatusPayload.model_validate(data)
    assert obj.state == "online"


def test_status_payload_invalid_state():
    data = {
        "device_id": "spc-001",
        "state": "unknown_state",
        "timestamp": "2026-11-01T08:30:10Z",
    }
    with pytest.raises(ValidationError):
        MqttStatusPayload.model_validate(data)


def test_event_payload_valid():
    data = {
        "device_id": "spc-001",
        "timestamp": "2026-11-01T08:30:02Z",
        "type": "occupied",
        "detail": None,
    }
    obj = MqttEventPayload.model_validate(data)
    assert obj.type == "occupied"


def test_config_set_payload():
    cfg = MqttConfigSetPayload()
    assert cfg.occupied_threshold == 20.0
    dump = cfg.model_dump()
    assert "debounce_ms" in dump

