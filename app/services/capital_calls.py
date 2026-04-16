"""Capital call generation, allocation, approval, and funding."""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import AuthUser, Permission
from app.models.capital_account import CapitalAccount
from app.models.capital_call import (
    CapitalCall,
    CapitalCallAllocation,
    CashEventPurpose,
)
from app.models.investor import Commitment
from app.models.transaction import (
    ImportBatch,
    Transaction,
    TransactionState,
    TransactionType,
)
from app.models.workflow import WorkflowState
from app.services import audit, lineage


TWOPLACES = Decimal("0.01")


def _sys_batch(session: Session, user: AuthUser, tag: str) -> ImportBatch:
    batch = ImportBatch(
        source_system="system", source_owner=tag, mapping_version="internal",
        record_count=0, raw_payload="[]", submitted_by_user_id=user.id, status="system",
    )
    session.add(batch)
    session.flush()
    return batch


def generate_capital_call(
    session: Session,
    *,
    user: AuthUser,
    entity_id: int,
    call_number: str,
    notice_date: date,
    due_date: date,
    total_amount: Decimal,
    currency: str,
    purpose: CashEventPurpose = CashEventPurpose.INVESTMENT,
) -> CapitalCall:
    if session.query(CapitalCall).filter(
        CapitalCall.entity_id == entity_id, CapitalCall.call_number == call_number
    ).first():
        raise ValueError(f"call number {call_number} already exists for entity {entity_id}")

    commitments = session.query(Commitment).filter(Commitment.entity_id == entity_id).all()
    total_committed = sum((c.commitment_amount for c in commitments), Decimal("0"))
    if total_committed == 0:
        raise ValueError("no commitments found for entity")

    call = CapitalCall(
        entity_id=entity_id,
        call_number=call_number,
        notice_date=notice_date,
        due_date=due_date,
        total_amount=total_amount,
        currency=currency,
        purpose=purpose,
        state=WorkflowState.DRAFT,
        created_by_user_id=user.id,
    )
    session.add(call)
    session.flush()

    allocated_so_far = Decimal("0")
    ordered = sorted(commitments, key=lambda c: c.id)
    for idx, c in enumerate(ordered):
        share = (c.commitment_amount / total_committed).quantize(Decimal("0.00000001"))
        if idx == len(ordered) - 1:
            amount = total_amount - allocated_so_far
        else:
            amount = (total_amount * share).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
        allocated_so_far += amount

        ca = session.query(CapitalAccount).filter(
            CapitalAccount.entity_id == entity_id,
            CapitalAccount.investor_id == c.investor_id,
        ).first()
        if not ca:
            raise ValueError(
                f"investor {c.investor_id} has a commitment but no capital account for entity {entity_id}"
            )

        session.add(CapitalCallAllocation(
            call_id=call.id,
            investor_id=c.investor_id,
            capital_account_id=ca.id,
            commitment_amount=c.commitment_amount,
            pro_rata_share=share,
            allocated_amount=amount,
        ))

    audit.log_event(
        session, actor_user_id=user.id, action="capital_call.create",
        object_type="capital_call", object_id=call.id,
        after={"call_number": call_number, "total": str(total_amount)},
    )
    session.flush()
    return call


def approve_capital_call(session: Session, user: AuthUser, call_id: int) -> CapitalCall:
    call = session.get(CapitalCall, call_id)
    if not call:
        raise ValueError(f"capital call {call_id} not found")
    if call.state not in (WorkflowState.DRAFT, WorkflowState.PENDING_REVIEW):
        raise ValueError(f"cannot approve from {call.state}")
    if call.created_by_user_id == user.id and not get_settings().allow_self_approval:
        raise PermissionError("maker cannot approve own capital call")
    if not user.has_permission(Permission.APPROVE):
        raise PermissionError("approve permission required")
    call.state = WorkflowState.APPROVED
    call.approved_by_user_id = user.id
    audit.log_event(
        session, actor_user_id=user.id, action="capital_call.approve",
        object_type="capital_call", object_id=call.id,
        after={"state": call.state},
    )
    return call


def record_funding(
    session: Session, *, user: AuthUser, call_id: int,
) -> list[Transaction]:
    """Create contribution transactions for each allocation on an approved call.
    These transactions are created in APPROVED state so they only need posting."""
    call = session.get(CapitalCall, call_id)
    if not call:
        raise ValueError(f"capital call {call_id} not found")
    if call.state != WorkflowState.APPROVED:
        raise ValueError("call must be approved before funding")

    batch = _sys_batch(session, user, f"capital-call-{call.call_number}")
    txs: list[Transaction] = []
    for alloc in call.allocations:
        tx = Transaction(
            batch_id=batch.id,
            source_reference=f"CC-{call.call_number}-{alloc.investor_id}",
            entity_id=call.entity_id,
            investor_id=alloc.investor_id,
            capital_account_id=alloc.capital_account_id,
            transaction_type=TransactionType.CONTRIBUTION,
            transaction_date=call.due_date,
            amount=alloc.allocated_amount,
            currency=call.currency,
            description=f"Capital call {call.call_number}",
            state=TransactionState.APPROVED,
            approved_by_user_id=user.id,
        )
        session.add(tx)
        txs.append(tx)

    batch.record_count = len(txs)
    batch.accepted_count = len(txs)
    batch.status = "completed"
    session.flush()

    for tx in txs:
        lineage.record_edge(
            session, upstream_type="capital_call", upstream_id=call.id,
            downstream_type="transaction", downstream_id=tx.id,
            relation="funded",
        )
    audit.log_event(
        session, actor_user_id=user.id, action="capital_call.fund",
        object_type="capital_call", object_id=call.id,
        after={"transaction_ids": [t.id for t in txs]},
    )
    call.state = WorkflowState.POSTED
    return txs
