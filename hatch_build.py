"""
Hatch build hook — runs `npm install && npm run build` in ui/ before
assembling the wheel, so the compiled React SPA is bundled into the package.

Skip with: CELERY_BLOOM_SKIP_UI_BUILD=1 uv build
(useful when you've already built the frontend and just want to repackage)
"""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class CustomBuildHook(BuildHookInterface):
    PLUGIN_NAME = "custom"

    def initialize(self, version: str, build_data: dict) -> None:
        if os.environ.get("CELERY_BLOOM_SKIP_UI_BUILD"):
            self.app.display_info("Skipping UI build (CELERY_BLOOM_SKIP_UI_BUILD set)")
            return

        ui_dir = Path(self.root) / "ui"
        static_dir = Path(self.root) / "celery_bloom" / "static"

        if not ui_dir.exists():
            raise RuntimeError(f"ui/ directory not found at {ui_dir}")

        npm = shutil.which("npm")
        if not npm:
            raise RuntimeError(
                "npm not found — install Node.js to build the frontend, "
                "or set CELERY_BLOOM_SKIP_UI_BUILD=1 if static/ is already built."
            )

        self.app.display_info("Installing frontend dependencies…")
        subprocess.run([npm, "install"], cwd=ui_dir, check=True)

        self.app.display_info("Building frontend…")
        subprocess.run([npm, "run", "build"], cwd=ui_dir, check=True)

        # Sanity check — vite should have written index.html
        if not (static_dir / "index.html").exists():
            raise RuntimeError(
                f"Frontend build completed but {static_dir}/index.html is missing. "
                "Check the Vite build output above."
            )

        self.app.display_info(f"Frontend built → {static_dir}")
