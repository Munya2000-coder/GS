from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import __version__
from app.api import (
    admin,
    audit,
    capital_calls,
    dashboards,
    distributions,
    entities,
    exports,
    fees,
    integrations,
    investors,
    jobs,
    nav,
    performance,
    periods,
    reconciliation,
    reports,
    transactions,
    waterfall,
)
from app.core.database import ensure_dev_admin, init_db
from app.schemas.common import HealthResponse
from app.ui import routes as ui_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    created = ensure_dev_admin()
    if created:
        import logging
        logging.getLogger("uvicorn").warning(
            "[dev] auto-provisioned sys_admin user %r — log in at /ui/login "
            "or pass header: X-User-Id: %s",
            created, created,
        )
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="GS Private Capital Suite",
        version=__version__,
        description=(
            "Private capital operations platform: fund accounting, fees, carry, "
            "reporting, audit.\n\n"
            "**Authentication (dev):** all endpoints require the `X-User-Id` "
            "header. Click **Authorize** and enter a username such as "
            "`dev-admin` (auto-created in development) or one of the seeded "
            "users `admin` / `alice` / `bob` / `charlie` after running "
            "`gsctl seed`. In production replace the `current_user` dependency "
            "with an SSO/OIDC integration."
        ),
        lifespan=lifespan,
    )

    @app.get("/health", response_model=HealthResponse, tags=["health"])
    def health() -> HealthResponse:
        return HealthResponse(status="ok", version=__version__)

    for r in (
        entities.router, investors.router, transactions.router,
        fees.router, waterfall.router, reports.router, audit.router,
        admin.router, reconciliation.router, integrations.router,
        periods.router, performance.router, capital_calls.router,
        distributions.router, nav.router, dashboards.router,
        exports.router, jobs.router, ui_routes.router,
    ):
        app.include_router(r)

    return app


app = create_app()
