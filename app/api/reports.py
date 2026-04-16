from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.services import reporting

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/trial-balance")
def trial_balance(
    entity_id: int,
    as_of: date,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
) -> dict[str, Any]:
    return reporting.trial_balance(session, entity_id, as_of)


@router.get("/capital-account")
def capital_account_statement(
    investor_id: int,
    entity_id: int,
    as_of: date,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
) -> dict[str, Any]:
    try:
        return reporting.capital_account_statement(session, investor_id, entity_id, as_of)
    except ValueError as ex:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(ex))


@router.get("/contrib-distrib")
def contribution_distribution(
    entity_id: int,
    as_of: date,
    investor_id: int | None = None,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
) -> dict[str, Any]:
    return reporting.contribution_distribution_statement(session, entity_id, as_of, investor_id)


@router.get("/waterfall/{run_id}")
def waterfall_summary(
    run_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
) -> dict[str, Any]:
    try:
        return reporting.waterfall_summary(session, run_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(ex))


@router.get("/fees/{run_id}")
def fee_accrual_report(
    run_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
) -> dict[str, Any]:
    try:
        return reporting.fee_accrual_report(session, run_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(ex))
