import argparse
import asyncio
import datetime
import json
import logging

import websockets

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ws_client")


async def listen_ws(device_id: str, ws_url: str) -> None:
    uri = f"{ws_url.rstrip('/')}/ws/devices/{device_id}"
    while True:
        try:
            logger.info("Connecting to %s ...", uri)
            async with websockets.connect(uri) as ws:
                logger.info("Connected to %s", uri)
                async for message in ws:
                    try:
                        data = json.loads(message)
                        msg_type = data.get("type", "UNKNOWN").upper()
                        now_str = datetime.datetime.now().strftime("%H:%M:%S")

                        if msg_type == "STATE":
                            summary = f"chair={data.get('chair')}, posture={data.get('posture')}, device={data.get('device')}, camera={data.get('camera')}"
                        elif msg_type == "POSE":
                            kps = data.get("keypoints", [])
                            summary = f"conf={data.get('confidence')}, keypoints_count={len(kps)}"
                        elif msg_type == "ALERT":
                            summary = f"level={data.get('level')}, msg='{data.get('message')}'"
                        elif msg_type == "ALERT_CLEAR":
                            summary = f"timestamp={data.get('timestamp')}"
                        else:
                            summary = str(data)

                        print(f"[{now_str}] {msg_type:<11} | {summary}")
                    except Exception as parse_err:
                        logger.warning("Error parsing WS message: %s", parse_err)
        except (websockets.ConnectionClosed, OSError) as e:
            logger.warning("Connection lost (%s). Reconnecting in 3 seconds...", e)
            await asyncio.sleep(3)
        except asyncio.CancelledError:
            break


def main() -> None:
    parser = argparse.ArgumentParser(description="SPC WebSocket Client Verifier")
    parser.add_argument("--device", default="spc-001", help="Device ID")
    parser.add_argument("--url", default="ws://localhost:8000", help="WebSocket base URL")
    args = parser.parse_args()

    try:
        asyncio.run(listen_ws(args.device, args.url))
    except KeyboardInterrupt:
        logger.info("Exiting on Ctrl+C")


if __name__ == "__main__":
    main()
