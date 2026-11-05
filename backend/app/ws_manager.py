import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class WSManager:
    def __init__(self) -> None:
        # device_id -> set of active WebSockets
        self.active_connections: dict[str, set[WebSocket]] = {}
        # device_id -> last WsStateMessage dict
        self.last_states: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, device_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            if device_id not in self.active_connections:
                self.active_connections[device_id] = set()
            self.active_connections[device_id].add(websocket)
        logger.info("WS client connected to device %s. Total: %d", device_id, len(self.active_connections[device_id]))

    async def disconnect(self, device_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            if device_id in self.active_connections:
                self.active_connections[device_id].discard(websocket)
                if not self.active_connections[device_id]:
                    del self.active_connections[device_id]
        logger.info("WS client disconnected from device %s", device_id)

    async def broadcast(self, device_id: str, message: dict[str, Any]) -> None:
        async with self._lock:
            clients = list(self.active_connections.get(device_id, set()))

        if message.get("type") == "state":
            self.set_last_state(device_id, message)

        if not clients:
            return

        text_data = json.dumps(message)
        dead_clients: list[WebSocket] = []

        for ws in clients:
            try:
                await ws.send_text(text_data)
            except (WebSocketDisconnect, RuntimeError, Exception) as e:
                logger.debug("Failed to send WS message to a client for device %s: %s", device_id, e)
                dead_clients.append(ws)

        if dead_clients:
            async with self._lock:
                if device_id in self.active_connections:
                    for dead in dead_clients:
                        self.active_connections[device_id].discard(dead)
                    if not self.active_connections[device_id]:
                        del self.active_connections[device_id]

    def get_last_state(self, device_id: str) -> dict[str, Any] | None:
        return self.last_states.get(device_id)

    def set_last_state(self, device_id: str, state: dict[str, Any]) -> None:
        self.last_states[device_id] = state


ws_manager = WSManager()
