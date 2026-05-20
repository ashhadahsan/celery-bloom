"""Thin wrapper around Celery's inspect/control APIs."""

from __future__ import annotations

from typing import Any

from celery import Celery

from celery_bloom.config import settings

_app: Celery | None = None


def get_celery_app() -> Celery:
    global _app
    if _app is None:
        _app = Celery(
            broker=settings.broker_url,
            backend=settings.result_backend,
        )
        _app.config_from_object(
            {
                "broker_url": settings.broker_url,
                "result_backend": settings.result_backend,
                "broker_connection_retry_on_startup": True,
            }
        )
    return _app


def _inspect(method: str) -> Any:
    app = get_celery_app()
    i = app.control.inspect(timeout=settings.inspect_timeout)
    return getattr(i, method)() or {}


def get_workers() -> list[dict]:
    active = _inspect("active")
    stats = _inspect("stats")
    registered = _inspect("registered")
    scheduled = _inspect("scheduled")
    reserved = _inspect("reserved")

    workers = []
    for name in set(active) | set(stats):
        worker_stats = stats.get(name, {})
        workers.append(
            {
                "name": name,
                "status": "online",
                "active_tasks": active.get(name, []),
                "scheduled_tasks": scheduled.get(name, []),
                "reserved_tasks": reserved.get(name, []),
                "registered_tasks": registered.get(name, []),
                "concurrency": worker_stats.get("pool", {}).get("max-concurrency"),
                "processes": worker_stats.get("pool", {}).get("processes", []),
                "total_tasks": worker_stats.get("total", {}),
                "prefetch_count": worker_stats.get("prefetch_count"),
                "broker": worker_stats.get("broker", {}),
            }
        )
    return workers


def revoke_task(task_id: str, terminate: bool = False) -> None:
    app = get_celery_app()
    app.control.revoke(task_id, terminate=terminate)
