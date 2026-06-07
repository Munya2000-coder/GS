"""Independent fund-operation validators.

These validators reconstruct expected values *from approved LPA rules* and
compare them against actuals supplied by an administrator/spreadsheet. The
system never simply trusts the supplied numbers — it recomputes and explains
every variance back to the governing source clause.

Only rules in ``APPROVED`` state with source traceability are executable.
"""

from __future__ import annotations

import json
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.models.lpa import ClauseType, ExtractedRule, RuleStatus

TWOPLACES = Decimal("0.01")


def _quant(x: Decimal) -> Decimal:
    return Decimal(x).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def _pct_to_rate(value: str | float | int | None) -> Decimal | None:
    """Parse '2.0%' / '8%' / 0.02 / 2 into a decimal rate (0.02)."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        v = Decimal(str(value))
        return v / Decimal(100) if v > 1 else v
    s = str(value).strip().replace("%", "")
    if not s:
        return None
    try:
        v = Decimal(s)
    except Exception:
        return None
    return v / Decimal(100)


def get_approved_rule(
    session: Session, *, entity_id: int, rule_type: ClauseType
) -> ExtractedRule | None:
    """Return the most recently approved executable rule of a type for a fund."""
    rules = (
        session.query(ExtractedRule)
        .filter(
            ExtractedRule.entity_id == entity_id,
            ExtractedRule.rule_type == rule_type,
            ExtractedRule.status == RuleStatus.APPROVED,
        )
        .order_by(ExtractedRule.id.desc())
        .all()
    )
    for r in rules:
        if r.is_executable():
            return r
    return None


def _payload(rule: ExtractedRule | None) -> dict:
    return json.loads(rule.extracted_json) if rule else {}


# --------------------------------------------------------------------------- #
# Management fee validation                                                    #
# --------------------------------------------------------------------------- #

def validate_management_fee(
    *,
    investor: str,
    fee_base: Decimal,
    actual_fee: Decimal,
    annual_rate: Decimal | None = None,
    periods_per_year: int = 4,
    period: str | None = None,
    rule: ExtractedRule | None = None,
    tolerance: Decimal = Decimal("0.01"),
) -> dict:
    """Quarterly fee = fee_base × annual_rate ÷ periods_per_year.

    ``annual_rate`` may be supplied explicitly; otherwise it is taken from the
    approved management-fee rule's ``fee_rate``."""
    source_clause = None
    if annual_rate is None and rule is not None:
        payload = _payload(rule)
        annual_rate = _pct_to_rate(payload.get("fee_rate"))
        source_clause = payload.get("source_clause")
    if annual_rate is None:
        raise ValueError("annual_rate not provided and not derivable from rule")

    expected = _quant(fee_base * annual_rate / Decimal(periods_per_year))
    actual = _quant(actual_fee)
    variance = _quant(actual - expected)
    status = "pass" if abs(variance) <= tolerance else "fail"
    reason = None
    if status == "fail":
        if actual < expected:
            reason = "Actual fee underpaid relative to approved rate/base."
        else:
            reason = "Actual fee overpaid relative to approved rate/base."
    return {
        "investor": investor,
        "period": period,
        "fee_base": str(_quant(fee_base)),
        "annual_rate": str(annual_rate),
        "periods_per_year": periods_per_year,
        "expected_fee": str(expected),
        "actual_fee": str(actual),
        "variance": str(variance),
        "status": status,
        "reason": reason,
        "source_clause": source_clause,
    }


# --------------------------------------------------------------------------- #
# Capital call validation                                                      #
# --------------------------------------------------------------------------- #

def validate_capital_call(
    *,
    investors: list[dict],
    total_call_amount: Decimal | None = None,
    rule: ExtractedRule | None = None,
    tolerance: Decimal = Decimal("0.01"),
) -> dict:
    """Validate a capital call against unfunded commitments and pro-rata share.

    Each investor dict: ``{name, commitment, unfunded, actual_call}``.
    A call must not exceed the investor's unfunded commitment, and should match
    its pro-rata share of the total call (when a total is supplied)."""
    source_clause = _payload(rule).get("source_clause") if rule else None
    total_unfunded = sum((Decimal(str(i.get("unfunded", 0))) for i in investors), Decimal("0"))
    issues: list[dict] = []
    lines: list[dict] = []
    for inv in investors:
        name = inv.get("name", "?")
        unfunded = Decimal(str(inv.get("unfunded", 0)))
        actual_call = Decimal(str(inv.get("actual_call", 0)))
        line: dict = {
            "investor": name,
            "unfunded_commitment": str(_quant(unfunded)),
            "actual_call": str(_quant(actual_call)),
        }
        if actual_call > unfunded + tolerance:
            issue = {
                "investor": name,
                "issue": "Capital call exceeds unfunded commitment",
                "expected_max_call": str(_quant(unfunded)),
                "actual_call": str(_quant(actual_call)),
                "source_clause": source_clause,
            }
            issues.append(issue)
            line["status"] = "fail"
        elif total_call_amount is not None and total_unfunded > 0:
            expected_prorata = _quant(Decimal(str(total_call_amount)) * unfunded / total_unfunded)
            line["expected_pro_rata"] = str(expected_prorata)
            if abs(expected_prorata - actual_call) > tolerance:
                issues.append(
                    {
                        "investor": name,
                        "issue": "Call deviates from pro-rata share",
                        "expected_pro_rata": str(expected_prorata),
                        "actual_call": str(_quant(actual_call)),
                        "source_clause": source_clause,
                    }
                )
                line["status"] = "fail"
            else:
                line["status"] = "pass"
        else:
            line["status"] = "pass"
        lines.append(line)

    return {
        "status": "fail" if issues else "pass",
        "issues": issues,
        "lines": lines,
        "source_clause": source_clause,
    }


