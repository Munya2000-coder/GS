"""Waterfall / carried-interest calculation engine (Epic 4).

Supports American (deal-by-deal) and European (whole-fund) models with a
standard four-tier structure:

  Tier 1  Return of Capital (LP) — LP contributions + recallable
  Tier 2  Preferred Return (LP)  — hurdle return on LP contributions
  Tier 3  GP Catch-up            — GP receives catchup% until carry split restored
  Tier 4  Carried Interest       — remaining proceeds split by carry bps

Waterfall parameters are stored in `WaterfallModel`. Every run is versioned,
hashed, and lineage-linked to its source transactions.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.models.capital_account import CapitalAccount
from app.models.transaction import Transaction, TransactionState, TransactionType
from app.models.waterfall import (
    ParticipantAllocation,
    WaterfallMethod,
    WaterfallModel,
    WaterfallRun,
    WaterfallTierResult,
)
from app.models.workflow import WorkflowState
from app.services import audit, lineage


TWOPLACES = Decimal("0.01")


@dataclass
class WaterfallInputs:
    lp_contributions: Decimal
    lp_recallable: Decimal
    distributions_to_date: Decimal
    realised_proceeds: Decimal
    unrealised_value: Decimal
    investment_start: date
    as_of: date

    def lp_invested(self) -> Decimal:
        return self.lp_contributions + self.lp_recallable

    def total_available(self) -> Decimal:
        return self.realised_proceeds + self.unrealised_value

    def years(self) -> Decimal:
        days = (self.as_of - self.investment_start).days
        return Decimal(max(days, 0)) / Decimal("365")


def _quant(x: Decimal) -> Decimal:
    return x.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def compute_hurdle(invested: Decimal, annual_bps: int, years: Decimal, compounding: str) -> Decimal:
    rate = Decimal(annual_bps) / Decimal(10000)
    if compounding == "simple":
        return _quant(invested * rate * years)
    # annual compounding via successive multiplication to stay within Decimal
    value = Decimal(invested)
    whole = int(years)
    frac = years - whole
    for _ in range(whole):
        value = value * (Decimal("1") + rate)
    if frac > 0:
        value = value * (Decimal("1") + rate * frac)
    return _quant(value - invested)


def _gather_inputs(session: Session, entity_id: int, as_of: date) -> WaterfallInputs:
    txs = session.query(Transaction).filter(
        Transaction.entity_id == entity_id,
        Transaction.state == TransactionState.POSTED,
        Transaction.transaction_date <= as_of,
    ).all()
    lp_contributions = Decimal("0")
    lp_recallable = Decimal("0")
    distributions = Decimal("0")
    realised = Decimal("0")
    for t in txs:
        if t.transaction_type in (TransactionType.CONTRIBUTION, TransactionType.CAPITAL_CALL):
            lp_contributions += t.amount
        elif t.transaction_type == TransactionType.RECALL:
            lp_recallable += t.amount
        elif t.transaction_type == TransactionType.DISTRIBUTION:
            distributions += t.amount
        elif t.transaction_type in (TransactionType.REALISED_GAIN, TransactionType.PORTFOLIO_CASH_IN):
            realised += t.amount

    unrealised = Decimal(
        sum(
            (ca.ending_nav for ca in session.query(CapitalAccount).filter(CapitalAccount.entity_id == entity_id).all()),
            Decimal("0"),
        )
    )
    first_tx = min((t.transaction_date for t in txs), default=as_of)
    return WaterfallInputs(
        lp_contributions=lp_contributions,
        lp_recallable=lp_recallable,
        distributions_to_date=distributions,
        realised_proceeds=realised,
        unrealised_value=unrealised,
        investment_start=first_tx,
        as_of=as_of,
    )


def run_waterfall(
    session: Session,
    *,
    user: AuthUser,
    model_id: int,
    as_of: date,
    scenario_label: str | None = None,
    is_scenario: bool = False,
) -> WaterfallRun:
    model = session.get(WaterfallModel, model_id)
    if model is None:
        raise ValueError(f"waterfall model {model_id} not found")
    if not is_scenario and model.state != WorkflowState.APPROVED:
        raise ValueError("only approved waterfall models can run non-scenario calculations")

    inputs = _gather_inputs(session, model.entity_id, as_of)
    snapshot = json.dumps(
        {
            "model_id": model.id,
            "model_version": model.version,
            "method": model.method,
            "preferred_return_bps": model.preferred_return_bps,
            "catchup_bps": model.catchup_percentage_bps,
            "carry_bps": model.carried_interest_bps,
            "inputs": {
                "lp_contributions": str(inputs.lp_contributions),
                "lp_recallable": str(inputs.lp_recallable),
                "realised": str(inputs.realised_proceeds),
                "unrealised": str(inputs.unrealised_value),
                "as_of": str(inputs.as_of),
            },
        },
        sort_keys=True,
    )
    input_hash = hashlib.sha256(snapshot.encode()).hexdigest()

    run = WaterfallRun(
        model_id=model.id,
        entity_id=model.entity_id,
        as_of_date=as_of,
        scenario_label=scenario_label,
        executed_by_user_id=user.id,
        input_snapshot_hash=input_hash,
        model_version_snapshot=snapshot,
        is_scenario=is_scenario,
        state=WorkflowState.DRAFT,
    )
    session.add(run)
    session.flush()

    tiers = _compute_tiers(model, inputs)
    for order, tier in enumerate(tiers, start=1):
        session.add(
            WaterfallTierResult(
                run_id=run.id,
                tier_order=order,
                tier_name=tier["name"],
                lp_amount=tier["lp"],
                gp_amount=tier["gp"],
                formula_text=tier["formula"],
            )
        )

    lp_total = sum((t["lp"] for t in tiers), Decimal("0"))
    gp_total = sum((t["gp"] for t in tiers), Decimal("0"))
    session.add(ParticipantAllocation(run_id=run.id, participant="LP", participant_type="LP", allocation_amount=_quant(lp_total)))
    session.add(ParticipantAllocation(run_id=run.id, participant="GP", participant_type="GP", allocation_amount=_quant(gp_total)))

    lineage.record_edge(
        session, upstream_type="waterfall_model", upstream_id=model.id,
        downstream_type="waterfall_run", downstream_id=run.id, relation="executed",
    )
    audit.log_event(
        session, actor_user_id=user.id, action="waterfall.run",
        object_type="waterfall_run", object_id=run.id,
        after={"input_hash": input_hash, "lp": str(lp_total), "gp": str(gp_total), "scenario": is_scenario},
    )
    return run


def _compute_tiers(model: WaterfallModel, inputs: WaterfallInputs) -> list[dict]:
    available = inputs.total_available()
    if model.method == WaterfallMethod.AMERICAN:
        available = inputs.realised_proceeds  # deal-by-deal excludes unrealised

    invested = inputs.lp_invested()
    tiers: list[dict] = []

    roc = min(available, invested)
    tiers.append({"name": "Return of Capital", "lp": _quant(roc), "gp": Decimal("0"), "formula": f"min(available={available}, invested={invested})"})
    available -= roc

    hurdle = compute_hurdle(invested, model.preferred_return_bps, inputs.years(), model.hurdle_compounding)
    pref = min(available, hurdle)
    tiers.append({"name": "Preferred Return", "lp": _quant(pref), "gp": Decimal("0"), "formula": f"hurdle={hurdle} @ {model.preferred_return_bps}bps over {inputs.years()}y"})
    available -= pref

    carry_rate = Decimal(model.carried_interest_bps) / Decimal(10000)
    catchup_rate = Decimal(model.catchup_percentage_bps) / Decimal(10000)
    if carry_rate > 0 and catchup_rate > 0 and available > 0:
        target_gp = pref * carry_rate / (Decimal("1") - carry_rate)
        catchup_amount = min(available, target_gp / catchup_rate * catchup_rate)
        catchup_amount = min(available, target_gp)
        tiers.append({
            "name": "GP Catch-up",
            "lp": Decimal("0"),
            "gp": _quant(catchup_amount),
            "formula": f"catchup target_gp={target_gp} at {model.catchup_percentage_bps}bps",
        })
        available -= catchup_amount

    if available > 0:
        gp_carry = available * carry_rate
        lp_residual = available - gp_carry
        tiers.append({
            "name": "Carried Interest",
            "lp": _quant(lp_residual),
            "gp": _quant(gp_carry),
            "formula": f"residual={available}; carry={carry_rate}",
        })

    return tiers


def approve_run(session: Session, user: AuthUser, run_id: int) -> WaterfallRun:
    run = session.get(WaterfallRun, run_id)
    if run is None:
        raise ValueError(f"waterfall run {run_id} not found")
    if run.state != WorkflowState.DRAFT and run.state != WorkflowState.PENDING_REVIEW:
        raise ValueError(f"run in state {run.state} cannot be approved")
    if run.executed_by_user_id == user.id:
        from app.core.config import get_settings
        if not get_settings().allow_self_approval:
            raise PermissionError("maker cannot approve own waterfall run")
    run.state = WorkflowState.APPROVED
    run.approved_by_user_id = user.id
    audit.log_event(
        session, actor_user_id=user.id, action="waterfall.approve",
        object_type="waterfall_run", object_id=run.id,
        after={"state": run.state},
    )
    return run
