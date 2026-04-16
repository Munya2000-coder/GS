from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.capital_call import CapitalCall, CashEventPurpose
from app.services import capital_calls

router = APIRouter(prefix="/capital-calls", tags=["capital-calls"])


class CapitalCallCreate(BaseModel):
    entity_id: int
    call_number: str
    notice_date: date
    due_date: date
    total_amount: Decimal
    currency: str
    purpose: CashEventPurpose = CashEventPurpose.INVESTMENT


@router.post("", status_code=201)
def create_call(
    payload: CapitalCallCreate,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    try:
        call = capital_calls.generate_capital_call(session, user=user, **payload.model_dump())
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(call)
    return _serialise_call(call)


@router.get("")
def list_calls(
    entity_id: int | None = None,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    q = session.query(CapitalCall)
    if entity_id is not None:
        q = q.filter(CapitalCall.entity_id == entity_id)
    return [_serialise_call(c) for c in q.order_by(CapitalCall.id.desc()).all()]


@router.get("/{call_id}")
def get_call(
    call_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    call = session.get(CapitalCall, call_id)
    if not call:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "capital call not found")
    return _serialise_call(call)


@router.post("/{call_id}/approve")
def approve(
    call_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.APPROVE)),
):
    try:
        call = capital_calls.approve_capital_call(session, user, call_id)
    except (ValueError, PermissionError) as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(call)
    return _serialise_call(call)


@router.post("/{call_id}/fund")
def fund(
    call_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.POST)),
):
    try:
        txs = capital_calls.record_funding(session, user=user, call_id=call_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    return {
        "funded_transaction_ids": [t.id for t in txs],
        "total": str(sum((t.amount for t in txs), Decimal("0"))),
    }


def _serialise_call(call: CapitalCall) -> dict:
    return {
        "id": call.id,
        "entity_id": call.entity_id,
        "call_number": call.call_number,
        "notice_date": str(call.notice_date),
        "due_date": str(call.due_date),
        "total_amount": str(call.total_amount),
        "currency": call.currency,
        "purpose": call.purpose,
        "state": call.state,
        "allocations": [
            {
                "investor_id": a.investor_id,
                "capital_account_id": a.capital_account_id,
                "share": str(a.pro_rata_share),
                "amount": str(a.allocated_amount),
            }
            for a in call.allocations
        ],
    }
