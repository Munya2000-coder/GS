from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.services.performance import compute_metrics

router = APIRouter(prefix="/performance", tags=["performance"])


@router.get("")
def get_performance(
    entity_id: int,
    as_of: date,
    investor_id: int | None = None,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    return compute_metrics(session, entity_id=entity_id, investor_id=investor_id, as_of=as_of).as_dict()
