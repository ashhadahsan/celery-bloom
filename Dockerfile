FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies (cached layer)
COPY pyproject.toml ./
RUN uv sync --no-install-project

# Copy source
COPY README.md hatch_build.py ./
COPY celery_bloom/ ./celery_bloom/
COPY example/ ./example/

# Install the project itself — skip frontend build, static/ is already built
RUN CELERY_BLOOM_SKIP_UI_BUILD=1 uv sync
