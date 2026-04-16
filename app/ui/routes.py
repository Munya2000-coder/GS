"""Legacy Jinja UI routes — now just redirects to the React SPA at /app/.

The SPA is the canonical interface. These routes exist solely to stop
bookmarks and embedded links to /ui/* from 404-ing after the migration.
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import RedirectResponse

router = APIRouter(tags=["ui"], include_in_schema=False)


@router.get("/")
def root() -> RedirectResponse:
    return RedirectResponse("/app/", status_code=302)


@router.get("/ui")
@router.get("/ui/")
@router.get("/ui/{path:path}")
def ui_redirect(path: str = "") -> RedirectResponse:
    # Map common legacy paths to their SPA equivalents; otherwise land at root.
    targets = {
        "": "/app/",
        "login": "/app/login",
        "funds": "/app/funds",
        "investors": "/app/investors",
        "operations": "/app/operations",
    }
    target = targets.get(path.rstrip("/"), "/app/")
    return RedirectResponse(target, status_code=302)
