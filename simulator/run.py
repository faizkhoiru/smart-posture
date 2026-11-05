import argparse
import datetime
import json
import logging
import os
import time
from pathlib import Path
from typing import Any

import paho.mqtt.client as mqtt
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("simulator")

SAMPLES_DIR = Path(__file__).resolve().parent / "samples"


def get_device_api_key() -> str:
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if not env_file.exists():
        env_file = Path(__file__).resolve().parent.parent / ".env.example"

    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("DEVICE_API_KEY="):
                return line.split("=", 1)[1].strip()
    return os.environ.get("DEVICE_API_KEY", "change-me")


DEVICE_API_KEY = get_device_api_key()


def mqtt_publish(
    broker: str,
    port: int,
    topic: str,
    payload: dict[str, Any],
) -> None:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    try:
        client.connect(broker, port, 60)
        client.loop_start()
        json_data = json.dumps(payload)
        info = client.publish(topic, json_data, qos=1)
        info.wait_for_publish(timeout=3)
        client.loop_stop()
        client.disconnect()
        logger.info("MQTT publish -> %s: %s", topic, json_data)
    except (OSError, mqtt.WebsocketConnectionError, Exception) as e:  # noqa: BLE001
        logger.error("Failed to publish to MQTT topic %s: %s", topic, e)


def upload_frame(
    device_id: str,
    image_path_or_name: str,
    backend_url: str,
    custom_endpoint: str | None = None,
) -> bool:
    img_path = Path(image_path_or_name)
    if not img_path.is_file():
        img_path = SAMPLES_DIR / image_path_or_name

    if not img_path.exists():
        logger.warning("Image file %s does not exist", img_path)
        return False

    endpoint = custom_endpoint or f"{backend_url.rstrip('/')}/api/devices/{device_id}/frames"
    headers = {"X-Device-Key": DEVICE_API_KEY}

    try:
        with open(img_path, "rb") as f:
            files = {"image": (img_path.name, f, "image/jpeg")}
            resp = requests.post(endpoint, headers=headers, files=files, timeout=5)
            if resp.status_code == 202:
                logger.info("Upload frame %s: 202 Accepted", img_path.name)
                return True
            else:
                logger.warning(
                    "Upload frame %s returned %s: %s", img_path.name, resp.status_code, resp.text
                )
                return False
    except requests.RequestException as e:
        logger.warning("Backend tidak tersedia, skip frame: %s", e)
        return False


def wait(seconds: float) -> None:
    time.sleep(seconds)


# ================= Skenario =================


def sit_straight(
    device: str, broker: str, port: int, backend: str, straight_img: str = "straight.jpg", **kwargs
) -> None:
    logger.info("=== Running scenario: sit_straight (using %s) ===", straight_img)
    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "occupied", "detail": None},
    )

    for _ in range(10):
        upload_frame(device, straight_img, backend)
        wait(1.0)

    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "empty", "detail": None},
    )


def slouch_short(
    device: str,
    broker: str,
    port: int,
    backend: str,
    straight_img: str = "straight.jpg",
    slouch_img: str = "slouch.jpg",
    **kwargs,
) -> None:
    logger.info("=== Running scenario: slouch_short ===")
    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "occupied", "detail": None},
    )

    for _ in range(3):
        upload_frame(device, straight_img, backend)
        wait(1.0)

    for _ in range(3):
        upload_frame(device, slouch_img, backend)
        wait(1.0)

    for _ in range(3):
        upload_frame(device, straight_img, backend)
        wait(1.0)

    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "empty", "detail": None},
    )


def slouch_long(
    device: str,
    broker: str,
    port: int,
    backend: str,
    straight_img: str = "straight.jpg",
    slouch_img: str = "slouch.jpg",
    **kwargs,
) -> None:
    logger.info("=== Running scenario: slouch_long ===")
    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "occupied", "detail": None},
    )

    for _ in range(3):
        upload_frame(device, straight_img, backend)
        wait(1.0)

    for _ in range(15):
        upload_frame(device, slouch_img, backend)
        wait(1.0)

    for _ in range(5):
        upload_frame(device, straight_img, backend)
        wait(1.0)

    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "empty", "detail": None},
    )


