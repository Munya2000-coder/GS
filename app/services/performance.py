"""Private capital performance metrics: IRR, TVPI, DPI, RVPI, MOIC, PIC.

Calculations operate on approved, posted transactions at fund, investor,
or capital-account granularity. Every result is computed from lineage-backed
source data — no ad-hoc values.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.capital_account import CapitalAccount
from app.models.transaction import Transaction, TransactionState, TransactionType


CASH_IN_TYPES = {TransactionType.CONTRIBUTION, TransactionType.CAPITAL_CALL}
CASH_OUT_TYPES = {TransactionType.DISTRIBUTION}


@dataclass
class PerformanceMetrics:
    paid_in: Decimal
    distributions: Decimal
    nav: Decimal
    tvpi: Decimal
    dpi: Decimal
    rvpi: Decimal
    moic: Decimal
    pic_ratio: Decimal
    irr: Decimal | None
    as_of: date
    cashflow_count: int

    def as_dict(self) -> dict[str, Any]:
        d = asdict(self)
        for k, v in d.items():
            if isinstance(v, Decimal):
                d[k] = str(v)
        d["as_of"] = str(self.as_of)
        return d


def _ratio(num: Decimal, den: Decimal) -> Decimal:
    if den == 0:
        return Decimal("0")
    return (num / den).quantize(Decimal("0.0001"))


def _xirr(flows: list[tuple[date, Decimal]], guess: float = 0.1) -> Decimal | None:
    """Newton-Raphson IRR from dated cashflows. Returns None if it does not
    converge or if input lacks both a negative and a positive flow."""
    if len(flows) < 2:
        return None
    if not any(f[1] < 0 for f in flows) or not any(f[1] > 0 for f in flows):
        return None

    t0 = flows[0][0]
    times = [float((d - t0).days) / 365.0 for d, _ in flows]
    values = [float(v) for _, v in flows]

    rate = guess
    for _ in range(100):
        factors = [(1.0 + rate) ** t for t in times]
        if any(f <= 0 for f in factors):
            return None
        npv = sum(v / f for v, f in zip(values, factors))
        dnpv = sum(-t * v / (f * (1.0 + rate)) for t, v, f in zip(times, values, factors))
        if abs(dnpv) < 1e-12:
            return None
        new_rate = rate - npv / dnpv
        if new_rate <= -1.0:
            new_rate = (rate - 1.0) / 2.0
        if abs(new_rate - rate) < 1e-9:
            rate = new_rate
            break
        rate = new_rate
    else:
        return None
    return Decimal(rate).quantize(Decimal("0.0001"))


def _collect_cashflows(
    session: Session, entity_id: int, investor_id: int | None, as_of: date
) -> list[tuple[date, Decimal, TransactionType]]:
    q = session.query(Transaction).filter(
        Transaction.entity_id == entity_id,
        Transaction.state == TransactionState.POSTED,
        Transaction.transaction_date <= as_of,
    )
    if investor_id is not None:
        q = q.filter(Transaction.investor_id == investor_id)
    out: list[tuple[date, Decimal, TransactionType]] = []
    for t in q.order_by(Transaction.transaction_date).all():
        out.append((t.transaction_date, t.amount, t.transaction_type))
    return out


def compute_metrics(
    session: Session,
    *,
    entity_id: int,
    investor_id: int | None = None,
    as_of: date,
) -> PerformanceMetrics:
    flows = _collect_cashflows(session, entity_id, investor_id, as_of)

    paid_in = sum((amt for _, amt, tp in flows if tp in CASH_IN_TYPES), Decimal("0"))
    distributions = sum((amt for _, amt, tp in flows if tp in CASH_OUT_TYPES), Decimal("0"))

    ca_q = session.query(CapitalAccount).filter(CapitalAccount.entity_id == entity_id)
    if investor_id is not None:
        ca_q = ca_q.filter(CapitalAccount.investor_id == investor_id)
    nav = sum((ca.ending_nav for ca in ca_q.all()), Decimal("0"))

    total_value = distributions + nav

    # Commitment used for PIC (paid-in / committed)
    from app.models.investor import Commitment

    commit_q = session.query(Commitment).filter(Commitment.entity_id == entity_id)
    if investor_id is not None:
        commit_q = commit_q.filter(Commitment.investor_id == investor_id)
    committed = sum((c.commitment_amount for c in commit_q.all()), Decimal("0"))

    tvpi = _ratio(total_value, paid_in)
    dpi = _ratio(distributions, paid_in)
    rvpi = _ratio(nav, paid_in)
    moic = tvpi
    pic = _ratio(paid_in, committed)

    # IRR: contributions are negative cashflows from the LP perspective;
    # distributions and terminal NAV are positive.
    irr_flows: list[tuple[date, Decimal]] = []
    for d, amt, tp in flows:
        if tp in CASH_IN_TYPES:
            irr_flows.append((d, -amt))
        elif tp in CASH_OUT_TYPES:
            irr_flows.append((d, amt))
    if nav > 0:
        irr_flows.append((as_of, nav))
    irr = _xirr(irr_flows) if irr_flows else None

    return PerformanceMetrics(
        paid_in=paid_in,
        distributions=distributions,
        nav=nav,
        tvpi=tvpi,
        dpi=dpi,
        rvpi=rvpi,
        moic=moic,
        pic_ratio=pic,
        irr=irr,
        as_of=as_of,
        cashflow_count=len(flows),
    )
