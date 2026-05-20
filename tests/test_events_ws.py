"""Tests for the WebSocket events endpoint and broadcast helper."""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from celery_bloom.app import create_app
from celery_bloom.api import events as events_module


@pytest.fixture()
def client():
    with patch("celery_bloom.app.start_event_receiver", return_value=None):
        app = create_app()
        with TestClient(app) as c:
            yield c


class TestWebSocket:
    def test_receives_snapshot_on_connect(self, client):
        with client.websocket_connect("/ws/events") as ws:
            msg = ws.receive_json()
        assert msg["type"] == "snapshot"
        assert "data" in msg

    def test_snapshot_contains_stats_shape(self, client):
        with client.websocket_connect("/ws/events") as ws:
            msg = ws.receive_json()
        data = msg["data"]
        assert "total" in data
        assert "by_state" in data

    def test_connection_added_and_removed(self, client):
        before = len(events_module._connections)
        with client.websocket_connect("/ws/events"):
            assert len(events_module._connections) == before + 1
        assert len(events_module._connections) == before


class TestBroadcast:
    def test_sends_to_connected_websocket(self):
        mock_ws = MagicMock()
        mock_ws.send_text = AsyncMock()
        events_module._connections.add(mock_ws)
        try:
            asyncio.run(events_module.broadcast({"type": "task_update", "data": {}}))
            mock_ws.send_text.assert_called_once()
            payload = json.loads(mock_ws.send_text.call_args[0][0])
            assert payload["type"] == "task_update"
        finally:
            events_module._connections.discard(mock_ws)

    def test_removes_dead_connection_on_error(self):
        mock_ws = MagicMock()
        mock_ws.send_text = AsyncMock(side_effect=RuntimeError("closed"))
        events_module._connections.add(mock_ws)
        try:
            asyncio.run(events_module.broadcast({"type": "ping"}))
            assert mock_ws not in events_module._connections
        finally:
            events_module._connections.discard(mock_ws)

    def test_broadcasts_to_multiple_clients(self):
        ws1, ws2 = MagicMock(), MagicMock()
        ws1.send_text = AsyncMock()
        ws2.send_text = AsyncMock()
        events_module._connections.update({ws1, ws2})
        try:
            asyncio.run(events_module.broadcast({"type": "ping"}))
            ws1.send_text.assert_called_once()
            ws2.send_text.assert_called_once()
        finally:
            events_module._connections.discard(ws1)
            events_module._connections.discard(ws2)
