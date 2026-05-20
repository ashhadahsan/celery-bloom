"""Tests for the Celery event receiver background thread."""

import asyncio
from unittest.mock import MagicMock, patch

from celery_bloom.event_receiver import _run_receiver, start_event_receiver


def _make_mock_app():
    mock_recv = MagicMock()
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_app = MagicMock()
    mock_app.connection.return_value = mock_conn
    mock_app.events.Receiver.return_value = mock_recv
    return mock_app, mock_recv


class TestStartEventReceiver:
    def test_returns_daemon_thread(self):
        loop = asyncio.new_event_loop()
        try:
            with patch("celery_bloom.event_receiver._run_receiver"):
                thread = start_event_receiver(loop)
            assert thread.daemon is True
        finally:
            loop.close()

    def test_thread_starts_and_finishes(self):
        loop = asyncio.new_event_loop()
        try:
            with patch("celery_bloom.event_receiver._run_receiver"):
                thread = start_event_receiver(loop)
            thread.join(timeout=1.0)
        finally:
            loop.close()


class TestRunReceiver:
    def test_calls_capture_with_correct_args(self):
        loop = asyncio.new_event_loop()
        try:
            mock_app, mock_recv = _make_mock_app()
            with patch("celery_bloom.event_receiver.get_celery_app", return_value=mock_app):
                _run_receiver(loop)
            mock_recv.capture.assert_called_once_with(limit=None, timeout=None, wakeup=True)
        finally:
            loop.close()

    def test_registers_all_task_event_handlers(self):
        loop = asyncio.new_event_loop()
        try:
            mock_app, _ = _make_mock_app()
            with patch("celery_bloom.event_receiver.get_celery_app", return_value=mock_app):
                _run_receiver(loop)
            _, kwargs = mock_app.events.Receiver.call_args
            handlers = kwargs["handlers"]
            expected = {
                "task-received",
                "task-started",
                "task-succeeded",
                "task-failed",
                "task-retried",
                "task-revoked",
            }
            assert set(handlers.keys()) == expected
        finally:
            loop.close()

    def test_on_task_event_updates_store_and_broadcasts(self):
        loop = asyncio.new_event_loop()
        try:
            captured_handlers: dict = {}

            def fake_receiver(conn, handlers):
                captured_handlers.update(handlers)
                r = MagicMock()
                r.capture = MagicMock()
                return r

            mock_app, _ = _make_mock_app()
            mock_app.events.Receiver.side_effect = fake_receiver

            with patch("celery_bloom.event_receiver.get_celery_app", return_value=mock_app):
                _run_receiver(loop)

            # Now invoke the captured handler and verify it calls store.update + broadcast
            handler = captured_handlers["task-received"]
            mock_record = MagicMock()
            mock_record.as_dict.return_value = {"uuid": "t1", "state": "RECEIVED"}

            with (
                patch("celery_bloom.event_receiver.store") as mock_store,
                patch("celery_bloom.event_receiver.asyncio.run_coroutine_threadsafe") as mock_rct,
            ):
                mock_store.update.return_value = mock_record
                handler({"uuid": "t1", "type": "task-received"})

            mock_store.update.assert_called_once()
            mock_rct.assert_called_once()
        finally:
            loop.close()
