"""Dashboard aggregations (Epic 6)."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.capital_account import CapitalAccount
from app.models.capital_call import CapitalCall, Distribution
from app.models.entity import Entity, EntityStatus
from app.models.fee import FeeAccrual
from app.models.investor import Commitment, Investor
from app.models.job import Job, JobStatus
from app.models.period import AccountingPeriod, PeriodStatus
from app.models.reconciliation import Reconciliation, ReconciliationStatus
from app.models.transaction import ImportException, Transaction, TransactionState, TransactionType
from app.models.waterfall import WaterfallRun
from app.models.workflow import WorkflowState
from app.services.performance import compute_metrics


def platform_summary(session: Session) -> dict[str, Any]:
    funds_total = session.query(Entity).count()
    funds_active = session.query(Entity).filter(Entity.status == EntityStatus.ACTIVE).count()
    investors = session.query(Investor).count()
    commitments = session.query(Commitment).all()
    total_committed = sum((c.commitment_amount for c in commitments), Decimal("0"))

    capital_accounts = session.query(CapitalAccount).all()
    total_contributed = sum((a.contributed for a in capital_accounts), Decimal("0"))
    total_distributed = sum((a.distributed for a in capital_accounts), Decimal("0"))
    total_nav = sum((a.ending_nav for a in capital_accounts), Decimal("0"))

    open_exceptions = session.query(ImportException).filter(ImportException.status == "open").count()
    open_breaks = session.query(Reconciliation).filter(
        Reconciliation.status == ReconciliationStatus.BREAK
    ).count()
    failed_jobs = session.query(Job).filter(Job.status == JobStatus.FAILED).count()

    pending_approvals = session.query(Transaction).filter(
        Transaction.state == TransactionState.VALIDATED
    ).count()

    return {
        "funds": {"total": funds_total, "active": funds_active},
        "investors": investors,
        "aum": {
            "committed": str(total_committed),
            "contributed": str(total_contributed),
            "distributed": str(total_distributed),
            "nav": str(total_nav),
        },
        "operational": {
            "open_exceptions": open_exceptions,
            "recon_breaks": open_breaks,
            "failed_jobs": failed_jobs,
            "pending_approvals": pending_approvals,
        },
        "as_of": datetime.utcnow().isoformat(),
    }


def fund_summary(session: Session, entity_id: int, as_of: date) -> dict[str, Any]:
    entity = session.get(Entity, entity_id)
    if not entity:
        raise ValueError("entity not found")

    commitments = session.query(Commitment).filter(Commitment.entity_id == entity_id).all()
    accounts = session.query(CapitalAccount).filter(CapitalAccount.entity_id == entity_id).all()
    metrics = compute_metrics(session, entity_id=entity_id, as_of=as_of)

    open_periods = session.query(AccountingPeriod).filter(
        AccountingPeriod.entity_id == entity_id,
        AccountingPeriod.status == PeriodStatus.OPEN,
    ).count()

    approved_calls = session.query(CapitalCall).filter(
        CapitalCall.entity_id == entity_id,
        CapitalCall.state.in_([WorkflowState.APPROVED, WorkflowState.POSTED]),
    ).count()
    approved_dists = session.query(Distribution).filter(
        Distribution.entity_id == entity_id,
        Distribution.state.in_([WorkflowState.APPROVED, WorkflowState.POSTED]),
    ).count()

    return {
        "entity": {
            "id": entity.id, "code": entity.code, "legal_name": entity.legal_name,
            "status": entity.status, "vintage": entity.vintage_year, "strategy": entity.strategy,
            "base_currency": entity.base_currency,
        },
        "commitments": {
            "count": len(commitments),
            "total_committed": str(sum((c.commitment_amount for c in commitments), Decimal("0"))),
        },
        "capital_accounts": len(accounts),
        "metrics": metrics.as_dict(),
        "operational": {
            "open_periods": open_periods,
            "approved_calls": approved_calls,
            "approved_distributions": approved_dists,
        },
    }


def operations_dashboard(session: Session) -> dict[str, Any]:
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_jobs = session.query(Job).filter(Job.created_at >= week_ago).all()
    jobs_by_status: dict[str, int] = {}
    for j in recent_jobs:
        jobs_by_status[j.status] = jobs_by_status.get(j.status, 0) + 1

    exceptions = session.query(ImportException).all()
    exc_by_code: dict[str, int] = {}
    exc_by_status: dict[str, int] = {}
    for e in exceptions:
        exc_by_code[e.code] = exc_by_code.get(e.code, 0) + 1
        exc_by_status[e.status] = exc_by_status.get(e.status, 0) + 1

    return {
        "jobs_last_7d": jobs_by_status,
        "exceptions_by_code": exc_by_code,
        "exceptions_by_status": exc_by_status,
        "pending_waterfall_approvals": session.query(WaterfallRun).filter(
            WaterfallRun.state == WorkflowState.DRAFT
        ).count(),
        "pending_fee_approvals": session.query(FeeAccrual).count(),
    }
