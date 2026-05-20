"""Unit tests for TaskStore — no Celery or Redis needed."""

import time
import pytest

from celery_bloom.task_store import TaskStore, TaskRecord


def make_event(task_id: str, etype: str, **kwargs) -> dict:
    return {"uuid": task_id, "type": etype, "timestamp": time.time(), **kwargs}


class TestTaskStoreUpdate:
    def test_creates_record_on_first_event(self):
        store = TaskStore()
        rec = store.update(make_event("t1", "task-received", name="myapp.add"))
        assert rec.uuid == "t1"
        assert rec.name == "myapp.add"
        assert rec.state == "RECEIVED"

    def test_state_transitions(self):
        store = TaskStore()
        store.update(make_event("t1", "task-received", name="myapp.add"))
        store.update(make_event("t1", "task-started"))
        store.update(make_event("t1", "task-succeeded", result=42, runtime=0.5))
        rec = store.get("t1")
        assert rec is not None
        assert rec.state == "SUCCESS"
        assert rec.result == "42"
        assert rec.runtime == 0.5

    def test_failure_records_traceback(self):
        store = TaskStore()
        store.update(make_event("t1", "task-received", name="myapp.flaky"))
        store.update(make_event("t1", "task-failed", exception="ValueError('oops')", traceback="Traceback..."))
        rec = store.get("t1")
        assert rec is not None
        assert rec.state == "FAILURE"
        assert "ValueError" in (rec.result or "")
        assert rec.traceback == "Traceback..."

    def test_retry_increments_counter(self):
        store = TaskStore()
        store.update(make_event("t1", "task-received", name="myapp.flaky", retries=0))
        store.update(make_event("t1", "task-retried"))
        store.update(make_event("t1", "task-retried"))
        rec = store.get("t1")
        assert rec is not None
        assert rec.state == "RETRY"
        assert rec.retries == 2

    def test_revoke(self):
        store = TaskStore()
        store.update(make_event("t1", "task-received", name="myapp.add"))
        store.update(make_event("t1", "task-revoked"))
        rec = store.get("t1")
        assert rec is not None
        assert rec.state == "REVOKED"
        assert rec.revoked is not None

    def test_tracks_parentage_in_children_index(self):
        store = TaskStore()
        store.update(make_event("parent", "task-received", name="myapp.root"))
        store.update(make_event("child", "task-received", name="myapp.next", parent_id="parent", root_id="parent"))
        assert "child" in store._children["parent"]

    def test_tracks_group_membership(self):
        store = TaskStore()
        store.update(make_event("t1", "task-received", name="myapp.work", group="g1"))
        store.update(make_event("t2", "task-received", name="myapp.work", group="g1"))
        assert "t1" in store._groups["g1"]
        assert "t2" in store._groups["g1"]

    def test_limit_evicts_oldest(self):
        store = TaskStore(limit=3)
        for i in range(4):
            store.update(make_event(f"t{i}", "task-received", name="myapp.add"))
        assert store.get("t0") is None
        assert store.get("t3") is not None


class TestTaskStoreQuery:
    def setup_method(self):
        self.store = TaskStore()
        self.store.update(make_event("a1", "task-received", name="myapp.add"))
        self.store.update(make_event("a1", "task-succeeded", result=1))
        self.store.update(make_event("b1", "task-received", name="myapp.flaky"))
        self.store.update(make_event("b1", "task-failed", exception="Err", traceback=""))
        self.store.update(make_event("c1", "task-received", name="myapp.slow"))

    def test_all_returns_all_tasks(self):
        result = self.store.all()
        assert result["total"] == 3

    def test_filter_by_state(self):
        result = self.store.all(state="SUCCESS")
        assert result["total"] == 1
        assert result["tasks"][0]["uuid"] == "a1"

    def test_filter_by_state_case_insensitive(self):
        result = self.store.all(state="failure")
        assert result["total"] == 1

    def test_search_by_name(self):
        result = self.store.all(search="slow")
        assert result["total"] == 1
        assert result["tasks"][0]["uuid"] == "c1"

    def test_search_by_uuid(self):
        result = self.store.all(search="b1")
        assert result["total"] == 1

    def test_pagination(self):
        result = self.store.all(limit=2, offset=0)
        assert len(result["tasks"]) == 2

    def test_offset(self):
        result = self.store.all(limit=10, offset=2)
        assert len(result["tasks"]) == 1

    def test_stats(self):
        s = self.store.stats()
        assert s["total"] == 3
        assert s["by_state"]["SUCCESS"] == 1
        assert s["by_state"]["FAILURE"] == 1
        assert s["by_state"]["RECEIVED"] == 1


class TestTaskGraph:
    def setup_method(self):
        self.store = TaskStore()

    def test_get_graph_unknown_task(self):
        assert self.store.get_graph("nonexistent") is None

    def test_single_task_graph(self):
        self.store.update(make_event("t1", "task-received", name="myapp.add"))
        graph = self.store.get_graph("t1")
        assert graph is not None
        assert len(graph["nodes"]) == 1
        assert graph["nodes"][0]["uuid"] == "t1"
        assert graph["nodes"][0]["is_root"] is True
        assert graph["edges"] == []

    def test_chain_graph_edges(self):
        self.store.update(make_event("root", "task-received", name="myapp.step1"))
        self.store.update(make_event("child", "task-received", name="myapp.step2", parent_id="root", root_id="root"))
        self.store.update(make_event("grandchild", "task-received", name="myapp.step3", parent_id="child", root_id="root"))

        graph = self.store.get_graph("grandchild")
        assert graph is not None
        assert graph["root_id"] == "root"
        assert len(graph["nodes"]) == 3
        sources = {e["source"] for e in graph["edges"]}
        assert "root" in sources
        assert "child" in sources

    def test_find_root_walks_to_top(self):
        self.store.update(make_event("r", "task-received", name="myapp.a"))
        self.store.update(make_event("m", "task-received", name="myapp.b", parent_id="r", root_id="r"))
        self.store.update(make_event("l", "task-received", name="myapp.c", parent_id="m", root_id="r"))
        assert self.store._find_root("l") == "r"

    def test_record_as_dict(self):
        self.store.update(make_event("t1", "task-received", name="myapp.add"))
        rec = self.store.get("t1")
        assert rec is not None
        d = rec.as_dict()
        assert d["uuid"] == "t1"
        assert "state" in d
