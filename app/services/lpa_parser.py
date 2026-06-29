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
# Traffic-light thresholds (FR-4): green = confirmed, amber = review.
GREEN_THRESHOLD = Decimal("0.90")
AMBER_THRESHOLD = Decimal("0.75")
# Ceiling applied to confidence when an ambiguity phrase is present, forcing
# the rule into the amber "needs human review" band.
AMBIGUOUS_CONFIDENCE_CEILING = Decimal("0.70")

# Discretionary / ambiguous legal phrases that must trigger human review
# regardless of how cleanly the surrounding values parsed (FR-4).
AMBIGUITY_PHRASES: tuple[str, ...] = (
    "unless otherwise determined by the general partner",
    "unless otherwise agreed",
    "in the sole discretion",
    "in its sole discretion",
    "as the general partner may determine",
    "as the general partner may decide",
    "as may be determined by the general partner",
    "may, in its discretion",
    "to the extent determined by the general partner",
    "as may be agreed",
    "from time to time as determined",
    "subject to adjustment",
)

_PCT = re.compile(r"(\d+(?:\.\d+)?)\s*%")
_SPLIT = re.compile(r"\b(\d{1,3})\s*/\s*(\d{1,3})\b")
_CURRENCY_WORDS = {
    "u.s. dollar": "USD", "us dollar": "USD", "united states dollar": "USD",
    "dollar": "USD", "euro": "EUR", "pound sterling": "GBP", "sterling": "GBP",
    "british pound": "GBP", "swiss franc": "CHF", "japanese yen": "JPY", "yen": "JPY",
}
_ISO_CURRENCY = re.compile(r"\b(USD|EUR|GBP|CHF|JPY|CAD|AUD|HKD|SGD|SEK|NOK|DKK)\b")
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
    ClauseType.INVESTMENT_RESTRICTION: ("investment restriction", "investment limitation", "concentration limit", "leverage limit", "prohibited investment"),
    ClauseType.INVESTMENT_MANDATE: ("investment mandate", "investment objective", "investment strategy", "the fund shall invest", "invest primarily", "asset class"),
    ClauseType.TAX_REPORTING: ("schedule k-1", "k-1", "ubti", "eci", "fatca", "crs", "tax reporting", "withholding"),
    ClauseType.TREASURY: ("wire instructions", "banking relationship", "bank account", "cash management", "signatory", "treasury"),
    ClauseType.ESG: ("esg", "environmental, social", "sustainability", "responsible investment"),
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
    ClauseType.FUND_IDENTITY: ("name of the fund", "name of the partnership", "formed under", "formation of the partnership", "base currency", "general partner of the fund"),
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
    exact_extracted_text: str = field(default="")
    requires_human_review: bool = field(default=True)
    ambiguous: bool = field(default=False)


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


def _strip_header(body: str) -> str:
    """Remove the leading 'Section N Title' echo from a section body."""
    m = re.match(r"^\s*(?:Section|Article|Clause|§)\s+\S+\s*", body, re.IGNORECASE)
    return body[m.end():].lstrip() if m else body


def _verbatim(body: str, *keywords: str, limit: int = 300) -> str:
    """Return the literal sentence best evidencing the extraction (FR-3
    exact_extracted_text). Prefers a sentence containing one of `keywords`,
    else the first substantive sentence."""
    text = _strip_header(body)
    sentences = [s.strip() for s in re.split(r"(?<=[.;:])\s+", text) if s.strip()]
    if not sentences:
        return text[:limit]
    low_keywords = [k.lower() for k in keywords]
    for sentence in sentences:
        low = sentence.lower()
        if any(k in low for k in low_keywords):
            return sentence[:limit]
    return sentences[0][:limit]


def _catch_up_split(text: str) -> str | None:
    m = _SPLIT.search(text)
    return f"{m.group(1)}/{m.group(2)}" if m else None


def _detect_ambiguity(text: str) -> str | None:
    low = text.lower()
    for phrase in AMBIGUITY_PHRASES:
        if phrase in low:
            return phrase
    return None


