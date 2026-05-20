"""Tests for the CLI entry point."""

import sys
from unittest.mock import patch

from celery_bloom.__main__ import main
from celery_bloom.config import settings


class TestMain:
    def test_default_args_run_uvicorn(self):
        with (
            patch("celery_bloom.__main__.uvicorn.run") as mock_run,
            patch("sys.argv", ["celery-bloom"]),
        ):
            main()
        mock_run.assert_called_once()
        _, kwargs = mock_run.call_args
        assert kwargs["host"] == settings.host
        assert kwargs["port"] == settings.port
        assert kwargs["factory"] is True

    def test_custom_broker_applied_to_settings(self):
        with (
            patch("celery_bloom.__main__.uvicorn.run"),
            patch("sys.argv", ["celery-bloom", "--broker", "redis://custom:6379/0"]),
        ):
            main()
        assert settings.broker_url == "redis://custom:6379/0"

    def test_custom_port_applied(self):
        with (
            patch("celery_bloom.__main__.uvicorn.run") as mock_run,
            patch("sys.argv", ["celery-bloom", "--port", "8080"]),
        ):
            main()
        _, kwargs = mock_run.call_args
        assert kwargs["port"] == 8080

    def test_custom_host_applied(self):
        with (
            patch("celery_bloom.__main__.uvicorn.run") as mock_run,
            patch("sys.argv", ["celery-bloom", "--host", "127.0.0.1"]),
        ):
            main()
        _, kwargs = mock_run.call_args
        assert kwargs["host"] == "127.0.0.1"

    def test_log_level_passed_to_uvicorn(self):
        with (
            patch("celery_bloom.__main__.uvicorn.run") as mock_run,
            patch("sys.argv", ["celery-bloom", "--log-level", "debug"]),
        ):
            main()
        _, kwargs = mock_run.call_args
        assert kwargs["log_level"] == "debug"
