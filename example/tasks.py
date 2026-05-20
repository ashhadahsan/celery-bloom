"""
Example Celery app for testing celery-bloom.

Run with:
  celery -A tasks worker --loglevel=info -E
  celery -A tasks beat --loglevel=info        # optional: scheduled tasks
  python example/seed.py                      # send some tasks
"""
import os
import random
import time

from celery import Celery

_broker = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
_backend = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

app = Celery("example", broker=_broker, backend=_backend)

app.conf.update(
    # Required: emit task events so celery-bloom can see them
    task_send_sent_event=True,
    worker_send_task_events=True,
    # Optional: periodic tasks via beat
    beat_schedule={
        "health-check-every-30s": {
            "task": "tasks.health_check",
            "schedule": 30.0,
        },
    },
)


@app.task(bind=True, name="tasks.add")
def add(self, x: int, y: int) -> int:
    time.sleep(random.uniform(0.1, 2.0))
    return x + y


@app.task(bind=True, name="tasks.slow_job")
def slow_job(self, duration: float = 5.0) -> str:
    """Simulates a long-running task."""
    steps = 10
    for i in range(steps):
        time.sleep(duration / steps)
        self.update_state(state="PROGRESS", meta={"current": i + 1, "total": steps})
    return f"completed after {duration}s"


@app.task(bind=True, name="tasks.flaky", max_retries=3)
def flaky(self, fail_rate: float = 0.6) -> str:
    """Randomly fails and retries — useful for testing failure/retry states."""
    if random.random() < fail_rate:
        raise self.retry(exc=ValueError("random failure"), countdown=2)
    return "success"


@app.task(name="tasks.health_check")
def health_check() -> dict:
    return {"status": "ok", "ts": time.time()}


@app.task(name="tasks.process_batch")
def process_batch(items: list) -> dict:
    """Processes a list of items, simulating real batch work."""
    results = []
    for item in items:
        time.sleep(random.uniform(0.05, 0.2))
        results.append({"item": item, "processed": True})
    return {"count": len(results), "results": results}


@app.task(name="tasks.normalize")
def normalize(result: dict) -> dict:
    time.sleep(random.uniform(0.1, 0.5))
    return {**result, "normalized": True}


@app.task(name="tasks.notify")
def notify(result: dict) -> str:
    time.sleep(0.1)
    return f"notified: {result}"
