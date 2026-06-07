"""Fund Operating Logic Pack assembly (POC #1 — Fund Document Intelligence
Workbench).

Turns the extracted, source-traceable rules for a fund into the governed
operating package described in the spec's "Definition of Done":

  * Fund Terms Summary
  * Fund Operating Rules (portable JSON)
  * Investor Obligation Matrix      (side-letter intelligence)
  * Reporting Obligation Matrix
  * Obligation Calendar             (documents -> operating deadlines)
  * Exception & Missing Terms Report (issues + conflicts + consistency)

Everything is derived from rules that already carry document/section/page
citations, so the whole pack is auditable back to source.
"""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models.entity import Entity
from app.models.investor import Commitment, Investor
from app.models.lpa import (
    DOCUMENT_AUTHORITY,
    ClauseType,
    DocumentType,
    ExtractedRule,
    RuleConflict,
    RuleIssue,
    RuleStatus,
    SourceDocument,
)
from app.services.lpa_parser import traffic_light
from decimal import Decimal


# Core fund terms surfaced in the Fund Terms Summary (spec §9.1).
def _active_rules(session: Session, entity_id: int) -> list[ExtractedRule]:
    return (
        session.query(ExtractedRule)
        .filter(
            ExtractedRule.entity_id == entity_id,
            ExtractedRule.status != RuleStatus.SUPERSEDED,
        )
        .order_by(ExtractedRule.id)
        .all()
    )


def _authority_map(session: Session, entity_id: int) -> dict[int, int]:
    """document_id -> authority rank (lower = more governing, spec §6)."""
    return {
        d.id: DOCUMENT_AUTHORITY.get(DocumentType(d.document_type), 9)
        for d in session.query(SourceDocument).filter(SourceDocument.entity_id == entity_id).all()
    }


def _pick(
    rules: list[ExtractedRule],
    rule_type: ClauseType,
    authority: dict[int, int] | None = None,
) -> ExtractedRule | None:
    """Choose the governing rule for a clause: approved beats draft, then the
    higher-authority source document wins (LPA over PPM), then most recent."""
    cands = [r for r in rules if r.rule_type == rule_type]
    if not cands:
        return None
    rank = {RuleStatus.APPROVED: 2}
    authority = authority or {}
    cands.sort(
        key=lambda r: (rank.get(r.status, 1), -authority.get(r.document_id, 9), r.id),
        reverse=True,
    )
    return cands[0]


def _cite(rule: ExtractedRule, payload: dict | None = None) -> dict:
    payload = payload if payload is not None else json.loads(rule.extracted_json or "{}")
    return {
        "source_document_id": rule.document_id,
        "source_reference": rule.source_section,
        "page_number": rule.source_page_start,
        "exact_extracted_text": payload.get("exact_extracted_text") or rule.source_text_excerpt,
    }


def fund_terms_summary(session: Session, entity_id: int) -> list[dict]:
    rules = _active_rules(session, entity_id)
    auth = _authority_map(session, entity_id)
    entity = session.get(Entity, entity_id)
    rows: list[dict] = []

    def add(field: str, value, rule: ExtractedRule | None):
        if value is None and rule is None:
            return
        rows.append(
            {
                "field": field,
                "value": value,
                "source_reference": rule.source_section if rule else None,
                "page": rule.source_page_start if rule else None,
                "confidence": float(rule.confidence_score) if rule else None,
                "status": traffic_light(Decimal(str(rule.confidence_score)), rule.ambiguous)
                if rule else "amber_review",
                "review": rule.requires_human_review if rule else True,
            }
        )

    ident = _pick(rules, ClauseType.FUND_IDENTITY, auth)
    ident_p = json.loads(ident.extracted_json) if ident else {}
    add("Fund Name", ident_p.get("fund_name") or (entity.legal_name if entity else None), ident)
    add("Currency", ident_p.get("currency") or (entity.base_currency if entity else None), ident)
    add("Term (years)", ident_p.get("term_years"), ident)

    fee = _pick(rules, ClauseType.MANAGEMENT_FEE, auth)
    fee_p = json.loads(fee.extracted_json) if fee else {}
    add("Management Fee", fee_p.get("fee_rate"), fee)
    add("Fee Basis", (fee_p.get("fee_base") or "").replace("_", " ").title() or None, fee)
    add("Fee Timing", (fee_p.get("frequency") or "").replace("_", " ") or None, fee)

    mandate = _pick(rules, ClauseType.INVESTMENT_MANDATE, auth)
    mandate_p = json.loads(mandate.extracted_json) if mandate else {}
    if mandate:
        strat = f"{(mandate_p.get('geography') or '')} {(mandate_p.get('asset_class') or '').replace('_', ' ')}".strip()
        add("Strategy", strat or None, mandate)

    treasury = _pick(rules, ClauseType.TREASURY, auth)
    if treasury:
        add("Bank", json.loads(treasury.extracted_json).get("bank"), treasury)

    pref = _pick(rules, ClauseType.PREFERRED_RETURN, auth)
    if pref:
        add("Preferred Return", json.loads(pref.extracted_json).get("rate"), pref)
    carry = _pick(rules, ClauseType.CARRIED_INTEREST, auth)
    if carry:
        add("Carried Interest", json.loads(carry.extracted_json).get("carry_percentage"), carry)

    return rows


