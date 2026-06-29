from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

from pydantic import field_validator

from app.models.lpa import (
    ClauseType,
    DocumentStatus,
    DocumentType,
    IssueSeverity,
    IssueType,
    RuleStatus,
)
from app.schemas.common import ORMBase


class DocumentCreate(ORMBase):
    name: str
    document_type: DocumentType = DocumentType.LPA
    raw_text: str
    entity_id: int | None = None
    investor_id: int | None = None


class DocumentOut(ORMBase):
    id: int
    entity_id: int | None
    investor_id: int | None
    name: str
    document_type: DocumentType
    status: DocumentStatus
    page_count: int
    content_hash: str


class ExtractedRuleOut(ORMBase):
    id: int
    document_id: int
    entity_id: int | None
    investor_id: int | None
    rule_type: ClauseType
    clause_type: ClauseType
    source_section: str | None
    source_page_start: int | None
    source_page_end: int | None
    source_text_excerpt: str
    exact_extracted_text: str | None = None
    extracted: dict[str, Any]
    explanation: str | None
    confidence_score: Decimal
    status_light: str | None = None
    requires_human_review: bool
    ambiguous: bool
    status: RuleStatus

    @field_validator("extracted", mode="before")
    @classmethod
    def _parse_json(cls, v: Any) -> Any:
        # ExtractedRule stores JSON text in `extracted_json`; this schema reads
        # it via the `extracted` alias populated in the API layer.
        if isinstance(v, str):
            return json.loads(v or "{}")
        return v


class RuleEdit(ORMBase):
    extracted: dict[str, Any]


class RuleRejection(ORMBase):
    reason: str | None = None


class RuleIssueOut(ORMBase):
    id: int
    document_id: int | None
    entity_id: int | None
    rule_id: int | None
    issue_type: IssueType
    severity: IssueSeverity
    rule_type: ClauseType | None
    message: str
    resolved: bool


class RuleConflictOut(ORMBase):
    id: int
    entity_id: int | None
    conflict_type: str
    severity: IssueSeverity
    base_rule_id: int | None
    conflicting_rule_id: int | None
    base_rule_summary: str
    conflicting_rule_summary: str
    resolution: str | None
    requires_approval: bool
    resolved: bool


class ConflictResolution(ORMBase):
    resolution: str | None = None


class ExtractionSummary(ORMBase):
    document_id: int
    status: DocumentStatus
    rules: list[ExtractedRuleOut]
    issues: list[RuleIssueOut]
    conflicts: list[RuleConflictOut]


# ---- validation request payloads ---- #

class FeeValidationRequest(ORMBase):
    entity_id: int
    investor: str
    fee_base: Decimal
    actual_fee: Decimal
    annual_rate: Decimal | None = None
    periods_per_year: int = 4
    period: str | None = None


class CapitalCallInvestor(ORMBase):
    name: str
    commitment: Decimal | None = None
    unfunded: Decimal
    actual_call: Decimal


class CapitalCallValidationRequest(ORMBase):
    entity_id: int
    investors: list[CapitalCallInvestor]
    total_call_amount: Decimal | None = None


class WaterfallInvestor(ORMBase):
    name: str
    contribution: Decimal
    prior_distribution: Decimal = Decimal("0")
    actual_distribution: Decimal


class WaterfallValidationRequest(ORMBase):
    entity_id: int
    investors: list[WaterfallInvestor]
    distribution_amount: Decimal
    preferred_rate: Decimal | None = None
    carry_pct: Decimal | None = None
    years: Decimal = Decimal("1")
