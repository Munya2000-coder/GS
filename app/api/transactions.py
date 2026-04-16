from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.transaction import ImportBatch, ImportException, Transaction
from app.schemas.transaction import (
    ImportRequest,
    ImportResultOut,
    JournalEntryOut,
    JournalLineOut,
    TransactionOut,
)
from app.services import accounting

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("/import", response_model=ImportResultOut, status_code=201)
def import_transactions(
    payload: ImportRequest,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    result = accounting.import_transactions(
        session,
        user=user,
        source_system=payload.source_system,
        source_owner=payload.source_owner,
        mapping_version=payload.mapping_version,
        file_name=payload.file_name,
        records=payload.records,
    )
    session.commit()
    return result


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    entity_id: int | None = None,
    state: str | None = None,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    q = session.query(Transaction)
    if entity_id is not None:
        q = q.filter(Transaction.entity_id == entity_id)
    if state is not None:
        q = q.filter(Transaction.state == state)
    return q.order_by(Transaction.transaction_date.desc()).limit(500).all()


@router.post("/{tx_id}/approve", response_model=TransactionOut)
def approve_transaction(
    tx_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.APPROVE)),
):
    try:
        tx = accounting.approve_transaction(session, user, tx_id)
    except (ValueError, PermissionError) as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(tx)
    return tx


@router.post("/{tx_id}/post", response_model=JournalEntryOut)
def post_transaction(
    tx_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.POST)),
):
    try:
        entry = accounting.post_transaction(session, user, tx_id)
    except (ValueError, PermissionError) as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(entry)
    return JournalEntryOut(
        id=entry.id,
        entity_id=entry.entity_id,
        period_id=entry.period_id,
        entry_date=entry.entry_date,
        description=entry.description,
        rule_version=entry.rule_version,
        source_transaction_id=entry.source_transaction_id,
        lines=[
            JournalLineOut(
                account_code=line.account.code,
                debit=line.debit,
                credit=line.credit,
                currency=line.currency,
                capital_account_id=line.capital_account_id,
                memo=line.memo,
            )
            for line in entry.lines
        ],
    )


@router.get("/batches/{batch_id}/exceptions")
def list_batch_exceptions(
    batch_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    if not session.get(ImportBatch, batch_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "batch not found")
    excs = session.query(ImportException).filter(ImportException.batch_id == batch_id).all()
    return [
        {
            "id": e.id,
            "row_number": e.row_number,
            "code": e.code,
            "message": e.message,
            "status": e.status,
            "owner_user_id": e.owner_user_id,
            "remediation_note": e.remediation_note,
        }
        for e in excs
    ]