def operating_rules(session: Session, entity_id: int) -> list[dict]:
    """Portable Fund Operating Rules JSON (spec §9.2)."""
    rules = _active_rules(session, entity_id)
    out: list[dict] = []
    for r in rules:
        payload = json.loads(r.extracted_json or "{}")
        out.append(
            {
                "rule_id": f"RULE_{r.id:04d}",
                "rule_type": r.rule_type.value,
                "source_document_id": r.document_id,
                "source_reference": r.source_section,
                "rule_status": r.status.value,
                "plain_english_summary": payload.get("plain_english_summary"),
                "structured_rule": {
                    k: v for k, v in payload.items()
                    if k not in ("exact_extracted_text", "plain_english_summary",
                                 "evidence_required", "source_clause", "ambiguity_phrase")
                },
                "evidence_required": payload.get("evidence_required", []),
                "confidence_score": float(r.confidence_score),
                "requires_human_review": r.requires_human_review,
                "citation": _cite(r, payload),
            }
        )
    return out


def reporting_obligation_matrix(session: Session, entity_id: int) -> list[dict]:
    """Reporting Obligation Matrix (spec §9.4): fund-level reporting clauses plus
    investor-specific reporting/ESG/tax overrides from side letters."""
    rules = _active_rules(session, entity_id)
    matrix: list[dict] = []

    for r in rules:
        if r.rule_type not in (ClauseType.REPORTING, ClauseType.TAX_REPORTING):
            continue
        p = json.loads(r.extracted_json or "{}")
        matrix.append(
            {
                "report": p.get("report_name")
                or ("Tax Reporting" if r.rule_type == ClauseType.TAX_REPORTING else "Investor Report"),
                "frequency": p.get("frequency"),
                "due_date": p.get("due_date_rule"),
                "recipient": p.get("recipient", "all_limited_partners"),
                "source": r.source_section,
                "owner": p.get("responsible_party", "fund_admin"),
                "evidence": p.get("evidence_required", []),
                "investor_specific": False,
            }
        )

    # investor-specific reporting from side letters
    for r in rules:
        if r.rule_type != ClauseType.SIDE_LETTER:
            continue
        p = json.loads(r.extracted_json or "{}")
        otype = p.get("override_type")
        if otype not in ("enhanced_reporting", "management_fee_discount", "esg_election", "mfn_election"):
            continue
        report = {
            "enhanced_reporting": "Custom Investor Report",
            "management_fee_discount": "Management Fee & Expense Detail",
            "esg_election": "ESG Report",
            "mfn_election": "MFN Election Report",
        }.get(otype, "Custom Report")
        matrix.append(
            {
                "report": report,
                "frequency": "quarterly",
                "due_date": "with_quarterly_package",
                "recipient": _investor_code(session, r.investor_id),
                "source": f"Side Letter {r.source_section or ''}".strip(),
                "owner": "fund_admin",
                "evidence": ["report package", "approval record"],
                "investor_specific": True,
            }
        )
    return matrix


def investor_obligation_matrix(session: Session, entity_id: int) -> list[dict]:
    """Investor Obligation Matrix (spec §9.3): per-investor side-letter intel."""
    investors = (
        session.query(Investor)
        .join(Commitment, Commitment.investor_id == Investor.id)
        .filter(Commitment.entity_id == entity_id)
        .distinct()
        .all()
    )
    # map investor_id -> their side-letter override rules
    sl_rules = (
        session.query(ExtractedRule)
        .filter(
            ExtractedRule.entity_id == entity_id,
            ExtractedRule.rule_type == ClauseType.SIDE_LETTER,
            ExtractedRule.status != RuleStatus.SUPERSEDED,
        )
        .all()
    )
    by_investor: dict[int, list[dict]] = {}
    for r in sl_rules:
        if r.investor_id is None:
            continue
        by_investor.setdefault(r.investor_id, []).append(json.loads(r.extracted_json or "{}"))

    rows: list[dict] = []
    for inv in investors:
        commitment = sum(
            (c.commitment_amount for c in inv.commitments if c.entity_id == entity_id),
            Decimal("0"),
        )
        overrides = by_investor.get(inv.id, [])
        otypes = {o.get("override_type") for o in overrides}
        has_sl = bool(overrides) or inv.side_letter
        rows.append(
            {
                "investor": inv.code,
                "commitment": str(commitment),
                "side_letter": has_sl,
                "custom_reporting": "Fee detail" if "management_fee_discount" in otypes
                else ("Custom" if "enhanced_reporting" in otypes else "Standard"),
                "restriction": "Excuse right" if "excuse_right" in otypes
                else ("ESG exclusion" if "esg_election" in otypes else "None"),
                "tax_requirement": "Standard K-1",
                "notice_variant": "Standard",
                "mfn": "mfn_election" in otypes,
                "review_needed": has_sl,
            }
        )
    return rows


