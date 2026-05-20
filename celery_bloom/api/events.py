"""WebSocket endpoint that forwards Celery events to connected browsers."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from celery_bloom.task_store import store

logger = logging.getLogger(__name__)
router = APIRouter(tags=["events"])

_connections: set[WebSocket] = set()


async def broadcast(message: dict) -> None:
    dead = set()
    for ws in _connections:
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            dead.add(ws)
    _connections.difference_update(dead)


@router.websocket("/ws/events")
async def events_ws(websocket: WebSocket):
    await websocket.accept()
    _connections.add(websocket)
    try:
        await websocket.send_text(json.dumps({"type": "snapshot", "data": store.stats()}))
        while True:
            try:
                # Wait for a client message or timeout — detects disconnects cleanly
                await asyncio.wait_for(websocket.receive(), timeout=30)
            except asyncio.TimeoutError:
                # Client still connected, send keepalive ping
                await websocket.send_text(json.dumps({"type": "ping"}))
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        _connections.discard(websocket)