def body_not_visible(
    device: str, broker: str, port: int, backend: str, empty_img: str = "empty.jpg", **kwargs
) -> None:
    logger.info("=== Running scenario: body_not_visible ===")
    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "occupied", "detail": None},
    )

    for _ in range(10):
        upload_frame(device, empty_img, backend)
        wait(1.0)

    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "empty", "detail": None},
    )


def stand_up(
    device: str, broker: str, port: int, backend: str, straight_img: str = "straight.jpg", **kwargs
) -> None:
    logger.info("=== Running scenario: stand_up ===")
    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "occupied", "detail": None},
    )

    for _ in range(5):
        upload_frame(device, straight_img, backend)
        wait(1.0)

    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "empty", "detail": None},
    )


def sensor_error(device: str, broker: str, port: int, backend: str, **kwargs) -> None:
    logger.info("=== Running scenario: sensor_error ===")
    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {
            "device_id": device,
            "timestamp": now_iso,
            "type": "sensor_error",
            "detail": {"source": "load_left", "reason": "wire disconnected"},
        },
    )

    wait(2.0)

    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "sensor_ok", "detail": None},
    )


def backend_offline(
    device: str, broker: str, port: int, backend: str, straight_img: str = "straight.jpg", **kwargs
) -> None:
    logger.info("=== Running scenario: backend_offline ===")
    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "occupied", "detail": None},
    )

    wrong_endpoint = f"{backend.rstrip('/')}/wrong"
    upload_frame(device, straight_img, backend, custom_endpoint=wrong_endpoint)
    print("Backend tidak tersedia, skip frame")


def full_flow(
    device: str,
    broker: str,
    port: int,
    backend: str,
    straight_img: str = "straight.jpg",
    slouch_img: str = "slouch.jpg",
    **kwargs,
) -> None:
    logger.info("=== Running scenario: full_flow ===")
    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "occupied", "detail": None},
    )

    for _ in range(5):
        upload_frame(device, straight_img, backend)
        wait(1.0)

    for _ in range(15):
        upload_frame(device, slouch_img, backend)
        wait(1.0)

    for _ in range(5):
        upload_frame(device, straight_img, backend)
        wait(1.0)

    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    mqtt_publish(
        broker,
        port,
        f"spc/{device}/event",
        {"device_id": device, "timestamp": now_iso, "type": "empty", "detail": None},
    )


SCENARIOS = {
    "sit_straight": sit_straight,
    "slouch_short": slouch_short,
    "slouch_long": slouch_long,
    "body_not_visible": body_not_visible,
    "stand_up": stand_up,
    "sensor_error": sensor_error,
    "backend_offline": backend_offline,
    "full_flow": full_flow,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="SPC Device Simulator")
    parser.add_argument(
        "--scenario", required=True, choices=list(SCENARIOS.keys()), help="Nama skenario"
    )
    parser.add_argument("--device", default="spc-001", help="Device ID")
    parser.add_argument("--backend", default="http://localhost:8000", help="URL Backend FastAPI")
    parser.add_argument("--broker", default="localhost", help="MQTT Broker Host")
    parser.add_argument("--port", type=int, default=1883, help="MQTT Broker Port")
    parser.add_argument(
        "--straight",
        default="straight.jpg",
        help="Path atau nama file gambar postur tegak (default: straight.jpg)",
    )
    parser.add_argument(
        "--slouch",
        default="slouch.jpg",
        help="Path atau nama file gambar postur bungkuk (default: slouch.jpg)",
    )
    args = parser.parse_args()

    scenario_fn = SCENARIOS[args.scenario]
    scenario_fn(
        device=args.device,
        broker=args.broker,
        port=args.port,
        backend=args.backend,
        straight_img=args.straight,
        slouch_img=args.slouch,
    )


if __name__ == "__main__":
    main()