def obligation_calendar(session: Session, entity_id: int) -> list[dict]:
    """Obligation Calendar (spec §9.5): turns recurring rules into deadlines."""
    rules = _active_rules(session, entity_id)
    auth = _authority_map(session, entity_id)
    cal: list[dict] = []

    def add(timing: str, obligation: str, source: str | None, action: str):
        cal.append({"timing": timing, "obligation": obligation, "source": source, "required_action": action})

    fee = _pick(rules, ClauseType.MANAGEMENT_FEE, auth)
    if fee:
        p = json.loads(fee.extracted_json)
        timing = (p.get("frequency") or "quarterly").replace("_", " ")
        add(timing, "Calculate management fees", fee.source_section, "Prepare and approve fee calculation")

    expense = _pick(rules, ClauseType.FUND_EXPENSE, auth)
    if expense:
        add("Quarterly", "Accrue fund expenses (audit/tax)", expense.source_section, "Book quarterly accrual")
        add("Annually", "Pay audit & tax fees", expense.source_section, "Process payment")

    for r in rules:
        if r.rule_type in (ClauseType.REPORTING, ClauseType.TAX_REPORTING):
            p = json.loads(r.extracted_json or "{}")
            name = p.get("report_name") or ("Tax reporting" if r.rule_type == ClauseType.TAX_REPORTING else "Investor report")
            freq = (p.get("frequency") or "periodic").title()
            add(freq, f"Deliver {name}", r.source_section, "Generate, approve, and distribute")

    cc = _pick(rules, ClauseType.CAPITAL_CALL, auth)
    if cc:
        add("Event-driven", "Issue capital call notice", cc.source_section, "Prepare call package")
    return cal


def exception_report(session: Session, entity_id: int) -> list[dict]:
    """Exception & Missing Terms Report (spec §9.6): unresolved issues +
    conflicts + consistency findings."""
    issues = (
        session.query(RuleIssue)
        .filter(RuleIssue.entity_id == entity_id, RuleIssue.resolved.is_(False))
        .all()
    )
    conflicts = (
        session.query(RuleConflict)
        .filter(RuleConflict.entity_id == entity_id, RuleConflict.resolved.is_(False))
        .all()
    )
    out: list[dict] = []
    for i in issues:
        out.append(
            {
                "kind": i.issue_type.value,
                "severity": i.severity.value,
                "subject": i.rule_type.value if i.rule_type else None,
                "explanation": i.message,
                "action": "Human review",
            }
        )
    for c in conflicts:
        out.append(
            {
                "kind": c.conflict_type,
                "severity": c.severity.value,
                "subject": None,
                "explanation": f"{c.base_rule_summary} vs {c.conflicting_rule_summary}",
                "action": c.resolution or "Review",
            }
        )
    return out


def _investor_code(session: Session, investor_id: int | None) -> str:
    if investor_id is None:
        return "investor"
    inv = session.get(Investor, investor_id)
    return inv.code if inv else f"investor_{investor_id}"


def build_operating_pack(session: Session, entity_id: int) -> dict:
    """Assemble the complete Fund Operating Logic Pack for a fund."""
    entity = session.get(Entity, entity_id)
    if entity is None:
        raise ValueError(f"entity {entity_id} not found")

    docs = (
        session.query(SourceDocument)
        .filter(SourceDocument.entity_id == entity_id)
        .all()
    )
    exceptions = exception_report(session, entity_id)
    rules = operating_rules(session, entity_id)
    high = sum(1 for e in exceptions if e["severity"] in ("high", "critical"))
    return {
        "fund_id": entity.code,
        "fund_name": entity.legal_name,
        "documents": [
            {"id": d.id, "name": d.name, "type": d.document_type,
             "authority": _authority(DocumentType(d.document_type))}
            for d in docs
        ],
        "fund_terms_summary": fund_terms_summary(session, entity_id),
        "operating_rules": rules,
        "investor_obligation_matrix": investor_obligation_matrix(session, entity_id),
        "reporting_obligation_matrix": reporting_obligation_matrix(session, entity_id),
        "obligation_calendar": obligation_calendar(session, entity_id),
        "exception_report": exceptions,
        "summary": {
            "documents": len(docs),
            "rules": len(rules),
            "open_exceptions": len(exceptions),
            "high_severity_exceptions": high,
        },
    }


def _authority(dtype: DocumentType) -> int:
    from app.models.lpa import DOCUMENT_AUTHORITY
    return DOCUMENT_AUTHORITY.get(dtype, 9)
