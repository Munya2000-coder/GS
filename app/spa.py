"""Mount the compiled React SPA.

`vite build` emits to `app/static/`. When that directory exists we mount
its assets and serve `index.html` as a catch-all so client-side routing
(React Router) works for direct links and refreshes.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

SPA_DIR = Path(__file__).parent / "static"


def mount_spa(app: FastAPI) -> None:
    from app.core.config import get_settings

    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    )

    if not SPA_DIR.exists():
        return

    assets_dir = SPA_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    index_html = SPA_DIR / "index.html"
    if not index_html.exists():
        return

    @app.get("/app", include_in_schema=False)
    @app.get("/app/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str = ""):  # noqa: ARG001
        return FileResponse(str(index_html))
