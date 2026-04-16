from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import __version__
from app.api import (
    admin,
    audit,
    entities,
    fees,
    integrations,
    investors,
    reconciliation,
    reports,
    transactions,
    waterfall,
)
from app.core.database import init_db
from app.schemas.common import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="GS Private Capital Suite",
        version=__version__,
        description="Private capital operations platform: fund accounting, fees, carry, reporting, audit.",
        lifespan=lifespan,
    )

    @app.get("/health", response_model=HealthResponse, tags=["health"])
    def health() -> HealthResponse:
        return HealthResponse(status="ok", version=__version__)

    app.include_router(entities.router)
    app.include_router(investors.router)
    app.include_router(transactions.router)
    app.include_router(fees.router)
    app.include_router(waterfall.router)
    app.include_router(reports.router)
    app.include_router(audit.router)
    app.include_router(admin.router)
    app.include_router(reconciliation.router)
    app.include_router(integrations.router)

    return app


app = create_app()
