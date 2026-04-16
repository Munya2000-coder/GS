"""Report generation (Epic 6). Reports compose already-validated domain
data; they never compute from raw state to keep lineage intact."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.capital_account import CapitalAccount
from app.models.entity import Entity
from app.models.fee import FeeAccrual, FeeCalculationRun
from app.models.investor import Commitment, Investor
from app.models.journal import JournalEntry, JournalLine
from app.models.transaction import Transaction, TransactionState, TransactionType
from app.models.waterfall import WaterfallRun, WaterfallTierResult


def trial_balance(session: Session, entity_id: int, as_of: date) -> dict[str, Any]:
    q = (
        session.query(JournalLine, JournalEntry)
        .join(JournalEntry, JournalEntry.id == JournalLine.entry_id)
        .filter(JournalEntry.entity_id == entity_id, JournalEntry.entry_date <= as_of)
    )
    balances: dict[int, dict[str, Decimal]] = defaultdict(lambda: {"debit": Decimal("0"), "credit": Decimal("0")})
    for line, _entry in q:
        balances[line.account_id]["debit"] += line.debit
        balances[line.account_id]["credit"] += line.credit

    from app.models.journal import Account

    rows = []
    for account in session.query(Account).all():
        b = balances.get(account.id, {"debit": Decimal("0"), "credit": Decimal("0")})
        rows.append(
            {
                "account_code": account.code,
                "account_name": account.name,
                "debit": str(b["debit"]),
                "credit": str(b["credit"]),
                "net": str(b["debit"] - b["credit"]),
            }
        )
    return {"entity_id": entity_id, "as_of": str(as_of), "rows": rows}


def capital_account_statement(
    session: Session, investor_id: int, entity_id: int, as_of: date
) -> dict[str, Any]:
    investor = session.get(Investor, investor_id)
    entity = session.get(Entity, entity_id)
    if not investor or not entity:
        raise ValueError("investor or entity not found")

    commitment = sum(
        (c.commitment_amount for c in session.query(Commitment).filter(
            Commitment.investor_id == investor_id, Commitment.entity_id == entity_id
        ).all()),
        Decimal("0"),
    )
    ca = session.query(CapitalAccount).filter(
        CapitalAccount.investor_id == investor_id, CapitalAccount.entity_id == entity_id
    ).first()

    transactions = session.query(Transaction).filter(
        Transaction.entity_id == entity_id,
        Transaction.investor_id == investor_id,
        Transaction.state == TransactionState.POSTED,
        Transaction.transaction_date <= as_of,
    ).order_by(Transaction.transaction_date).all()

    return {
        "investor": {"id": investor.id, "code": investor.code, "legal_name": investor.legal_name},
        "entity": {"id": entity.id, "code": entity.code, "legal_name": entity.legal_name},
        "as_of": str(as_of),
        "commitment": str(commitment),
        "contributed": str(ca.contributed if ca else Decimal("0")),
        "distributed": str(ca.distributed if ca else Decimal("0")),
        "ending_nav": str(ca.ending_nav if ca else Decimal("0")),
        "unfunded": str(commitment - (ca.contributed if ca else Decimal("0"))),
        "allocated_pnl": str(ca.allocated_pnl if ca else Decimal("0")),
        "transactions": [
            {
                "id": t.id,
                "date": str(t.transaction_date),
                "type": t.transaction_type,
                "amount": str(t.amount),
                "currency": t.currency,
                "description": t.description,
                "source_reference": t.source_reference,
            }
            for t in transactions
        ],
    }


def contribution_distribution_statement(
    session: Session, entity_id: int, as_of: date, investor_id: int | None = None
) -> dict[str, Any]:
    q = session.query(Transaction).filter(
        Transaction.entity_id == entity_id,
        Transaction.state == TransactionState.POSTED,
        Transaction.transaction_date <= as_of,
        Transaction.transaction_type.in_([
            TransactionType.CAPITAL_CALL,
            TransactionType.CONTRIBUTION,
            TransactionType.DISTRIBUTION,
            TransactionType.RECALL,
        ]),
    )
    if investor_id is not None:
        q = q.filter(Transaction.investor_id == investor_id)

    items = []
    contributed = Decimal("0")
    distributed = Decimal("0")
    for t in q.order_by(Transaction.transaction_date).all():
        items.append({
            "date": str(t.transaction_date),
            "type": t.transaction_type,
            "investor_id": t.investor_id,
            "amount": str(t.amount),
        })
        if t.transaction_type in (TransactionType.CONTRIBUTION, TransactionType.CAPITAL_CALL):
            contributed += t.amount
        elif t.transaction_type == TransactionType.DISTRIBUTION:
            distributed += t.amount
    return {
        "entity_id": entity_id,
        "investor_id": investor_id,
        "as_of": str(as_of),
        "total_contributed": str(contributed),
        "total_distributed": str(distributed),
        "items": items,
    }


def waterfall_summary(session: Session, run_id: int) -> dict[str, Any]:
    run = session.get(WaterfallRun, run_id)
    if not run:
        raise ValueError(f"waterfall run {run_id} not found")
    return {
        "run_id": run.id,
        "model_id": run.model_id,
        "entity_id": run.entity_id,
        "as_of": str(run.as_of_date),
        "state": run.state,
        "scenario_label": run.scenario_label,
        "is_scenario": run.is_scenario,
        "input_snapshot_hash": run.input_snapshot_hash,
        "tiers": [
            {
                "order": t.tier_order,
                "name": t.tier_name,
                "lp_amount": str(t.lp_amount),
                "gp_amount": str(t.gp_amount),
                "formula": t.formula_text,
            }
            for t in run.tiers
        ],
        "participant_allocations": [
            {"participant": a.participant, "type": a.participant_type, "amount": str(a.allocation_amount)}
            for a in run.allocations
        ],
    }


def fee_accrual_report(session: Session, run_id: int) -> dict[str, Any]:
    run = session.get(FeeCalculationRun, run_id)
    if not run:
        raise ValueError(f"fee run {run_id} not found")
    accruals = session.query(FeeAccrual).filter(FeeAccrual.run_id == run_id).all()
    return {
        "run_id": run.id,
        "entity_id": run.entity_id,
        "period_start": str(run.period_start),
        "period_end": str(run.period_end),
        "state": run.state,
        "input_snapshot_hash": run.input_snapshot_hash,
        "accruals": [
            {
                "schedule_id": a.schedule_id,
                "investor_id": a.investor_id,
                "basis_amount": str(a.basis_amount),
                "applied_rate_bps": a.applied_rate_bps,
                "gross_fee": str(a.gross_fee),
                "offset_amount": str(a.offset_amount),
                "net_fee": str(a.net_fee),
            }
            for a in accruals
        ],
        "totals": {
            "gross": str(sum((a.gross_fee for a in accruals), Decimal("0"))),
            "offsets": str(sum((a.offset_amount for a in accruals), Decimal("0"))),
            "net": str(sum((a.net_fee for a in accruals), Decimal("0"))),
        },
    }
