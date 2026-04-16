"""Production entrypoint.

Runs any pending Alembic migrations and returns the FastAPI app. Designed
to be used under gunicorn:

    gunicorn app.entrypoint:app -k uvicorn.workers.UvicornWorker

Dev-admin auto-provisioning still runs on startup via the lifespan hook
when ENVIRONMENT=development. In production that hook is a no-op, so
operators must provision users via /admin/users.
"""

from __future__ import annotations

import logging

from alembic import command
from alembic.config import Config

from app.core.config import get_settings
from app.main import app as _app

logger = logging.getLogger("gs.entrypoint")


def run_migrations() -> None:
    settings = get_settings()
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    logger.info("running alembic upgrade head against %s", settings.database_url.split("@")[-1])
    command.upgrade(cfg, "head")


if get_settings().environment != "test":
    try:
        run_migrations()
    except Exception:
        logger.exception("alembic upgrade failed; startup continuing")

app = _app
