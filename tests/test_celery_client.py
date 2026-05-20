"""Tests for celery_client — all Celery calls mocked."""

from unittest.mock import MagicMock, patch

import celery_bloom.celery_client as cc


def _reset():
    cc._app = None


class TestGetCeleryApp:
    def test_creates_app_on_first_call(self):
        _reset()
        with patch("celery_bloom.celery_client.Celery") as MockCelery:
            mock_app = MagicMock()
            MockCelery.return_value = mock_app
            result = cc.get_celery_app()
        assert result is mock_app
        MockCelery.assert_called_once()

    def test_returns_cached_instance(self):
        _reset()
        with patch("celery_bloom.celery_client.Celery") as MockCelery:
            mock_app = MagicMock()
            MockCelery.return_value = mock_app
            app1 = cc.get_celery_app()
            app2 = cc.get_celery_app()
        assert app1 is app2
        assert MockCelery.call_count == 1

    def test_configures_broker_url(self):
        _reset()
        from celery_bloom.config import settings

        settings.broker_url = "redis://test:6379/0"
        with patch("celery_bloom.celery_client.Celery") as MockCelery:
            mock_app = MagicMock()
            MockCelery.return_value = mock_app
            cc.get_celery_app()
        call_kwargs = MockCelery.call_args[1]
        assert call_kwargs["broker"] == "redis://test:6379/0"


class TestInspect:
    def setup_method(self):
        _reset()

    def _make_app_with_inspect(self, method_return):
        mock_inspect = MagicMock()
        getattr(mock_inspect, "active").return_value = method_return
        mock_celery = MagicMock()
        mock_celery.control.inspect.return_value = mock_inspect
        return mock_celery, mock_inspect

    def test_returns_inspect_result(self):
        with patch("celery_bloom.celery_client.Celery") as MockCelery:
            mock_inspect = MagicMock()
            mock_inspect.active.return_value = {"w1": []}
            mock_app = MagicMock()
            mock_app.control.inspect.return_value = mock_inspect
            MockCelery.return_value = mock_app
            result = cc._inspect("active")
        assert result == {"w1": []}

    def test_returns_empty_dict_when_none(self):
        with patch("celery_bloom.celery_client.Celery") as MockCelery:
            mock_inspect = MagicMock()
            mock_inspect.stats.return_value = None
            mock_app = MagicMock()
            mock_app.control.inspect.return_value = mock_inspect
            MockCelery.return_value = mock_app
            result = cc._inspect("stats")
        assert result == {}


class TestGetWorkers:
    def setup_method(self):
        _reset()

    def _patch_inspect(self, active, stats, registered, scheduled, reserved):
        mock_inspect = MagicMock()
        mock_inspect.active.return_value = active
        mock_inspect.stats.return_value = stats
        mock_inspect.registered.return_value = registered
        mock_inspect.scheduled.return_value = scheduled
        mock_inspect.reserved.return_value = reserved
        mock_app = MagicMock()
        mock_app.control.inspect.return_value = mock_inspect
        return mock_app

    def test_returns_empty_list_when_no_workers(self):
        with patch("celery_bloom.celery_client.Celery") as MockCelery:
            MockCelery.return_value = self._patch_inspect({}, {}, {}, {}, {})
            workers = cc.get_workers()
        assert workers == []

    def test_aggregates_worker_data(self):
        worker = "celery@host"
        pool_stats = {"max-concurrency": 4, "processes": [1, 2, 3, 4]}
        worker_stats = {
            "pool": pool_stats,
            "total": {"myapp.add": 10},
            "prefetch_count": 4,
            "broker": {"transport": "redis"},
        }
        with patch("celery_bloom.celery_client.Celery") as MockCelery:
            MockCelery.return_value = self._patch_inspect(
                active={worker: [{"id": "t1"}]},
                stats={worker: worker_stats},
                registered={worker: ["myapp.add"]},
                scheduled={worker: []},
                reserved={worker: []},
            )
            workers = cc.get_workers()
        assert len(workers) == 1
        w = workers[0]
        assert w["name"] == worker
        assert w["status"] == "online"
        assert w["concurrency"] == 4
        assert w["registered_tasks"] == ["myapp.add"]
        assert w["active_tasks"] == [{"id": "t1"}]

    def test_handles_worker_in_active_but_not_stats(self):
        worker = "celery@host"
        with patch("celery_bloom.celery_client.Celery") as MockCelery:
            MockCelery.return_value = self._patch_inspect(
                active={worker: []},
                stats={},
                registered={},
                scheduled={},
                reserved={},
            )
            workers = cc.get_workers()
        assert len(workers) == 1
        assert workers[0]["concurrency"] is None


class TestRevokeTask:
    def setup_method(self):
        _reset()

    def test_calls_control_revoke(self):
        with patch("celery_bloom.celery_client.Celery") as MockCelery:
            mock_app = MagicMock()
            MockCelery.return_value = mock_app
            cc.revoke_task("abc-123", terminate=True)
        mock_app.control.revoke.assert_called_once_with("abc-123", terminate=True)

    def test_revoke_without_terminate(self):
        with patch("celery_bloom.celery_client.Celery") as MockCelery:
            mock_app = MagicMock()
            MockCelery.return_value = mock_app
            cc.revoke_task("abc-123", terminate=False)
        mock_app.control.revoke.assert_called_once_with("abc-123", terminate=False)
