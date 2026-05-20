from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from celery_bloom import celery_client
from celery_bloom.task_store import store

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/registered")
def registered_tasks():
    """Aggregate registered task names across all online workers."""
    workers = celery_client.get_workers()
    names: set[str] = set()
    for w in workers:
        for name in w.get("registered_tasks", []):
            names.add(name)
    return sorted(names)


class TriggerRequest(BaseModel):
    task_name: str
    args: list[Any] = []
    kwargs: dict[str, Any] = {}
    countdown: float | None = None
    queue: str | None = None


@router.post("/trigger")
def trigger_task(body: TriggerRequest):
    app = celery_client.get_celery_app()
    result = app.send_task(
        body.task_name,
        args=body.args,
        kwargs=body.kwargs,
        countdown=body.countdown,
        queue=body.queue,
    )
    return {"task_id": result.id, "task_name": body.task_name}


@router.get("")
def list_tasks(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    state: str | None = Query(None),
    search: str | None = Query(None),
):
    return store.all(limit=limit, offset=offset, state=state, search=search)


@router.get("/stats")
def task_stats():
    return store.stats()


@router.get("/{task_id}/graph")
def get_task_graph(task_id: str):
    graph = store.get_graph(task_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Task not found")
    return graph


@router.get("/{task_id}")
def get_task(task_id: str):
    record = store.get(task_id)
    if not record:
        raise HTTPException(status_code=404, detail="Task not found")
    return record.as_dict()


class RevokeRequest(BaseModel):
    terminate: bool = False


@router.post("/{task_id}/revoke")
def revoke_task(task_id: str, body: RevokeRequest = RevokeRequest()):
    celery_client.revoke_task(task_id, terminate=body.terminate)
    return {"status": "ok", "task_id": task_id}
