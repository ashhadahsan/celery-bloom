.PHONY: install dev build ui-install ui-dev ui-build package check-package lint fmt typecheck

install:
	CELERY_BLOOM_SKIP_UI_BUILD=1 uv sync

fmt:
	uv run black celery_bloom/

typecheck:
	uv run mypy celery_bloom/

lint: fmt typecheck

ui-install:
	cd ui && npm install

ui-dev:
	cd ui && npm run dev

ui-build:
	cd ui && npm run build

dev: ui-build
	uv run celery-bloom

# Build wheel + sdist (hook builds frontend automatically)
build:
	uv build

# Skip frontend rebuild if static/ is already fresh
build-fast:
	CELERY_BLOOM_SKIP_UI_BUILD=1 uv build

# Install the built wheel into a temp venv and smoke-test the CLI
check-package:
	@echo "--- Installing wheel into /tmp/cb-test-env ---"
	uv venv /tmp/cb-test-env --python 3.12
	uv pip install --python /tmp/cb-test-env/bin/python dist/celery_bloom-*.whl
	@echo "--- Smoke test: celery-bloom --help ---"
	/tmp/cb-test-env/bin/celery-bloom --help
	@echo "--- Checking static assets bundled ---"
	python3 -c "import zipfile, glob, sys; \
		whl = glob.glob('dist/celery_bloom-*.whl')[0]; \
		files = zipfile.ZipFile(whl).namelist(); \
		has_index = any('static/index.html' in f for f in files); \
		print('index.html in wheel:', has_index); \
		sys.exit(0 if has_index else 1)"
	@echo "--- OK ---"
