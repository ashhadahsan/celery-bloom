"""CLI entry point: celery-bloom --broker redis://localhost:6379/0"""

from __future__ import annotations

import argparse
import logging

import uvicorn

from celery_bloom.config import settings


def main() -> None:
    parser = argparse.ArgumentParser(description="celery-bloom — modern Celery monitoring UI")
    parser.add_argument("--broker", default=settings.broker_url, help="Celery broker URL")
    parser.add_argument(
        "--result-backend", default=settings.result_backend, help="Celery result backend URL"
    )
    parser.add_argument("--host", default=settings.host)
    parser.add_argument("--port", type=int, default=settings.port)
    parser.add_argument(
        "--log-level", default="info", choices=["debug", "info", "warning", "error"]
    )
    args = parser.parse_args()

    settings.broker_url = args.broker
    settings.result_backend = args.result_backend
    settings.host = args.host
    settings.port = args.port

    logging.basicConfig(level=args.log_level.upper())

    uvicorn.run(
        "celery_bloom.app:create_app",
        factory=True,
        host=args.host,
        port=args.port,
        log_level=args.log_level,
    )


if __name__ == "__main__":
    main()
