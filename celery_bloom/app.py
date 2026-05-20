from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from celery_bloom.api import tasks, workers, events
from celery_bloom.event_receiver import start_event_receiver

logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_event_loop()
    thread = start_event_receiver(loop)
    logger.info("celery-bloom started")
    yield
    logger.info("celery-bloom shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="celery-bloom",
        description="Modern UI for Celery monitoring",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(tasks.router)
    app.include_router(workers.router)
    app.include_router(events.router)

    # Serve the React SPA — only mount if built assets exist
    if STATIC_DIR.exists() and any(STATIC_DIR.iterdir()):
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa_fallback(full_path: str):
            return FileResponse(STATIC_DIR / "index.html")

    return app
