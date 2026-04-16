from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.nav import NavSnapshot
from app.services import nav

router = APIRouter(prefix="/nav", tags=["nav"])


class NavPublish(BaseModel):
    entity_id: int
    as_of: date
    gross_asset_value: Decimal
    liabilities: Decimal = Decimal("0")
    currency: str
    investor_id: int | None = None
    capital_account_id: int | None = None
    source_reference: str | None = None


@router.post("", status_code=201)
def publish(
    payload: NavPublish,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    snap = nav.publish_nav(session, user=user, **payload.model_dump())
    session.commit()
    session.refresh(snap)
    return _serialise(snap)


@router.get("")
def list_navs(
    entity_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    rows = (
        session.query(NavSnapshot)
        .filter(NavSnapshot.entity_id == entity_id)
        .order_by(NavSnapshot.as_of.desc())
        .all()
    )
    return [_serialise(r) for r in rows]


def _serialise(snap: NavSnapshot) -> dict:
    return {
        "id": snap.id,
        "entity_id": snap.entity_id,
        "investor_id": snap.investor_id,
        "as_of": str(snap.as_of),
        "gross_asset_value": str(snap.gross_asset_value),
        "liabilities": str(snap.liabilities),
        "ending_nav": str(snap.ending_nav),
        "currency": snap.currency,
        "source_reference": snap.source_reference,
    }
