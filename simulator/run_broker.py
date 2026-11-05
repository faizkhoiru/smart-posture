import asyncio
import logging

from amqtt.broker import Broker

# Kurangi log bising
logging.getLogger("amqtt").setLevel(logging.WARNING)

config = {
    "listeners": {
        "default": {
            "type": "tcp",
            "bind": "127.0.0.1:1883",
        },
        "ws": {
            "type": "ws",
            "bind": "127.0.0.1:9001",
        },
    },
    "auth": {
        "allow-anonymous": True,
        "plugins": ["auth_anonymous"],
    },
}


async def main():
    broker = Broker(config)
    await broker.start()
    print("=" * 55)
    print("MQTT Broker aktif di 127.0.0.1:1883 (WS: 9001)")
    print("Tekan Ctrl+C untuk menghentikan broker")
    print("=" * 55)
    try:
        while True:
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        await broker.shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBroker dimatikan.")
