"""Integration tests for FastAPI endpoints using TestClient."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from celery_bloom.app import create_app
from celery_bloom.task_store import TaskStore, store as global_store
from celery_bloom.api import tasks as tasks_module


@pytest.fixture()
def fresh_store(monkeypatch):
    """Replace the global store with an empty one for each test."""
    s = TaskStore()
    monkeypatch.setattr(tasks_module, "store", s)
    return s


@pytest.fixture()
def client(fresh_store):
    # Patch out the Celery event receiver thread so tests don't need Redis
    with patch("celery_bloom.app.start_event_receiver", return_value=None):
        app = create_app()
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c


def seed_task(store: TaskStore, task_id: str, name: str, state: str = "SUCCESS"):
    import time

    store.update({"uuid": task_id, "type": "task-received", "timestamp": time.time(), "name": name})
    if state == "SUCCESS":
        store.update({"uuid": task_id, "type": "task-succeeded", "timestamp": time.time(), "result": 1})
    elif state == "FAILURE":
        store.update({"uuid": task_id, "type": "task-failed", "timestamp": time.time(), "exception": "Err", "traceback": ""})
    elif state == "STARTED":
        store.update({"uuid": task_id, "type": "task-started", "timestamp": time.time()})


class TestListTasks:
    def test_empty(self, client):
        resp = client.get("/api/tasks")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["tasks"] == []

    def test_returns_tasks(self, client, fresh_store):
        seed_task(fresh_store, "t1", "myapp.add")
        resp = client.get("/api/tasks")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    def test_filter_by_state(self, client, fresh_store):
        seed_task(fresh_store, "t1", "myapp.add", "SUCCESS")
        seed_task(fresh_store, "t2", "myapp.flaky", "FAILURE")
        resp = client.get("/api/tasks?state=SUCCESS")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["tasks"][0]["uuid"] == "t1"

    def test_search(self, client, fresh_store):
        seed_task(fresh_store, "t1", "myapp.add")
        seed_task(fresh_store, "t2", "myapp.slow")
        resp = client.get("/api/tasks?search=slow")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1


class TestGetTask:
    def test_not_found(self, client):
        resp = client.get("/api/tasks/does-not-exist")
        assert resp.status_code == 404

    def test_found(self, client, fresh_store):
        seed_task(fresh_store, "t1", "myapp.add")
        resp = client.get("/api/tasks/t1")
        assert resp.status_code == 200
        assert resp.json()["uuid"] == "t1"


class TestTaskStats:
    def test_empty_stats(self, client):
        resp = client.get("/api/tasks/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["by_state"] == {}

    def test_populated_stats(self, client, fresh_store):
        seed_task(fresh_store, "t1", "myapp.add", "SUCCESS")
        seed_task(fresh_store, "t2", "myapp.flaky", "FAILURE")
        resp = client.get("/api/tasks/stats")
        data = resp.json()
        assert data["total"] == 2
        assert data["by_state"]["SUCCESS"] == 1
        assert data["by_state"]["FAILURE"] == 1


class TestTaskGraph:
    def test_not_found(self, client):
        resp = client.get("/api/tasks/missing/graph")
        assert resp.status_code == 404

    def test_single_node_graph(self, client, fresh_store):
        seed_task(fresh_store, "t1", "myapp.add")
        resp = client.get("/api/tasks/t1/graph")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["nodes"]) == 1
        assert data["edges"] == []


class TestRegisteredTasks:
    def test_returns_sorted_list(self, client):
        mock_workers = [
            {"registered_tasks": ["myapp.b", "myapp.a"]},
            {"registered_tasks": ["myapp.c"]},
        ]
        with patch("celery_bloom.api.tasks.celery_client.get_workers", return_value=mock_workers):
            resp = client.get("/api/tasks/registered")
        assert resp.status_code == 200
        assert resp.json() == ["myapp.a", "myapp.b", "myapp.c"]

    def test_deduplicates_across_workers(self, client):
        mock_workers = [
            {"registered_tasks": ["myapp.add"]},
            {"registered_tasks": ["myapp.add"]},
        ]
        with patch("celery_bloom.api.tasks.celery_client.get_workers", return_value=mock_workers):
            resp = client.get("/api/tasks/registered")
        assert resp.json() == ["myapp.add"]


class TestTriggerTask:
    def test_trigger_returns_task_id(self, client):
        mock_result = MagicMock()
        mock_result.id = "new-task-uuid"
        mock_app = MagicMock()
        mock_app.send_task.return_value = mock_result
        with patch("celery_bloom.api.tasks.celery_client.get_celery_app", return_value=mock_app):
            resp = client.post("/api/tasks/trigger", json={"task_name": "myapp.add", "args": [1, 2]})
        assert resp.status_code == 200
        data = resp.json()
        assert data["task_id"] == "new-task-uuid"
        assert data["task_name"] == "myapp.add"
        mock_app.send_task.assert_called_once_with(
            "myapp.add", args=[1, 2], kwargs={}, countdown=None, queue=None
        )


class TestRevokeTask:
    def test_revoke(self, client):
        with patch("celery_bloom.api.tasks.celery_client.revoke_task") as mock_revoke:
            resp = client.post("/api/tasks/some-uuid/revoke", json={})
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
        mock_revoke.assert_called_once_with("some-uuid", terminate=False)

    def test_terminate(self, client):
        with patch("celery_bloom.api.tasks.celery_client.revoke_task") as mock_revoke:
            resp = client.post("/api/tasks/some-uuid/revoke", json={"terminate": True})
        assert resp.status_code == 200
        mock_revoke.assert_called_once_with("some-uuid", terminate=True)
