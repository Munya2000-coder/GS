"""Distribution generation and allocation (pro rata by contributed capital)."""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import AuthUser, Permission
from app.models.capital_account import CapitalAccount
from app.models.capital_call import (
    CashEventPurpose,
    Distribution,
    DistributionAllocation,
)
from app.models.transaction import (
    ImportBatch,
    Transaction,
    TransactionState,
    TransactionType,
)
from app.models.workflow import WorkflowState
from app.services import audit, lineage


TWOPLACES = Decimal("0.01")


def generate_distribution(
    session: Session,
    *,
    user: AuthUser,
    entity_id: int,
    distribution_number: str,
    notice_date: date,
    payment_date: date,
    total_amount: Decimal,
    currency: str,
    purpose: CashEventPurpose = CashEventPurpose.PROFIT,
    recallable: bool = False,
) -> Distribution:
    if session.query(Distribution).filter(
        Distribution.entity_id == entity_id,
        Distribution.distribution_number == distribution_number,
    ).first():
        raise ValueError("distribution number already exists for entity")

    accounts = session.query(CapitalAccount).filter(CapitalAccount.entity_id == entity_id).all()
    total_contributed = sum((a.contributed for a in accounts), Decimal("0"))
    if total_contributed == 0:
        raise ValueError("entity has no contributed capital to allocate against")

    dist = Distribution(
        entity_id=entity_id,
        distribution_number=distribution_number,
        notice_date=notice_date,
        payment_date=payment_date,
        total_amount=total_amount,
        currency=currency,
        purpose=purpose,
        recallable=recallable,
        state=WorkflowState.DRAFT,
        created_by_user_id=user.id,
    )
    session.add(dist)
    session.flush()

    allocated = Decimal("0")
    ordered = sorted(accounts, key=lambda a: a.id)
    for idx, a in enumerate(ordered):
        share = (a.contributed / total_contributed).quantize(Decimal("0.00000001"))
        if idx == len(ordered) - 1:
            amt = total_amount - allocated
        else:
            amt = (total_amount * share).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
        allocated += amt
        session.add(DistributionAllocation(
            distribution_id=dist.id,
            investor_id=a.investor_id,
            capital_account_id=a.id,
            allocation_basis=a.contributed,
            pro_rata_share=share,
            allocated_amount=amt,
        ))

    audit.log_event(
        session, actor_user_id=user.id, action="distribution.create",
        object_type="distribution", object_id=dist.id,
        after={"total": str(total_amount), "recallable": recallable},
    )
    session.flush()
    return dist


def approve_distribution(session: Session, user: AuthUser, dist_id: int) -> Distribution:
    dist = session.get(Distribution, dist_id)
    if not dist:
        raise ValueError(f"distribution {dist_id} not found")
    if dist.state not in (WorkflowState.DRAFT, WorkflowState.PENDING_REVIEW):
        raise ValueError(f"cannot approve from {dist.state}")
    if dist.created_by_user_id == user.id and not get_settings().allow_self_approval:
        raise PermissionError("maker cannot approve own distribution")
    if not user.has_permission(Permission.APPROVE):
        raise PermissionError("approve permission required")
    dist.state = WorkflowState.APPROVED
    dist.approved_by_user_id = user.id
    audit.log_event(
        session, actor_user_id=user.id, action="distribution.approve",
        object_type="distribution", object_id=dist.id,
        after={"state": dist.state},
    )
    return dist


def record_payout(session: Session, *, user: AuthUser, dist_id: int) -> list[Transaction]:
    dist = session.get(Distribution, dist_id)
    if not dist:
        raise ValueError(f"distribution {dist_id} not found")
    if dist.state != WorkflowState.APPROVED:
        raise ValueError("distribution must be approved before payout")

    batch = ImportBatch(
        source_system="system",
        source_owner=f"distribution-{dist.distribution_number}",
        mapping_version="internal",
        record_count=0, raw_payload="[]",
        submitted_by_user_id=user.id, status="system",
    )
    session.add(batch)
    session.flush()

    tx_type = TransactionType.RECALL if dist.recallable else TransactionType.DISTRIBUTION
    txs: list[Transaction] = []
    for alloc in dist.allocations:
        tx = Transaction(
            batch_id=batch.id,
            source_reference=f"DIST-{dist.distribution_number}-{alloc.investor_id}",
            entity_id=dist.entity_id,
            investor_id=alloc.investor_id,
            capital_account_id=alloc.capital_account_id,
            transaction_type=tx_type,
            transaction_date=dist.payment_date,
            amount=alloc.allocated_amount,
            currency=dist.currency,
            description=f"Distribution {dist.distribution_number}",
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
            session, upstream_type="distribution", upstream_id=dist.id,
            downstream_type="transaction", downstream_id=tx.id,
            relation="paid",
        )
    audit.log_event(
        session, actor_user_id=user.id, action="distribution.payout",
        object_type="distribution", object_id=dist.id,
        after={"transaction_ids": [t.id for t in txs]},
    )
    dist.state = WorkflowState.POSTED
    return txs
