from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.capital_call import CashEventPurpose, Distribution
from app.services import distributions

router = APIRouter(prefix="/distributions", tags=["distributions"])


class DistributionCreate(BaseModel):
    entity_id: int
    distribution_number: str
    notice_date: date
    payment_date: date
    total_amount: Decimal
    currency: str
    purpose: CashEventPurpose = CashEventPurpose.PROFIT
    recallable: bool = False


@router.post("", status_code=201)
def create_distribution(
    payload: DistributionCreate,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    try:
        dist = distributions.generate_distribution(session, user=user, **payload.model_dump())
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(dist)
    return _serialise(dist)


@router.get("")
def list_distributions(
    entity_id: int | None = None,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    q = session.query(Distribution)
    if entity_id is not None:
        q = q.filter(Distribution.entity_id == entity_id)
    return [_serialise(d) for d in q.order_by(Distribution.id.desc()).all()]


@router.get("/{dist_id}")
def get_distribution(
    dist_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    dist = session.get(Distribution, dist_id)
    if not dist:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    return _serialise(dist)


@router.post("/{dist_id}/approve")
def approve(
    dist_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.APPROVE)),
):
    try:
        dist = distributions.approve_distribution(session, user, dist_id)
    except (ValueError, PermissionError) as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(dist)
    return _serialise(dist)


@router.post("/{dist_id}/pay")
def pay(
    dist_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.POST)),
):
    try:
        txs = distributions.record_payout(session, user=user, dist_id=dist_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    return {
        "paid_transaction_ids": [t.id for t in txs],
        "total": str(sum((t.amount for t in txs), Decimal("0"))),
    }


def _serialise(dist: Distribution) -> dict:
    return {
        "id": dist.id,
        "entity_id": dist.entity_id,
        "distribution_number": dist.distribution_number,
        "notice_date": str(dist.notice_date),
        "payment_date": str(dist.payment_date),
        "total_amount": str(dist.total_amount),
        "currency": dist.currency,
        "purpose": dist.purpose,
        "recallable": dist.recallable,
        "state": dist.state,
        "allocations": [
            {
                "investor_id": a.investor_id,
                "capital_account_id": a.capital_account_id,
                "basis": str(a.allocation_basis),
                "share": str(a.pro_rata_share),
                "amount": str(a.allocated_amount),
            }
            for a in dist.allocations
        ],
    }
