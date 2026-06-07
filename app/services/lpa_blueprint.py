"""Fund Logic Blueprint assembly (POC #1).

Consolidates the extracted clause rules for a document into the exact
domain-targeted schema required by FR-2 (fund_metadata / waterfall_rules /
fee_economics), attaching a ground-truth citation object to every data point
(FR-3) and a traffic-light status derived from confidence + ambiguity (FR-4).

This is the structured half of the "split-screen Aha! blueprint": the left
panel renders these cards, and each card's `citation` drives the right-panel
PDF click-to-trace.
"""

from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation

from sqlalchemy.orm import Session

from app.models.lpa import ClauseType, ExtractedRule, RuleStatus, SourceDocument
from app.services.lpa_parser import traffic_light

# Rule precedence when several survive for the same clause: an approved rule
# always beats a draft/pending one, and ties break on most-recent.
_STATUS_RANK = {
    RuleStatus.APPROVED: 3,
    RuleStatus.PENDING_REVIEW: 2,
    RuleStatus.DRAFT_AI_EXTRACTED: 2,
    RuleStatus.NEEDS_LEGAL_REVIEW: 1,
}

_BASIS_LABELS = {
    "committed_capital": "Committed Capital",
    "invested_capital": "Invested Capital",
    "net_invested_capital": "Net Invested Capital",
    "nav": "Net Asset Value",
    "cost_basis": "Cost Basis",
    "capital_contributions": "Capital Contributions",
}


def _pct_to_rate(value) -> float | None:
    """'8%' / '0.08' / 8 -> 0.08 (FR-2 expects a decimal percentage)."""
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):
            v = Decimal(str(value))
        else:
            v = Decimal(str(value).strip().replace("%", ""))
    except (InvalidOperation, ValueError):
        return None
    if v > 1:
        v = v / Decimal(100)
    return float(v)


def _basis_label(key) -> str | None:
    if key is None:
        return None
    return _BASIS_LABELS.get(key, str(key).replace("_", " ").title())


def _pick(rules: list[ExtractedRule], rule_type: ClauseType) -> ExtractedRule | None:
    candidates = [r for r in rules if r.rule_type == rule_type]
    if not candidates:
        return None
    candidates.sort(key=lambda r: (_STATUS_RANK.get(r.status, 0), r.id), reverse=True)
    return candidates[0]


def _citation(rule: ExtractedRule | None, payload: dict | None = None) -> dict | None:
    if rule is None:
        return None
    payload = payload if payload is not None else json.loads(rule.extracted_json or "{}")
    return {
        "page_number": rule.source_page_start,
        "page_end": rule.source_page_end,
        "clause_reference": rule.source_section,
        "exact_extracted_text": payload.get("exact_extracted_text") or rule.source_text_excerpt,
        # Pixel bounding boxes require a coordinate-aware PDF parse layer; the
        # text pipeline supplies page + clause + verbatim text for highlighting.
        "bounding_box_coordinates": [],
    }


def _field(value, rule: ExtractedRule | None, payload: dict | None = None) -> dict:
    """A blueprint data point: value + citation + confidence + traffic light."""
    confidence = float(rule.confidence_score) if rule is not None else 0.0
    ambiguous = bool(rule.ambiguous) if rule is not None else False
    status = traffic_light(
        Decimal(str(rule.confidence_score)) if rule is not None else Decimal("0"),
        ambiguous,
    )
    return {
        "value": value,
        "confidence": confidence,
        "status": status,
        "requires_review": rule.requires_human_review if rule is not None else True,
        "ambiguous": ambiguous,
        "citation": _citation(rule, payload),
    }


def build_blueprint(session: Session, *, document_id: int) -> dict:
    """Assemble the FR-2 Fund Logic Blueprint for a document.

    Pulls the document's own (non-superseded) rules for waterfall/fee/identity,
    plus any side-letter override rules across the same fund so the blueprint
    surfaces LP-specific carve-outs (the admin's biggest manual headache)."""
    doc = session.get(SourceDocument, document_id)
    if doc is None:
        raise ValueError(f"document {document_id} not found")

    rules = (
        session.query(ExtractedRule)
        .filter(
            ExtractedRule.document_id == doc.id,
            ExtractedRule.status != RuleStatus.SUPERSEDED,
        )
        .all()
    )

    identity = _pick(rules, ClauseType.FUND_IDENTITY)
    fee = _pick(rules, ClauseType.MANAGEMENT_FEE)
    pref = _pick(rules, ClauseType.PREFERRED_RETURN)
    carry = _pick(rules, ClauseType.CARRIED_INTEREST)

    ident_p = json.loads(identity.extracted_json) if identity else {}
    fee_p = json.loads(fee.extracted_json) if fee else {}
    pref_p = json.loads(pref.extracted_json) if pref else {}
    carry_p = json.loads(carry.extracted_json) if carry else {}

    fund_metadata = {
        "fund_name": _field(ident_p.get("fund_name") or doc.name, identity, ident_p),
        "currency": _field(ident_p.get("currency"), identity, ident_p),
    }

    waterfall_rules = {
        "preferred_return_rate": _field(_pct_to_rate(pref_p.get("rate")), pref, pref_p),
        "calculation_basis": _field(pref_p.get("calculation_basis"), pref, pref_p),
        "gp_catch_up_provision": _field(bool(carry_p.get("catch_up")), carry, carry_p),
        "gp_catch_up_split": _field(carry_p.get("gp_catch_up_split"), carry, carry_p),
        "carried_interest_rate": _field(_pct_to_rate(carry_p.get("carry_percentage")), carry, carry_p),
    }

    fee_economics = {
        "management_fee_rate": _field(_pct_to_rate(fee_p.get("fee_rate")), fee, fee_p),
        "fee_basis_investment_period": _field(
            _basis_label(fee_p.get("fee_basis_investment_period") or fee_p.get("fee_base")), fee, fee_p
        ),
        "fee_basis_post_investment_period": _field(
            _basis_label(fee_p.get("fee_basis_post_investment_period")), fee, fee_p
        ),
    }

    # Side-letter overrides across the fund (FR — "The Overrides").
    overrides = []
    if doc.entity_id is not None:
        sl_rules = (
            session.query(ExtractedRule)
            .filter(
                ExtractedRule.entity_id == doc.entity_id,
                ExtractedRule.rule_type == ClauseType.SIDE_LETTER,
                ExtractedRule.status != RuleStatus.SUPERSEDED,
            )
            .all()
        )
        for sl in sl_rules:
            p = json.loads(sl.extracted_json or "{}")
            overrides.append(
                {
                    "investor_id": sl.investor_id,
                    "override_type": p.get("override_type"),
                    "overridden_clause_type": p.get("overridden_clause_type"),
                    "override_value": p.get("override_value"),
                    **_field(p.get("override_value"), sl, p),
                }
            )

    # Roll up review counts for the traffic-light summary header.
    all_fields = list(fund_metadata.values()) + list(waterfall_rules.values()) + list(fee_economics.values())
    green = sum(1 for f in all_fields if f["status"] == "green_confirmed")
    amber = sum(1 for f in all_fields if f["status"] == "amber_review")

    return {
        "document_id": doc.id,
        "document_name": doc.name,
        "document_type": doc.document_type,
        "page_count": doc.page_count,
        "fund_metadata": fund_metadata,
        "waterfall_rules": waterfall_rules,
        "fee_economics": fee_economics,
        "side_letter_overrides": overrides,
        "summary": {
            "fields_total": len(all_fields),
            "confirmed_green": green,
            "review_amber": amber,
            "overrides_flagged": len(overrides),
        },
    }
