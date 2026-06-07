"""Deterministic LPA parsing engine.

This is *not* a generic PDF chatbot. It is a deterministic fund operating
rule extraction pipeline:

    1. accept document text (page breaks preserved as form-feed ``\\f`` or the
       literal token ``[[page]]``);
    2. split into numbered sections, preserving page ranges;
    3. classify each section against the approved clause taxonomy;
    4. extract a structured rule from each relevant section;
    5. attach exact source traceability + a confidence score;
    6. flag for human review when confidence is low or money moves.

The extractor is intentionally rule-based so its output is reproducible and
testable. The :class:`Extractor` protocol leaves room to swap in an
LLM-backed implementation later without changing the rest of the pipeline.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal

from app.models.lpa import ClauseType, DocumentType


# Clause types whose rules move money or drive investor economics. These always
# require human review regardless of confidence.
MONEY_MOVEMENT_CLAUSES: frozenset[ClauseType] = frozenset(
    {
        ClauseType.MANAGEMENT_FEE,
        ClauseType.FUND_EXPENSE,
        ClauseType.DISTRIBUTION_WATERFALL,
        ClauseType.PREFERRED_RETURN,
        ClauseType.CARRIED_INTEREST,
        ClauseType.CATCH_UP,
        ClauseType.CLAWBACK,
        ClauseType.CAPITAL_CALL,
        ClauseType.TAX_DISTRIBUTION,
        ClauseType.PROFIT_LOSS_ALLOCATION,
    }
)

# Operating rules a private-equity LPA is expected to define. Absence of any of
# these after parsing raises a missing-rule issue.
REQUIRED_PE_RULES: tuple[ClauseType, ...] = (
    ClauseType.CAPITAL_CALL,
    ClauseType.MANAGEMENT_FEE,
    ClauseType.FUND_EXPENSE,
    ClauseType.INVESTMENT_PERIOD,
    ClauseType.DISTRIBUTION_WATERFALL,
    ClauseType.PREFERRED_RETURN,
    ClauseType.CARRIED_INTEREST,
    ClauseType.CLAWBACK,
    ClauseType.PROFIT_LOSS_ALLOCATION,
    ClauseType.REPORTING,
    ClauseType.TRANSFER,
    ClauseType.VALUATION,
    ClauseType.FUND_TERMINATION,
)

REVIEW_THRESHOLD = Decimal("0.90")

_PCT = re.compile(r"(\d+(?:\.\d+)?)\s*%")
_DAYS = re.compile(r"(\d+)\s*(?:calendar|business)?\s*[- ]?\s*days", re.IGNORECASE)
_SECTION_HEADER = re.compile(
    r"^\s*(?:\[\[page\]\]|\f)?\s*(?:Section|Article|Clause|§)\s+(\d+(?:\.\d+)*(?:\([a-z]\))?)",
    re.IGNORECASE,
)
_PAGE_MARKER = re.compile(r"\f|\[\[page\]\]")

_NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
}

# phrase -> clause type. Longer / more specific phrases score higher.
_CLAUSE_KEYWORDS: dict[ClauseType, tuple[str, ...]] = {
    ClauseType.MANAGEMENT_FEE: ("management fee",),
    ClauseType.PREFERRED_RETURN: ("preferred return", "hurdle rate", "priority return"),
    ClauseType.CARRIED_INTEREST: ("carried interest", "performance allocation", "incentive allocation"),
    ClauseType.CATCH_UP: ("catch-up", "catch up", "catchup"),
    ClauseType.CLAWBACK: ("clawback", "claw-back", "giveback", "give-back"),
    ClauseType.CAPITAL_CALL: ("capital call", "drawdown", "draw-down", "call notice"),
    ClauseType.CAPITAL_COMMITMENT: ("capital commitment", "committed capital"),
    ClauseType.DISTRIBUTION_WATERFALL: ("distribution waterfall", "distributions shall be", "waterfall", "order of distributions"),
    ClauseType.TAX_DISTRIBUTION: ("tax distribution", "tax advance"),
    ClauseType.FUND_EXPENSE: ("fund expenses", "organizational expenses", "organisational expenses", "partnership expenses"),
    ClauseType.INVESTMENT_PERIOD: ("investment period", "commitment period"),
    ClauseType.INVESTMENT_RESTRICTION: ("investment restriction", "investment limitation", "concentration limit"),
    ClauseType.PROFIT_LOSS_ALLOCATION: ("allocation of profits", "profits and losses", "capital account"),
    ClauseType.TRANSFER: ("transfer of interest", "assignment of interest", "permitted transfer"),
    ClauseType.WITHDRAWAL: ("withdrawal", "redemption"),
    ClauseType.REPORTING: ("financial statements", "quarterly report", "annual report", "reporting"),
    ClauseType.VALUATION: ("valuation", "fair value", "fair market value"),
    ClauseType.ADVISORY_COMMITTEE: ("advisory committee", "lpac"),
    ClauseType.KEY_PERSON: ("key person", "key man"),
    ClauseType.GP_REMOVAL: ("removal of the general partner", "for cause removal", "no-fault removal"),
    ClauseType.FUND_TERMINATION: ("term of the fund", "dissolution", "liquidation", "termination of the fund"),
    ClauseType.DEFAULT: ("defaulting limited partner", "default", "failure to fund"),
    ClauseType.MFN: ("most favored nation", "most favoured nation", "mfn"),
    ClauseType.CONFIDENTIALITY: ("confidential",),
    ClauseType.REGULATORY: ("erisa", "aifmd", "regulatory"),
    ClauseType.CONSENT: ("majority in interest", "supermajority", "consent of the limited partners", "vote of"),
    ClauseType.FUND_IDENTITY: ("name of the fund", "formed under", "formation of the partnership", "general partner of the fund"),
    ClauseType.DEFINITIONS: ("as used in this agreement", "definitions"),
}


@dataclass
class Section:
    number: str | None
    title: str
    body: str
    page_start: int
    page_end: int


@dataclass
class RuleCandidate:
    rule_type: ClauseType
    clause_type: ClauseType
    extracted: dict
    confidence: Decimal
    explanation: str
    source_section: str | None
    source_page_start: int
    source_page_end: int
    source_text_excerpt: str
    requires_human_review: bool = field(default=True)


def split_sections(text: str) -> list[Section]:
    """Split raw document text into numbered sections, tracking page ranges.

    Page boundaries are inferred from form-feed characters or ``[[page]]``
    tokens; each marker advances the page counter by one (documents start on
    page 1)."""
    # Build a map of character offset -> page number.
    page_at: list[tuple[int, int]] = []  # (offset, page)
    page = 1
    page_at.append((0, 1))
    for m in _PAGE_MARKER.finditer(text):
        page += 1
        page_at.append((m.end(), page))
    max_page = page

    def page_for(offset: int) -> int:
        result = 1
        for off, pg in page_at:
            if off <= offset:
                result = pg
            else:
                break
        return result

    # Identify section header line offsets. `body_offset` is where the section
    # body begins; `number_offset` (position of the section number) is used for
    # page lookup so an inline page marker before the header counts correctly.
    headers: list[tuple[int, int, str, str]] = []  # (body_offset, number_offset, number, title)
    for m in re.finditer(r"(?m)^.*$", text):
        line = m.group(0)
        hm = _SECTION_HEADER.match(line)
        if hm:
            number = hm.group(1)
            title = line[hm.end():].strip(" .:-\t")
            headers.append((m.start(), m.start() + hm.start(1), number, title))

    sections: list[Section] = []
    if not headers:
        clean = re.sub(r"\s+", " ", _PAGE_MARKER.sub(" ", text)).strip()
        if clean:
            sections.append(Section(None, "", clean, 1, max_page))
        return sections

    for idx, (offset, number_offset, number, title) in enumerate(headers):
        end = headers[idx + 1][0] if idx + 1 < len(headers) else len(text)
        raw_body = text[offset:end]
        # Collapse line wraps and page markers to single spaces so phrase
        # matching is robust to how the document happens to be line-broken
        # (e.g. "net\nof tax" must still match "net of tax").
        body = re.sub(r"\s+", " ", _PAGE_MARKER.sub(" ", raw_body)).strip()
        sections.append(
            Section(
                number=number,
                title=title,
                body=body,
                page_start=page_for(number_offset),
                page_end=page_for(max(number_offset, end - 1)),
            )
        )
    return sections


def classify(section: Section) -> ClauseType:
    """Score a section against the keyword taxonomy and return the best clause
    type, or UNKNOWN when nothing matches."""
    title = section.title.lower()
    body = section.body.lower()
    best: ClauseType = ClauseType.UNKNOWN
    best_score = 0
    for clause, phrases in _CLAUSE_KEYWORDS.items():
        score = 0
        for phrase in phrases:
            weight = len(phrase.split())  # weight by phrase specificity
            score += body.count(phrase) * weight
            # a heading match is a far stronger signal than a body mention
            score += title.count(phrase) * weight * 5
        if score > best_score:
            best_score = score
            best = clause
    return best


# --------------------------------------------------------------------------- #
# Per-clause structured extractors                                             #
# --------------------------------------------------------------------------- #

def _first_pct(text: str) -> str | None:
    m = _PCT.search(text)
    return f"{m.group(1)}%" if m else None


def _all_pcts(text: str) -> list[str]:
    return [f"{m.group(1)}%" for m in _PCT.finditer(text)]


def _first_days(text: str) -> int | None:
    m = _DAYS.search(text)
    return int(m.group(1)) if m else None


def _years(text: str) -> int | None:
    low = text.lower()
    m = re.search(r"(\d+)\s*[- ]?\s*year", low)
    if m:
        return int(m.group(1))
    for word, val in _NUMBER_WORDS.items():
        if re.search(rf"\b{word}\b[^.]*?year", low):
            return val
    return None


def _confidence(found: int, expected: int, *, floor: Decimal = Decimal("0.50")) -> Decimal:
    if expected <= 0:
        return floor
    ratio = Decimal(found) / Decimal(expected)
    value = floor + (Decimal("0.95") - floor) * ratio
    return min(value, Decimal("0.95")).quantize(Decimal("0.001"))


def _excerpt(body: str, limit: int = 600) -> str:
    body = re.sub(r"\s+", " ", body).strip()
    return body if len(body) <= limit else body[:limit].rstrip() + "…"


def _extract_management_fee(s: Section) -> tuple[dict, Decimal, str]:
    body = s.body
    low = body.lower()
    pcts = _all_pcts(body)
    rate = pcts[0] if pcts else None
    # Pick the fee base nearest the *primary* rate (earliest in the clause), so
    # a step-down base mentioned later doesn't shadow the headline base.
    base = None
    base_pos = len(low) + 1
    for label, key in (
        ("net invested capital", "net_invested_capital"),
        ("invested capital", "invested_capital"),
        ("committed capital", "committed_capital"),
        ("net asset value", "nav"),
        ("cost basis", "cost_basis"),
        ("capital contributions", "capital_contributions"),
    ):
        idx = low.find(label)
        if idx != -1 and idx < base_pos:
            base, base_pos = key, idx
    frequency = None
    if "quarter" in low:
        frequency = "quarterly_in_advance" if "in advance" in low else "quarterly"
    elif "annual" in low or "per annum" in low:
        frequency = "annually"
    step_down = "step" in low or "reduce" in low or "reduced" in low
    offsets = [o for o, kw in (
        ("transaction_fees", "transaction fee"),
        ("monitoring_fees", "monitoring fee"),
        ("directors_fees", "director"),
        ("break_up_fees", "break-up"),
    ) if kw in low]
    extracted: dict = {
        "rule_type": "management_fee",
        "fee_rate": rate,
        "fee_base": base,
        "frequency": frequency,
        "offsets": offsets,
        "source_clause": _section_ref(s),
    }
    if step_down:
        extracted["step_down_trigger"] = "end_of_investment_period"
        if len(pcts) > 1:
            extracted["post_step_down_rate"] = pcts[1]
    found = sum(x is not None and x != [] for x in (rate, base, frequency))
    conf = _confidence(found, 3)
    expl = "Drives periodic management-fee accruals charged to investors."
    return extracted, conf, expl


def _extract_preferred_return(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    rate = _first_pct(s.body)
    method = "compound" if "compound" in low else ("simple" if "simple" in low else None)
    comp = None
    if "annual" in low:
        comp = "annual"
    elif "quarter" in low:
        comp = "quarterly"
    base = None
    if "unreturned" in low:
        base = "unreturned_contributed_capital"
    elif "contributed capital" in low or "capital contribution" in low:
        base = "contributed_capital"
    day_count = "actual_365" if "365" in low else ("actual_360" if "360" in low else None)
    extracted = {
        "rule_type": "preferred_return",
        "rate": rate,
        "calculation_method": method,
        "compounding_frequency": comp,
        "base": base,
        "day_count_convention": day_count,
        "source_clause": _section_ref(s),
    }
    found = sum(x is not None for x in (rate, method, comp, base))
    return extracted, _confidence(found, 4), "Hurdle that must be met before carry is paid."


def _extract_carried_interest(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    carry = _first_pct(s.body)
    extracted = {
        "rule_type": "carried_interest",
        "carry_percentage": carry,
        "recipient": "general_partner",
        "catch_up": "catch-up" in low or "catch up" in low or "catchup" in low,
        "clawback_required": "clawback" in low or "claw-back" in low,
        "source_clause": _section_ref(s),
    }
    found = sum(bool(x) for x in (carry, extracted["catch_up"]))
    return extracted, _confidence(found, 2), "GP profit share; gates downstream clawback exposure."


def _extract_capital_call(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    notice = _first_days(s.body)
    default_interest = None
    pm = re.search(r"prime\s*(?:rate)?\s*\+\s*(\d+(?:\.\d+)?)\s*%", low)
    if pm:
        default_interest = f"prime + {pm.group(1)}%"
    elif "default" in low:
        dp = _first_pct(s.body)
        default_interest = dp
    remedies = [r for r, kw in (
        ("suspension_of_voting_rights", "voting"),
        ("forfeiture", "forfeit"),
        ("forced_sale", "forced sale"),
        ("interest_penalty", "interest"),
    ) if kw in low]
    extracted = {
        "rule_type": "capital_call",
        "notice_period_days": notice,
        "due_date_rule": "business_days_after_notice" if "business day" in low else "days_after_notice",
        "default_interest_rate": default_interest,
        "default_remedies": remedies,
        "source_clause": _section_ref(s),
    }
    found = sum(x not in (None, []) for x in (notice, default_interest, remedies))
    return extracted, _confidence(found, 3), "Controls drawdown timing, due dates, and default remedies."


def _extract_distribution_waterfall(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    wtype = "unknown"
    if "deal-by-deal" in low or "deal by deal" in low or "american" in low:
        wtype = "american_deal_by_deal"
    elif "whole fund" in low or "whole-fund" in low or "european" in low:
        wtype = "european_whole_fund"
    elif "hybrid" in low:
        wtype = "hybrid"
    elif "return of" in low and ("preferred" in low or "carried" in low):
        wtype = "european_whole_fund"
    steps: list[dict] = []
    order = 1
    if "return of" in low or "return capital" in low:
        steps.append({"order": order, "recipient": "limited_partners", "amount": "return_of_contributed_capital"})
        order += 1
    if "preferred" in low or "hurdle" in low:
        steps.append({"order": order, "recipient": "limited_partners", "amount": "preferred_return", "rate": _first_pct(s.body)})
        order += 1
    if "catch" in low:
        steps.append({"order": order, "recipient": "general_partner", "amount": "catch_up"})
        order += 1
    if "carried" in low or "carry" in low or "% / " in s.body or "/20" in s.body:
        steps.append({"order": order, "recipient": "limited_partners_and_general_partner", "amount": "carried_interest_split"})
    extracted = {
        "rule_type": "distribution_waterfall",
        "waterfall_type": wtype,
        "steps": steps,
        "source_clause": _section_ref(s),
    }
    found = (wtype != "unknown") + min(len(steps), 3)
    return extracted, _confidence(found, 4), "Defines the exact distribution sequence; validated independently."


def _extract_clawback(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    extracted = {
        "rule_type": "clawback",
        "obligor": "general_partner",
        "trigger": "fund_liquidation" if "liquidation" in low or "dissolution" in low else "end_of_term",
        "calculation": "excess_carry_received_over_entitlement",
        "net_of_tax": "net of tax" in low or "after-tax" in low or "after tax" in low,
        "payment_deadline_days": _first_days(s.body),
        "source_clause": _section_ref(s),
    }
    found = 2 + (extracted["payment_deadline_days"] is not None)
    return extracted, _confidence(found, 3), "GP giveback obligation; protects LPs from over-distributed carry."


def _extract_investment_period(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    events = [e for e, kw in (
        ("key_person_event", "key person"),
        ("gp_removal", "removal"),
        ("lp_supermajority_vote", "supermajority"),
    ) if kw in low]
    extracted = {
        "rule_type": "investment_period",
        "start_event": "initial_closing",
        "duration_years": _years(s.body),
        "early_termination_events": events,
        "source_clause": _section_ref(s),
    }
    found = (extracted["duration_years"] is not None) + (len(events) > 0)
    return extracted, _confidence(found, 2), "Bounds when new investments and full fees apply."


def _extract_fund_expense(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    cap = None
    mcap = re.search(r"cap(?:ped)?\s+(?:at\s+)?\$?\s*([\d,]+)", low)
    if mcap:
        cap = int(mcap.group(1).replace(",", ""))
    extracted = {
        "rule_type": "expense_allocation",
        "expense_type": "organizational_expenses" if "organi" in low else "fund_expenses",
        "cap_amount": cap,
        "allocation_basis": "pro_rata_by_commitment",
        "excess_paid_by": "manager" if cap is not None else None,
        "source_clause": _section_ref(s),
    }
    found = 1 + (cap is not None)
    return extracted, _confidence(found, 2), "Separates fund vs manager expenses and caps."


def _extract_reporting(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    rtype = "audited_financial_statements" if "audit" in low else "investor_report"
    freq = "annual" if "annual" in low else ("quarterly" if "quarter" in low else None)
    deadline = _first_days(s.body)
    extracted = {
        "rule_type": "reporting_obligation",
        "report_type": rtype,
        "frequency": freq,
        "deadline_days_after_period_end": deadline,
        "recipient": "limited_partners",
        "source_clause": _section_ref(s),
    }
    found = 1 + (freq is not None) + (deadline is not None)
    return extracted, _confidence(found, 3), "Reporting cadence and deadlines owed to investors."


def _extract_consent(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    threshold = None
    if "two-thirds" in low or "two thirds" in low or "66" in low:
        threshold = "two_thirds_in_interest"
    elif "supermajority" in low:
        threshold = "supermajority_in_interest"
    elif "majority" in low:
        threshold = "majority_in_interest"
    elif "unanimous" in low:
        threshold = "unanimous"
    extracted = {
        "rule_type": "consent_right",
        "approval_required_from": "limited_partners",
        "threshold": threshold,
        "source_clause": _section_ref(s),
    }
    return extracted, _confidence(1 if threshold else 0, 1), "Voting thresholds governing fund actions."


def _extract_key_person(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    extracted = {
        "rule_type": "key_person_event",
        "trigger": "key_persons_cease_to_devote_substantial_time",
        "effect": "investment_period_suspended" if "suspend" in low else "lp_vote",
        "cure_period_days": _first_days(s.body),
        "source_clause": _section_ref(s),
    }
    return extracted, _confidence(1 + (extracted["cure_period_days"] is not None), 2), "Suspends investing if key persons depart."


def _extract_transfer(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    permitted = [p for p, kw in (
        ("affiliate", "affiliate"),
        ("family_trust", "family"),
    ) if kw in low]
    extracted = {
        "rule_type": "transfer_restriction",
        "gp_consent_required": "consent of the general partner" in low or "gp consent" in low or "consent" in low,
        "permitted_transfers": permitted,
        "source_clause": _section_ref(s),
    }
    return extracted, _confidence(1 + (len(permitted) > 0), 2), "Restricts LP interest transfers."


def _extract_profit_loss(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    specials = [x for x, kw in (
        ("qualified_income_offset", "qualified income offset"),
        ("minimum_gain_chargeback", "minimum gain chargeback"),
    ) if kw in low]
    extracted = {
        "rule_type": "profit_loss_allocation",
        "profits_basis": "in_accordance_with_distribution_waterfall",
        "losses_basis": "pro_rata_by_capital_accounts",
        "special_allocations": specials,
        "source_clause": _section_ref(s),
    }
    return extracted, _confidence(1 + (len(specials) > 0), 2), "Book/tax allocation methodology."


def _extract_fund_identity(s: Section) -> tuple[dict, Decimal, str]:
    extracted = {
        "rule_type": "fund_identity",
        "term_years": _years(s.body),
        "source_clause": _section_ref(s),
    }
    return extracted, _confidence(1 if extracted["term_years"] else 0, 1), "Core fund identity and term."


def _extract_generic(s: Section, clause: ClauseType) -> tuple[dict, Decimal, str]:
    return (
        {"rule_type": clause.value, "source_clause": _section_ref(s)},
        Decimal("0.450"),
        "Operationally relevant clause; details require human review.",
    )


_EXTRACTORS = {
    ClauseType.MANAGEMENT_FEE: _extract_management_fee,
    ClauseType.PREFERRED_RETURN: _extract_preferred_return,
    ClauseType.CARRIED_INTEREST: _extract_carried_interest,
    ClauseType.CAPITAL_CALL: _extract_capital_call,
    ClauseType.DISTRIBUTION_WATERFALL: _extract_distribution_waterfall,
    ClauseType.CLAWBACK: _extract_clawback,
    ClauseType.INVESTMENT_PERIOD: _extract_investment_period,
    ClauseType.FUND_EXPENSE: _extract_fund_expense,
    ClauseType.REPORTING: _extract_reporting,
    ClauseType.CONSENT: _extract_consent,
    ClauseType.KEY_PERSON: _extract_key_person,
    ClauseType.TRANSFER: _extract_transfer,
    ClauseType.PROFIT_LOSS_ALLOCATION: _extract_profit_loss,
    ClauseType.FUND_IDENTITY: _extract_fund_identity,
}


def _section_ref(s: Section) -> str | None:
    return f"Section {s.number}" if s.number else None


# Side-letter override detection — maps override intent to the LPA clause it
# modifies, scoped to the document's investor.
_SIDE_LETTER_OVERRIDES: tuple[tuple[str, ClauseType, str], ...] = (
    ("management fee", ClauseType.MANAGEMENT_FEE, "management_fee_discount"),
    ("most favored nation", ClauseType.MFN, "mfn_election"),
    ("most favoured nation", ClauseType.MFN, "mfn_election"),
    ("excuse", ClauseType.CAPITAL_CALL, "excuse_right"),
    ("transfer", ClauseType.TRANSFER, "transfer_accommodation"),
    ("reporting", ClauseType.REPORTING, "enhanced_reporting"),
)


def _extract_side_letter(s: Section) -> RuleCandidate | None:
    low = s.body.lower()
    for phrase, clause, override_type in _SIDE_LETTER_OVERRIDES:
        if phrase in low:
            value = _first_pct(s.body) if clause == ClauseType.MANAGEMENT_FEE else None
            extracted = {
                "rule_type": "side_letter_override",
                "override_type": override_type,
                "overridden_clause_type": clause.value,
                "override_value": value,
                "source_clause": _section_ref(s),
            }
            found = 1 + (value is not None)
            conf = _confidence(found, 2)
            return RuleCandidate(
                rule_type=ClauseType.SIDE_LETTER,
                clause_type=clause,
                extracted=extracted,
                confidence=conf,
                explanation=f"Side-letter override of {clause.value} for this investor only.",
                source_section=_section_ref(s),
                source_page_start=s.page_start,
                source_page_end=s.page_end,
                source_text_excerpt=_excerpt(s.body),
                requires_human_review=True,
            )
    return None


def extract_from_section(section: Section, document_type: DocumentType) -> RuleCandidate | None:
    """Classify a single section and extract its structured rule, if any."""
    if document_type == DocumentType.SIDE_LETTER:
        side = _extract_side_letter(section)
        if side is not None:
            return side

    clause = classify(section)
    if clause == ClauseType.UNKNOWN:
        return None

    extractor = _EXTRACTORS.get(clause)
    if extractor is not None:
        extracted, confidence, explanation = extractor(section)
    else:
        extracted, confidence, explanation = _extract_generic(section, clause)

    requires_review = confidence < REVIEW_THRESHOLD or clause in MONEY_MOVEMENT_CLAUSES
    return RuleCandidate(
        rule_type=clause,
        clause_type=clause,
        extracted=extracted,
        confidence=confidence,
        explanation=explanation,
        source_section=_section_ref(section),
        source_page_start=section.page_start,
        source_page_end=section.page_end,
        source_text_excerpt=_excerpt(section.body),
        requires_human_review=requires_review,
    )


def parse_document(text: str, document_type: DocumentType) -> list[RuleCandidate]:
    """Full pipeline: split → classify → extract for an entire document."""
    candidates: list[RuleCandidate] = []
    for section in split_sections(text):
        candidate = extract_from_section(section, document_type)
        if candidate is not None:
            candidates.append(candidate)
    return candidates


def page_count(text: str) -> int:
    return len(_PAGE_MARKER.findall(text)) + 1
