from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.period import AccountingPeriod, CloseStep, PeriodType
from app.services import close as close_svc

router = APIRouter(prefix="/periods", tags=["periods"])


class PeriodCreate(BaseModel):
    entity_id: int
    period_type: PeriodType
    any_date: date


class PeriodReopen(BaseModel):
    reason: str


class CloseStepCreate(BaseModel):
    name: str
    owner_user_id: int | None = None
    due_date: date | None = None
    depends_on_step_id: int | None = None


@router.post("", status_code=201)
def ensure_period(
    payload: PeriodCreate,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    period = close_svc.ensure_period(
        session, entity_id=payload.entity_id,
        period_type=payload.period_type, any_date=payload.any_date,
    )
    session.commit()
    session.refresh(period)
    return _serialise(period)


@router.get("")
def list_periods(
    entity_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    rows = session.query(AccountingPeriod).filter(
        AccountingPeriod.entity_id == entity_id
    ).order_by(AccountingPeriod.period_start.desc()).all()
    return [_serialise(r) for r in rows]


@router.post("/{period_id}/soft-close")
def soft_close(
    period_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.APPROVE)),
):
    try:
        period = close_svc.soft_close(session, user, period_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(period)
    return _serialise(period)


@router.post("/{period_id}/close")
def close_period(
    period_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.APPROVE)),
):
    try:
        period = close_svc.hard_close(session, user, period_id)
    except (ValueError, PermissionError) as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(period)
    return _serialise(period)


@router.post("/{period_id}/reopen")
def reopen_period(
    period_id: int,
    payload: PeriodReopen,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.APPROVE)),
):
    try:
        period = close_svc.reopen(session, user, period_id, payload.reason)
    except (ValueError, PermissionError) as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(period)
    return _serialise(period)


@router.post("/{period_id}/steps", status_code=201)
def create_step(
    period_id: int,
    payload: CloseStepCreate,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    step = close_svc.add_close_step(
        session, user=user, period_id=period_id, **payload.model_dump()
    )
    session.commit()
    session.refresh(step)
    return _serialise_step(step)


@router.post("/steps/{step_id}/sign-off")
def sign_off(
    step_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.APPROVE)),
):
    try:
        step = close_svc.sign_off_step(session, user, step_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(step)
    return _serialise_step(step)


@router.get("/{period_id}/steps")
def list_steps(
    period_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    steps = session.query(CloseStep).filter(CloseStep.period_id == period_id).all()
    return [_serialise_step(s) for s in steps]


def _serialise(period: AccountingPeriod) -> dict:
    return {
        "id": period.id, "entity_id": period.entity_id,
        "period_type": period.period_type,
        "period_start": str(period.period_start),
        "period_end": str(period.period_end),
        "status": period.status,
        "reopen_reason": period.reopen_reason,
    }


def _serialise_step(step: CloseStep) -> dict:
    return {
        "id": step.id,
        "period_id": step.period_id,
        "name": step.name,
        "owner_user_id": step.owner_user_id,
        "due_date": str(step.due_date) if step.due_date else None,
        "depends_on_step_id": step.depends_on_step_id,
        "status": step.status,
        "signed_off_by_user_id": step.signed_off_by_user_id,
    }
