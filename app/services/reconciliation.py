"""Reconciliation and exception services (Epic 11)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.models.reconciliation import Reconciliation, ReconciliationStatus
from app.models.transaction import ImportBatch, ImportException, Transaction
from app.services import audit


def reconcile_batch_to_source_totals(
    session: Session,
    *,
    batch_id: int,
    expected_count: int,
    expected_total: Decimal,
    user: AuthUser,
) -> Reconciliation:
    batch = session.get(ImportBatch, batch_id)
    if not batch:
        raise ValueError(f"batch {batch_id} not found")

    txs = session.query(Transaction).filter(Transaction.batch_id == batch_id).all()
    actual_count = len(txs)
    actual_total = Decimal(sum((t.amount for t in txs), Decimal("0")))

    variance = actual_total - expected_total
    status = (
        ReconciliationStatus.MATCHED
        if actual_count == expected_count and variance == 0
        else ReconciliationStatus.BREAK
    )

    rec = Reconciliation(
        entity_id=txs[0].entity_id if txs else 0,
        name=f"import-batch-{batch_id}",
        reconciliation_type="import_to_source",
        source_total=expected_total,
        target_total=actual_total,
        variance=variance,
        status=status,
    )
    session.add(rec)
    audit.log_event(
        session, actor_user_id=user.id, action="reconcile.import_source",
        object_type="import_batch", object_id=batch_id,
        after={
            "expected_count": expected_count, "actual_count": actual_count,
            "variance": str(variance), "status": status,
        },
    )
    return rec


def assign_exception_owner(
    session: Session, user: AuthUser, exception_id: int, owner_user_id: int, note: str
) -> ImportException:
    exc = session.get(ImportException, exception_id)
    if not exc:
        raise ValueError(f"exception {exception_id} not found")
    exc.owner_user_id = owner_user_id
    exc.remediation_note = note
    exc.status = "assigned"
    audit.log_event(
        session, actor_user_id=user.id, action="exception.assign",
        object_type="import_exception", object_id=exception_id,
        after={"owner": owner_user_id, "note": note},
    )
    return exc
