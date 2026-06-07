"""LPA document intelligence & fund operating rule extraction (Epic 13).

An LPA (and its side letters / amendments) is the *source of truth* for fund
operating rules. This module models the conversion of those legal documents
into a structured, source-traceable, human-approved operating rule set that
downstream validators (fees, waterfall, capital calls) execute against.

Design tenets mirror the rest of the platform:
- every rule links back to exact source text (document, section, page);
- nothing is executable until a human has *approved* it;
- a workflow-style lifecycle governs each rule;
- conflicts and missing rules are first-class records, not silent gaps.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class DocumentType(StrEnum):
    LPA = "lpa"
    PPM = "ppm"
    SIDE_LETTER = "side_letter"
    AMENDMENT = "amendment"
    SUBSCRIPTION = "subscription"
    INVESTOR_REGISTER = "investor_register"
    BANK_MEMO = "bank_memo"
    REPORTING_TEMPLATE = "reporting_template"
    FEE_LETTER = "fee_letter"
    MANAGEMENT_AGREEMENT = "management_agreement"
    TAX_MEMO = "tax_memo"
    OTHER = "other"


# Document authority hierarchy (spec §6). Lower number = higher operating
# authority; used to resolve which document governs when sources disagree.
DOCUMENT_AUTHORITY: dict[DocumentType, int] = {
    DocumentType.LPA: 1,
    DocumentType.MANAGEMENT_AGREEMENT: 1,
    DocumentType.AMENDMENT: 1,
    DocumentType.SIDE_LETTER: 2,
    DocumentType.SUBSCRIPTION: 3,
    DocumentType.INVESTOR_REGISTER: 3,
    DocumentType.PPM: 4,
    DocumentType.FEE_LETTER: 4,
    DocumentType.BANK_MEMO: 5,
    DocumentType.TAX_MEMO: 5,
    DocumentType.REPORTING_TEMPLATE: 5,
    DocumentType.OTHER: 9,
}


class DocumentStatus(StrEnum):
    UPLOADED = "uploaded"
    TEXT_EXTRACTED = "text_extracted"
    PARSED = "parsed"
    REVIEWED = "reviewed"


class ClauseType(StrEnum):
    """Approved clause classification taxonomy. Doubles as the rule_type for
    extracted operating rules."""

    FUND_IDENTITY = "fund_identity"
    DEFINITIONS = "definitions"
    PARTIES = "parties"
    CAPITAL_COMMITMENT = "capital_commitment"
    CAPITAL_CALL = "capital_call"
    DEFAULT = "default"
    MANAGEMENT_FEE = "management_fee"
    FUND_EXPENSE = "fund_expense"
    INVESTMENT_PERIOD = "investment_period"
    INVESTMENT_RESTRICTION = "investment_restriction"
    DISTRIBUTION_WATERFALL = "distribution_waterfall"
    PREFERRED_RETURN = "preferred_return"
    CARRIED_INTEREST = "carried_interest"
    CATCH_UP = "catch_up"
    CLAWBACK = "clawback"
    TAX_DISTRIBUTION = "tax_distribution"
    PROFIT_LOSS_ALLOCATION = "profit_loss_allocation"
    INVESTMENT_MANDATE = "investment_mandate"
    TRANSFER = "transfer"
    WITHDRAWAL = "withdrawal"
    REPORTING = "reporting"
    REPORTING_OBLIGATION = "reporting_obligation"
    TAX_REPORTING = "tax_reporting"
    TREASURY = "treasury"
    ESG = "esg"
    VALUATION = "valuation"
    ADVISORY_COMMITTEE = "advisory_committee"
    CONSENT = "consent"
    KEY_PERSON = "key_person"
    GP_REMOVAL = "gp_removal"
    FUND_TERMINATION = "fund_termination"
    SIDE_LETTER = "side_letter"
    MFN = "mfn"
    CONFIDENTIALITY = "confidentiality"
    REGULATORY = "regulatory"
    UNKNOWN = "unknown"


class RuleStatus(StrEnum):
    DRAFT_AI_EXTRACTED = "draft_ai_extracted"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_LEGAL_REVIEW = "needs_legal_review"
    SUPERSEDED = "superseded"


class IssueSeverity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IssueType(StrEnum):
    MISSING_OPERATING_RULE = "missing_operating_rule"
    AMBIGUOUS_RULE = "ambiguous_rule"
    LOW_CONFIDENCE = "low_confidence"


class SourceDocument(Base, TimestampMixin):
    """An uploaded governing document converted to text, with page/section
    structure preserved for traceability."""

    __tablename__ = "lpa_source_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id"), nullable=True)
    # side letters / subscriptions are scoped to a single investor
    investor_id: Mapped[int | None] = mapped_column(ForeignKey("investors.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    document_type: Mapped[DocumentType] = mapped_column(Enum(DocumentType), nullable=False)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus), default=DocumentStatus.UPLOADED, nullable=False
    )
    raw_text: Mapped[str] = mapped_column(String, nullable=False, default="")
    page_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    uploaded_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    rules: Mapped[list["ExtractedRule"]] = relationship(
        "ExtractedRule", back_populates="document", cascade="all, delete-orphan"
    )


class ExtractedRule(Base, TimestampMixin):
    """A structured fund administration rule extracted from a source document.

    No rule is executable unless ``status == APPROVED`` *and* it carries full
    source traceability (document, section, page, text excerpt)."""

    __tablename__ = "lpa_extracted_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("lpa_source_documents.id"), nullable=False
    )
    entity_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id"), nullable=True)
    investor_id: Mapped[int | None] = mapped_column(ForeignKey("investors.id"), nullable=True)

    rule_type: Mapped[ClauseType] = mapped_column(Enum(ClauseType), nullable=False)
    clause_type: Mapped[ClauseType] = mapped_column(Enum(ClauseType), nullable=False)

    # source traceability — required for executability
    source_section: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_page_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_page_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_text_excerpt: Mapped[str] = mapped_column(String, nullable=False, default="")

    extracted_json: Mapped[str] = mapped_column(String, nullable=False, default="{}")
    explanation: Mapped[str | None] = mapped_column(String, nullable=True)

    confidence_score: Mapped[Decimal] = mapped_column(
        Numeric(4, 3), default=Decimal("0.000"), nullable=False
    )
    requires_human_review: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ambiguous: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    status: Mapped[RuleStatus] = mapped_column(
        Enum(RuleStatus), default=RuleStatus.DRAFT_AI_EXTRACTED, nullable=False
    )
    reviewed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    supersedes_rule_id: Mapped[int | None] = mapped_column(
        ForeignKey("lpa_extracted_rules.id"), nullable=True
    )

    document: Mapped[SourceDocument] = relationship("SourceDocument", back_populates="rules")

    def has_traceability(self) -> bool:
        return bool(self.source_text_excerpt) and self.source_section is not None

    def is_executable(self) -> bool:
        return self.status == RuleStatus.APPROVED and self.has_traceability()


class RuleIssue(Base, TimestampMixin):
    """A detected gap or quality flag — e.g. a required operating rule that the
    LPA does not appear to contain, or an extraction below the review threshold."""

    __tablename__ = "lpa_rule_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int | None] = mapped_column(
        ForeignKey("lpa_source_documents.id"), nullable=True
    )
    entity_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id"), nullable=True)
    rule_id: Mapped[int | None] = mapped_column(ForeignKey("lpa_extracted_rules.id"), nullable=True)
    issue_type: Mapped[IssueType] = mapped_column(Enum(IssueType), nullable=False)
    severity: Mapped[IssueSeverity] = mapped_column(Enum(IssueSeverity), nullable=False)
    rule_type: Mapped[ClauseType | None] = mapped_column(Enum(ClauseType), nullable=True)
    message: Mapped[str] = mapped_column(String, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class RuleConflict(Base, TimestampMixin):
    """A detected conflict between two rules — e.g. an LPA fee clause overridden
    by an investor side letter, or two side letters that disagree."""

    __tablename__ = "lpa_rule_conflicts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id"), nullable=True)
    conflict_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[IssueSeverity] = mapped_column(Enum(IssueSeverity), nullable=False)
    base_rule_id: Mapped[int | None] = mapped_column(
        ForeignKey("lpa_extracted_rules.id"), nullable=True
    )
    conflicting_rule_id: Mapped[int | None] = mapped_column(
        ForeignKey("lpa_extracted_rules.id"), nullable=True
    )
    base_rule_summary: Mapped[str] = mapped_column(String, nullable=False)
    conflicting_rule_summary: Mapped[str] = mapped_column(String, nullable=False)
    resolution: Mapped[str | None] = mapped_column(String, nullable=True)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
