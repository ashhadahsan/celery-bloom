"""In-memory task store populated by the Celery event receiver."""

from __future__ import annotations

import time
from collections import OrderedDict, defaultdict
from dataclasses import dataclass, field
from typing import Literal

from celery_bloom.config import settings

TaskState = Literal["PENDING", "RECEIVED", "STARTED", "SUCCESS", "FAILURE", "REVOKED", "RETRY"]


@dataclass
class TaskRecord:
    uuid: str
    name: str | None = None
    state: TaskState = "PENDING"
    worker: str | None = None
    args: str | None = None
    kwargs: str | None = None
    result: str | None = None
    traceback: str | None = None
    received: float | None = None
    started: float | None = None
    succeeded: float | None = None
    failed: float | None = None
    retried: float | None = None
    revoked: float | None = None
    runtime: float | None = None
    retries: int = 0
    eta: float | None = None
    expires: float | None = None
    timestamp: float = field(default_factory=time.time)
    # Canvas / chain relationships
    parent_id: str | None = None
    root_id: str | None = None
    group_id: str | None = None

    def as_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}


class TaskStore:
    def __init__(self, limit: int = 10_000) -> None:
        self._tasks: OrderedDict[str, TaskRecord] = OrderedDict()
        self._limit = limit
        # parent_id -> [child task_ids]  (chain relationships)
        self._children: dict[str, list[str]] = defaultdict(list)
        # group_id -> [task_ids]
        self._groups: dict[str, list[str]] = defaultdict(list)

    def update(self, event: dict) -> TaskRecord:
        task_id = event["uuid"]
        if task_id not in self._tasks:
            self._tasks[task_id] = TaskRecord(uuid=task_id)
            if len(self._tasks) > self._limit:
                self._tasks.popitem(last=False)

        record = self._tasks[task_id]
        etype = event.get("type", "")

        if "name" in event and event["name"]:
            record.name = event["name"]
        if "hostname" in event:
            record.worker = event["hostname"]
        if "args" in event:
            record.args = str(event["args"])
        if "kwargs" in event:
            record.kwargs = str(event["kwargs"])

        ts = event.get("timestamp", time.time())

        if etype == "task-received":
            record.state = "RECEIVED"
            record.received = ts
            record.eta = event.get("eta")
            record.expires = event.get("expires")
            record.retries = event.get("retries", 0)

            # Track chain/group/chord parentage
            parent_id = event.get("parent_id")
            root_id = event.get("root_id")
            group_id = event.get("group")

            if parent_id and record.parent_id != parent_id:
                record.parent_id = parent_id
                if task_id not in self._children[parent_id]:
                    self._children[parent_id].append(task_id)

            if root_id:
                record.root_id = root_id

            if group_id and record.group_id != group_id:
                record.group_id = group_id
                if task_id not in self._groups[group_id]:
                    self._groups[group_id].append(task_id)

        elif etype == "task-started":
            record.state = "STARTED"
            record.started = ts
        elif etype == "task-succeeded":
            record.state = "SUCCESS"
            record.succeeded = ts
            record.result = str(event.get("result", ""))
            record.runtime = event.get("runtime")
        elif etype == "task-failed":
            record.state = "FAILURE"
            record.failed = ts
            record.traceback = event.get("traceback", "")
            record.result = str(event.get("exception", ""))
        elif etype == "task-retried":
            record.state = "RETRY"
            record.retried = ts
            record.retries += 1
        elif etype == "task-revoked":
            record.state = "REVOKED"
            record.revoked = ts

        record.timestamp = ts
        return record

    def get_graph(self, task_id: str) -> dict | None:
        """Return nodes + edges for the execution graph containing task_id."""
        if task_id not in self._tasks:
            return None

        # Walk up to the true root
        root_id = self._find_root(task_id)

        # BFS from root, collecting all reachable tasks
        visited: set[str] = set()
        queue = [root_id]
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            for child in self._children.get(current, []):
                queue.append(child)
            # Also include group siblings
            rec = self._tasks.get(current)
            if rec and rec.group_id:
                for sibling in self._groups.get(rec.group_id, []):
                    if sibling not in visited:
                        queue.append(sibling)

        nodes = []
        edges = []

        for tid in visited:
            rec = self._tasks.get(tid)
            if not rec:
                continue
            nodes.append(
                {
                    **rec.as_dict(),
                    "is_root": tid == root_id,
                }
            )
            # Chain edge: parent → child
            if rec.parent_id and rec.parent_id in visited:
                edges.append(
                    {
                        "id": f"{rec.parent_id}->{tid}",
                        "source": rec.parent_id,
                        "target": tid,
                        "type": "chain",
                    }
                )

        return {"nodes": nodes, "edges": edges, "root_id": root_id}

    def _find_root(self, task_id: str) -> str:
        """Walk parent_id links to find the chain root."""
        seen = set()
        current = task_id
        while True:
            if current in seen:
                break
            seen.add(current)
            rec = self._tasks.get(current)
            if not rec or not rec.parent_id or rec.parent_id not in self._tasks:
                break
            current = rec.parent_id
        return current

    def all(
        self, limit: int = 100, offset: int = 0, state: str | None = None, search: str | None = None
    ) -> dict:
        tasks = list(reversed(self._tasks.values()))
        if state:
            tasks = [t for t in tasks if t.state == state.upper()]
        if search:
            s = search.lower()
            tasks = [t for t in tasks if s in (t.name or "").lower() or s in t.uuid.lower()]
        total = len(tasks)
        return {"total": total, "tasks": [t.as_dict() for t in tasks[offset : offset + limit]]}

    def get(self, task_id: str) -> TaskRecord | None:
        return self._tasks.get(task_id)

    def stats(self) -> dict:
        counts: dict[str, int] = {}
        for t in self._tasks.values():
            counts[t.state] = counts.get(t.state, 0) + 1
        return {"total": len(self._tasks), "by_state": counts}


store = TaskStore(limit=settings.task_history_limit)
