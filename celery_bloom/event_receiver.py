"""Background thread that captures Celery events and feeds the task store + WebSocket."""

from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any

from celery_bloom.celery_client import get_celery_app
from celery_bloom.task_store import store

logger = logging.getLogger(__name__)


def _run_receiver(loop: asyncio.AbstractEventLoop) -> None:
    from celery_bloom.api.events import broadcast

    app = get_celery_app()

    def on_task_event(event: dict) -> None:
        record = store.update(event)
        asyncio.run_coroutine_threadsafe(
            broadcast({"type": "task_update", "data": record.as_dict()}),
            loop,
        )

    handlers: dict[str, Any] = {
        "task-received": on_task_event,
        "task-started": on_task_event,
        "task-succeeded": on_task_event,
        "task-failed": on_task_event,
        "task-retried": on_task_event,
        "task-revoked": on_task_event,
    }

    with app.connection() as conn:
        recv = app.events.Receiver(conn, handlers=handlers)
        logger.info("Celery event receiver started")
        recv.capture(limit=None, timeout=None, wakeup=True)


def start_event_receiver(loop: asyncio.AbstractEventLoop) -> threading.Thread:
    t = threading.Thread(target=_run_receiver, args=(loop,), daemon=True)
    t.start()
    return t
