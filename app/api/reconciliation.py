from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.services import reconciliation

router = APIRouter(prefix="/reconciliation", tags=["reconciliation"])


class ReconcileRequest(BaseModel):
    batch_id: int
    expected_count: int
    expected_total: Decimal


class AssignExceptionRequest(BaseModel):
    owner_user_id: int
    note: str


@router.post("/batch", status_code=201)
def reconcile_batch(
    payload: ReconcileRequest,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    try:
        rec = reconciliation.reconcile_batch_to_source_totals(
            session,
            batch_id=payload.batch_id,
            expected_count=payload.expected_count,
            expected_total=payload.expected_total,
            user=user,
        )
    except ValueError as ex:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(ex))
    session.commit()
    return {
        "id": rec.id,
        "status": rec.status,
        "source_total": str(rec.source_total),
        "target_total": str(rec.target_total),
        "variance": str(rec.variance),
    }


@router.post("/exceptions/{exception_id}/assign")
def assign_exception(
    exception_id: int,
    payload: AssignExceptionRequest,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.EDIT)),
):
    try:
        exc = reconciliation.assign_exception_owner(
            session, user, exception_id, payload.owner_user_id, payload.note
        )
    except ValueError as ex:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(ex))
    session.commit()
    return {"id": exc.id, "status": exc.status, "owner": exc.owner_user_id, "note": exc.remediation_note}
