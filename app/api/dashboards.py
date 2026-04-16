from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.services import dashboards

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@router.get("/platform")
def platform(
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    return dashboards.platform_summary(session)


@router.get("/fund/{entity_id}")
def fund(
    entity_id: int,
    as_of: date,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    try:
        return dashboards.fund_summary(session, entity_id, as_of)
    except ValueError as ex:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(ex))


@router.get("/operations")
def operations(
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    return dashboards.operations_dashboard(session)