# --------------------------------------------------------------------------- #
# Distribution waterfall validation                                           #
# --------------------------------------------------------------------------- #

def validate_waterfall(
    *,
    investors: list[dict],
    distribution_amount: Decimal,
    preferred_rate: Decimal | None = None,
    carry_pct: Decimal | None = None,
    years: Decimal = Decimal("1"),
    preferred_rule: ExtractedRule | None = None,
    carry_rule: ExtractedRule | None = None,
    waterfall_rule: ExtractedRule | None = None,
    tolerance: Decimal = Decimal("1.00"),
) -> dict:
    """Independently reconstruct a European whole-fund waterfall and compare the
    expected per-investor distribution to the actuals.

    Each investor dict: ``{name, contribution, prior_distribution, actual_distribution}``.
    Rates fall back to the approved preferred-return / carried-interest rules."""
    src_clauses: dict[str, str | None] = {}
    if preferred_rate is None and preferred_rule is not None:
        p = _payload(preferred_rule)
        preferred_rate = _pct_to_rate(p.get("rate"))
        src_clauses["preferred"] = p.get("source_clause")
    if carry_pct is None and carry_rule is not None:
        c = _payload(carry_rule)
        carry_pct = _pct_to_rate(c.get("carry_percentage"))
        src_clauses["carry"] = c.get("source_clause")
    if waterfall_rule is not None:
        src_clauses["waterfall"] = _payload(waterfall_rule).get("source_clause")

    preferred_rate = preferred_rate or Decimal("0")
    carry_pct = carry_pct or Decimal("0")

    total_contrib = sum((Decimal(str(i.get("contribution", 0))) for i in investors), Decimal("0"))
    distribution_amount = Decimal(str(distribution_amount))

    # Fund-level European waterfall.
    available = distribution_amount
    roc = min(available, total_contrib)
    available -= roc
    pref_total = _quant(total_contrib * preferred_rate * years)
    pref = min(available, pref_total)
    available -= pref
    # Remaining profit split: GP carry, LP residual.
    gp_carry = _quant(available * carry_pct)
    lp_residual = available - gp_carry
    lp_total_expected = roc + pref + lp_residual

    variance_by_investor: list[dict] = []
    total_variance = Decimal("0")
    for inv in investors:
        name = inv.get("name", "?")
        contrib = Decimal(str(inv.get("contribution", 0)))
        actual = Decimal(str(inv.get("actual_distribution", 0)))
        share = (contrib / total_contrib) if total_contrib > 0 else Decimal("0")
        expected = _quant(lp_total_expected * share)
        variance = _quant(actual - expected)
        total_variance += abs(variance)
        reason = None
        clause = None
        if abs(variance) > tolerance:
            if actual < expected:
                reason = "Preferred return / capital underpaid"
                clause = src_clauses.get("preferred") or src_clauses.get("waterfall")
            else:
                reason = "Distribution exceeds entitlement"
                clause = src_clauses.get("carry") or src_clauses.get("waterfall")
        variance_by_investor.append(
            {
                "investor": name,
                "expected_distribution": str(expected),
                "actual_distribution": str(_quant(actual)),
                "variance": str(variance),
                "reason": reason,
                "source_clause": clause,
            }
        )

    total_variance = _quant(total_variance)
    result = "pass" if total_variance <= tolerance else "fail"
    return {
        "validation_result": result,
        "total_variance": str(total_variance),
        "fund_level": {
            "return_of_capital": str(_quant(roc)),
            "preferred_return": str(_quant(pref)),
            "lp_residual": str(_quant(lp_residual)),
            "gp_carry": str(_quant(gp_carry)),
            "preferred_rate": str(preferred_rate),
            "carry_pct": str(carry_pct),
        },
        "variance_by_investor": variance_by_investor,
        "source_clauses": src_clauses,
    }
