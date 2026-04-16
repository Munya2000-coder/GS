"""Management fee calculation engine (Epic 5)."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.models.capital_account import CapitalAccount
from app.models.fee import FeeAccrual, FeeBasis, FeeCalculationRun, FeeSchedule
from app.models.investor import Commitment
from app.models.transaction import Transaction, TransactionState, TransactionType
from app.models.workflow import WorkflowState
from app.services import audit, lineage


@dataclass
class FeeRunRequest:
    entity_id: int
    period_start: date
    period_end: date


def _days_in_year(d: date) -> int:
    return 366 if (d.year % 4 == 0 and d.year % 100 != 0) or d.year % 400 == 0 else 365


def _accrue(basis_amount: Decimal, annual_bps: int, period_start: date, period_end: date) -> Decimal:
    rate = Decimal(annual_bps) / Decimal(10000)
    days = (period_end - period_start).days + 1
    annualiser = Decimal(days) / Decimal(_days_in_year(period_start))
    return (basis_amount * rate * annualiser).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _commitment_basis(session: Session, entity_id: int, investor_id: int | None) -> Decimal:
    q = session.query(Commitment).filter(Commitment.entity_id == entity_id)
    if investor_id is not None:
        q = q.filter(Commitment.investor_id == investor_id)
    return Decimal(sum((c.commitment_amount for c in q.all()), Decimal("0")))


def _invested_capital_basis(
    session: Session, entity_id: int, investor_id: int | None, as_of: date
) -> Decimal:
    q = session.query(Transaction).filter(
        Transaction.entity_id == entity_id,
        Transaction.transaction_date <= as_of,
        Transaction.state == TransactionState.POSTED,
        Transaction.transaction_type.in_([TransactionType.PORTFOLIO_CASH_OUT]),
    )
    outflows = Decimal(sum((t.amount for t in q.all()), Decimal("0")))
    qin = session.query(Transaction).filter(
        Transaction.entity_id == entity_id,
        Transaction.transaction_date <= as_of,
        Transaction.state == TransactionState.POSTED,
        Transaction.transaction_type.in_([TransactionType.PORTFOLIO_CASH_IN]),
    )
    inflows = Decimal(sum((t.amount for t in qin.all()), Decimal("0")))
    return max(outflows - inflows, Decimal("0"))


def _nav_basis(session: Session, entity_id: int, as_of: date) -> Decimal:
    accounts = session.query(CapitalAccount).filter(CapitalAccount.entity_id == entity_id).all()
    return Decimal(sum((ca.ending_nav for ca in accounts), Decimal("0")))


def _select_schedules(
    session: Session, entity_id: int, period_end: date
) -> list[FeeSchedule]:
    return (
        session.query(FeeSchedule)
        .filter(
            FeeSchedule.entity_id == entity_id,
            FeeSchedule.state == WorkflowState.APPROVED,
            FeeSchedule.effective_from <= period_end,
        )
        .all()
    )


def run_fees(session: Session, user: AuthUser, req: FeeRunRequest) -> FeeCalculationRun:
    schedules = _select_schedules(session, req.entity_id, req.period_end)
    active = [s for s in schedules if s.is_effective_on(req.period_end)]
    if not active:
        raise ValueError("no approved fee schedule is effective for the period")

    snapshot = json.dumps(
        [
            {
                "id": s.id,
                "version": s.version,
                "basis": s.basis,
                "rate_bps": s.annual_rate_bps,
                "investor_id": s.investor_id,
                "investor_class": s.investor_class,
            }
            for s in active
        ],
        sort_keys=True,
    )
    input_hash = hashlib.sha256(snapshot.encode()).hexdigest()

    run = FeeCalculationRun(
        entity_id=req.entity_id,
        period_start=req.period_start,
        period_end=req.period_end,
        executed_by_user_id=user.id,
        input_snapshot_hash=input_hash,
        schedule_version_snapshot=snapshot,
        state=WorkflowState.DRAFT,
    )
    session.add(run)
    session.flush()

    for schedule in active:
        basis_amt = {
            FeeBasis.COMMITMENT: lambda: _commitment_basis(session, req.entity_id, schedule.investor_id),
            FeeBasis.INVESTED_CAPITAL: lambda: _invested_capital_basis(
                session, req.entity_id, schedule.investor_id, req.period_end
            ),
            FeeBasis.NAV: lambda: _nav_basis(session, req.entity_id, req.period_end),
            FeeBasis.FLAT: lambda: Decimal("1"),
        }[schedule.basis]()

        gross = _accrue(basis_amt, schedule.annual_rate_bps, req.period_start, req.period_end)
        offset = _fee_offset(session, req.entity_id, req.period_start, req.period_end) if schedule.offsets_enabled else Decimal("0")
        net = max(gross - offset, Decimal("0"))

        accrual = FeeAccrual(
            schedule_id=schedule.id,
            entity_id=req.entity_id,
            investor_id=schedule.investor_id,
            period_start=req.period_start,
            period_end=req.period_end,
            basis_amount=basis_amt,
            applied_rate_bps=schedule.annual_rate_bps,
            gross_fee=gross,
            offset_amount=offset,
            net_fee=net,
            run_id=run.id,
        )
        session.add(accrual)
        session.flush()

        lineage.record_edge(
            session,
            upstream_type="fee_schedule",
            upstream_id=schedule.id,
            downstream_type="fee_accrual",
            downstream_id=accrual.id,
            relation="derived",
        )
        lineage.record_edge(
            session,
            upstream_type="fee_accrual",
            upstream_id=accrual.id,
            downstream_type="fee_run",
            downstream_id=run.id,
            relation="aggregated",
        )

    audit.log_event(
        session, actor_user_id=user.id, action="fee.run",
        object_type="fee_run", object_id=run.id,
        after={"input_hash": input_hash, "accruals": len(run.accruals)},
    )
    return run


def _fee_offset(session: Session, entity_id: int, period_start: date, period_end: date) -> Decimal:
    q = session.query(Transaction).filter(
        Transaction.entity_id == entity_id,
        Transaction.transaction_type == TransactionType.FEE_OFFSET,
        Transaction.state == TransactionState.POSTED,
        Transaction.transaction_date >= period_start,
        Transaction.transaction_date <= period_end,
    )
    return Decimal(sum((abs(t.amount) for t in q.all()), Decimal("0")))