def traffic_light(confidence: Decimal, ambiguous: bool) -> str:
    """Map confidence + ambiguity onto the FR-4 traffic-light system."""
    if ambiguous or confidence < AMBER_THRESHOLD:
        return "amber_review"
    if confidence >= GREEN_THRESHOLD:
        return "green_confirmed"
    return "amber_review"


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
        "fee_basis_investment_period": base,
        "frequency": frequency,
        "offsets": offsets,
        "source_clause": _section_ref(s),
    }
    if step_down:
        extracted["step_down_trigger"] = "end_of_investment_period"
        if len(pcts) > 1:
            extracted["post_step_down_rate"] = pcts[1]
        # the fee base named *after* the earliest step-down indicator is the
        # post-period basis (commonly invested capital).
        indicators = [low.find(k) for k in ("step down", "step-down", "step", "following")]
        step_pos = min([p for p in indicators if p >= 0], default=-1)
        post_base = None
        post_pos = len(low) + 1
        for label, key in (
            ("net invested capital", "net_invested_capital"),
            ("invested capital", "invested_capital"),
            ("committed capital", "committed_capital"),
            ("net asset value", "nav"),
        ):
            idx = low.find(label, step_pos if step_pos >= 0 else 0)
            if idx != -1 and idx < post_pos:
                post_base, post_pos = key, idx
        extracted["fee_basis_post_investment_period"] = post_base
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
    # Human-readable basis for the blueprint, e.g. "Compounded Annually".
    calc_basis = None
    if method == "compound":
        adverb = {"annual": "Annually", "quarterly": "Quarterly"}.get(comp)
        calc_basis = f"Compounded {adverb}" if adverb else "Compounded"
    elif method == "simple":
        calc_basis = "Simple"
    extracted = {
        "rule_type": "preferred_return",
        "rate": rate,
        "calculation_method": method,
        "calculation_basis": calc_basis,
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
    has_catchup = "catch-up" in low or "catch up" in low or "catchup" in low
    extracted = {
        "rule_type": "carried_interest",
        "carry_percentage": carry,
        "recipient": "general_partner",
        "catch_up": has_catchup,
        "gp_catch_up_split": _catch_up_split(s.body),
        "clawback_required": "clawback" in low or "claw-back" in low,
        "source_clause": _section_ref(s),
    }
    found = sum(bool(x) for x in (carry, has_catchup))
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
    if "audit" in low:
        report_name = "Audited Financial Statements"
    elif "capital account" in low:
        report_name = "Capital Account Statement"
    elif "financial statement" in low:
        report_name = "Financial Statements"
    elif "nav" in low or "net asset value" in low:
        report_name = "NAV Statement"
    else:
        report_name = "Investor Report"
    freq = "annual" if "annual" in low else ("quarterly" if "quarter" in low else None)
    deadline = _first_days(s.body)
    due_date_rule = (
        f"{deadline}_days_after_period_end" if deadline is not None else None
    )
    extracted = {
        "rule_type": "reporting_obligation",
        "report_name": report_name,
        "frequency": freq,
        "deadline_days_after_period_end": deadline,
        "due_date_rule": due_date_rule,
        "recipient": "all_limited_partners",
        "responsible_party": "fund_admin",
        "investor_specific": False,
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


def _extract_investment_mandate(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    asset_class = None
    for label, key in (
        ("real estate", "real_estate"),
        ("private equity", "private_equity"),
        ("infrastructure", "infrastructure"),
        ("private credit", "private_credit"),
        ("venture", "venture_capital"),
    ):
        if label in low:
            asset_class = key
            break
    geography = None
    non_us_permitted = None
    if "united states" in low or "u.s." in low or "us-only" in low or "us only" in low:
        geography = "United States"
        non_us_permitted = not ("north america" in low or "global" in low or "non-us" in low)
    elif "north america" in low:
        geography = "North America"
    elif "europe" in low:
        geography = "Europe"
    elif "global" in low:
        geography = "Global"
    extracted = {
        "rule_type": "investment_mandate",
        "asset_class": asset_class,
        "geography": geography,
        "non_us_investments_permitted": non_us_permitted,
        "source_clause": _section_ref(s),
    }
    found = sum(x is not None for x in (asset_class, geography))
    return extracted, _confidence(found, 2), "Defines the fund's permitted asset class and geography."


def _extract_tax_reporting(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    reports = [r for r, kw in (
        ("schedule_k1", "k-1"),
        ("ubti", "ubti"),
        ("eci", "eci"),
        ("withholding", "withholding"),
        ("fatca", "fatca"),
        ("crs", "crs"),
        ("k1_estimate", "estimate"),
    ) if kw in low]
    extracted = {
        "rule_type": "tax_reporting",
        "reports": reports,
        "frequency": "annual",
        "source_clause": _section_ref(s),
    }
    return extracted, _confidence(min(len(reports), 2), 2), "Tax reporting obligations owed to investors."


def _extract_treasury(s: Section) -> tuple[dict, Decimal, str]:
    bank = None
    # A proper-noun run of 1-4 capitalised tokens ending in Bank/Bankers/Trust,
    # e.g. "AXZ Bankers" — without spilling across lowercase connecting words.
    bm = re.search(
        r"\b([A-Z][A-Za-z0-9&.\-]*(?:\s+[A-Z][A-Za-z0-9&.\-]*){0,3})\s+(Bank|Bankers|Trust)\b",
        s.body,
    )
    if bm:
        bank = f"{bm.group(1)} {bm.group(2)}".strip()
    low = s.body.lower()
    extracted = {
        "rule_type": "treasury",
        "bank": bank,
        "wire_instructions_present": "wire" in low,
        "signatory_matrix_present": "signatory" in low or "authorized signator" in low,
        "source_clause": _section_ref(s),
    }
    found = (bank is not None) + extracted["wire_instructions_present"]
    return extracted, _confidence(found, 2), "Treasury / banking relationship and cash controls."


def _extract_esg(s: Section) -> tuple[dict, Decimal, str]:
    low = s.body.lower()
    extracted = {
        "rule_type": "esg",
        "esg_restriction": "exclud" in low or "restrict" in low or "prohibit" in low,
        "esg_reporting": "report" in low or "disclos" in low,
        "metrics_defined": "metric" in low or "kpi" in low,
        "source_clause": _section_ref(s),
    }
    return extracted, _confidence(1, 2), "ESG restriction and/or reporting obligation."


def _extract_fund_identity(s: Section) -> tuple[dict, Decimal, str]:
    name = None
    nm = re.search(
        r"name of the (?:fund|partnership) is\s+(.+?)(?:\s*\(|[,.;]| formed| is a| shall)",
        s.body,
        re.IGNORECASE,
    )
    if nm:
        name = nm.group(1).strip()
    currency = None
    cm = _ISO_CURRENCY.search(s.body)
    if cm:
        currency = cm.group(1)
    else:
        low = s.body.lower()
        for word, iso in _CURRENCY_WORDS.items():
            if word in low:
                currency = iso
                break
    extracted = {
        "rule_type": "fund_identity",
        "fund_name": name,
        "currency": currency,
        "term_years": _years(s.body),
        "source_clause": _section_ref(s),
    }
    found = sum(x is not None for x in (name, currency, extracted["term_years"]))
    return extracted, _confidence(found, 3), "Core fund identity, currency, and term."


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
    ClauseType.INVESTMENT_MANDATE: _extract_investment_mandate,
    ClauseType.TAX_REPORTING: _extract_tax_reporting,
    ClauseType.TREASURY: _extract_treasury,
    ClauseType.ESG: _extract_esg,
}


# Audit evidence each rule family must support (spec §9.2 / §13 evidence_required).
EVIDENCE_REQUIRED: dict[ClauseType, list[str]] = {
    ClauseType.MANAGEMENT_FEE: [
        "management fee calculation", "approval evidence",
        "journal entry support", "investor allocation schedule",
    ],
    ClauseType.CAPITAL_CALL: [
        "approved call calculation", "notice package",
        "wire instructions", "delivery confirmation",
    ],
    ClauseType.DISTRIBUTION_WATERFALL: [
        "waterfall calculation", "approval evidence", "distribution notice",
    ],
    ClauseType.CARRIED_INTEREST: ["carry calculation", "approval evidence"],
    ClauseType.CLAWBACK: ["clawback calculation", "escrow statement", "approval evidence"],
    ClauseType.FUND_EXPENSE: ["accrual support", "vendor invoice", "approval evidence"],
    ClauseType.REPORTING: ["report package", "approval record", "portal delivery confirmation"],
    ClauseType.TAX_REPORTING: ["k-1 package", "tax workpapers", "approval record"],
    ClauseType.TREASURY: ["bank setup packet", "signatory matrix", "wire approval"],
    ClauseType.ESG: ["esg schedule", "metric definitions", "approval record"],
}


def _summarize(clause: ClauseType, ex: dict) -> str:
    """Generate a plain-English summary of an extracted rule (spec §9.2)."""
    if clause == ClauseType.MANAGEMENT_FEE:
        base = (ex.get("fee_base") or "the stated base").replace("_", " ")
        freq = (ex.get("frequency") or "periodically").replace("_", " ")
        return f"Management fee of {ex.get('fee_rate') or 'n/a'} on {base}, charged {freq}."
    if clause == ClauseType.PREFERRED_RETURN:
        return f"Preferred return of {ex.get('rate') or 'n/a'} ({ex.get('calculation_basis') or 'basis n/a'})."
    if clause == ClauseType.CARRIED_INTEREST:
        return f"Carried interest of {ex.get('carry_percentage') or 'n/a'} to the GP, catch-up={ex.get('catch_up')}."
    if clause == ClauseType.CAPITAL_CALL:
        return f"Capital calls require {ex.get('notice_period_days') or 'n/a'} days notice."
    if clause == ClauseType.INVESTMENT_MANDATE:
        return f"Mandate: {ex.get('asset_class') or 'n/a'} in {ex.get('geography') or 'n/a'}."
    if clause == ClauseType.REPORTING:
        return f"{ex.get('report_name') or 'Report'} delivered {ex.get('frequency') or 'periodically'} to {ex.get('recipient') or 'LPs'}."
    if clause == ClauseType.CLAWBACK:
        return f"GP clawback on {ex.get('trigger') or 'trigger'}, net_of_tax={ex.get('net_of_tax')}."
    if clause == ClauseType.FUND_EXPENSE:
        return f"{(ex.get('expense_type') or 'fund expenses').replace('_', ' ')} allocated {(ex.get('allocation_basis') or '').replace('_', ' ')}."
    if clause == ClauseType.TREASURY:
        return f"Banking relationship: {ex.get('bank') or 'n/a'}."
    if clause == ClauseType.TAX_REPORTING:
        return f"Tax reporting: {', '.join(ex.get('reports') or []) or 'n/a'}."
    if clause == ClauseType.ESG:
        return "ESG obligation (restriction and/or reporting)."
    if clause == ClauseType.FUND_IDENTITY:
        return f"Fund {ex.get('fund_name') or ''} ({ex.get('currency') or 'n/a'}), term {ex.get('term_years') or 'n/a'} years."
    return f"{clause.value.replace('_', ' ').title()} clause."


def _section_ref(s: Section) -> str | None:
    return f"Section {s.number}" if s.number else None


# Side-letter override detection — maps override intent to the LPA clause it
# modifies, scoped to the document's investor.
_SIDE_LETTER_OVERRIDES: tuple[tuple[str, ClauseType, str], ...] = (
    ("esg", ClauseType.ESG, "esg_election"),
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
            verbatim = _verbatim(s.body, phrase)
            extracted["exact_extracted_text"] = verbatim
            ambiguity = _detect_ambiguity(s.body)
            if ambiguity:
                conf = min(conf, AMBIGUOUS_CONFIDENCE_CEILING)
                extracted["ambiguity_phrase"] = ambiguity
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
                exact_extracted_text=verbatim,
                requires_human_review=True,
                ambiguous=ambiguity is not None,
            )
    return None


# Keywords used to locate the most evidentiary sentence per clause type (FR-3).
_VERBATIM_HINTS: dict[ClauseType, tuple[str, ...]] = {
    ClauseType.MANAGEMENT_FEE: ("management fee", "%"),
    ClauseType.PREFERRED_RETURN: ("preferred return", "hurdle", "%"),
    ClauseType.CARRIED_INTEREST: ("carried interest", "carry", "%"),
    ClauseType.CAPITAL_CALL: ("capital call", "notice", "drawdown"),
    ClauseType.DISTRIBUTION_WATERFALL: ("distribut", "waterfall"),
    ClauseType.CLAWBACK: ("clawback", "restore", "excess"),
    ClauseType.INVESTMENT_PERIOD: ("investment period", "year"),
    ClauseType.FUND_IDENTITY: ("name of the", "term of the"),
    ClauseType.FUND_EXPENSE: ("expense", "cap"),
    ClauseType.REPORTING: ("report", "financial statement", "days"),
}


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

    # FR-3: attach the literal evidentiary sentence to the rule.
    verbatim = _verbatim(section.body, *_VERBATIM_HINTS.get(clause, ()))
    extracted["exact_extracted_text"] = verbatim
    # spec §9.2: portable rule carries a plain-English summary + evidence list.
    extracted["plain_english_summary"] = _summarize(clause, extracted)
    if clause in EVIDENCE_REQUIRED:
        extracted["evidence_required"] = EVIDENCE_REQUIRED[clause]

    # FR-4: discretionary phrases force the rule into the review band.
    ambiguity = _detect_ambiguity(section.body)
    ambiguous = ambiguity is not None
    if ambiguous:
        confidence = min(confidence, AMBIGUOUS_CONFIDENCE_CEILING)
        extracted["ambiguity_phrase"] = ambiguity

    requires_review = (
        confidence < REVIEW_THRESHOLD or ambiguous or clause in MONEY_MOVEMENT_CLAUSES
    )
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
        exact_extracted_text=verbatim,
        requires_human_review=requires_review,
        ambiguous=ambiguous,
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
