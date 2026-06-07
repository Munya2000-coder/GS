"""LPA extraction orchestration.

Runs the deterministic parser over a stored document, persists the resulting
rules with full source traceability and confidence, then runs missing-rule and
conflict detection. Every step is audit-logged and lineage-linked, mirroring
the rest of the platform.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.models.lpa import (
    ClauseType,
    DocumentStatus,
    DocumentType,
    ExtractedRule,
    IssueSeverity,
    IssueType,
    RuleConflict,
    RuleIssue,
    RuleStatus,
    SourceDocument,
)
from app.services import audit, lineage
from app.services.lpa_parser import REQUIRED_PE_RULES, page_count, parse_document


def create_document(
    session: Session,
    *,
    user: AuthUser,
    name: str,
    document_type: DocumentType,
    raw_text: str,
    entity_id: int | None = None,
    investor_id: int | None = None,
) -> SourceDocument:
    content_hash = hashlib.sha256(raw_text.encode()).hexdigest()
    doc = SourceDocument(
        entity_id=entity_id,
        investor_id=investor_id,
        name=name,
        document_type=document_type,
        status=DocumentStatus.TEXT_EXTRACTED,
        raw_text=raw_text,
        page_count=page_count(raw_text),
        content_hash=content_hash,
        uploaded_by_user_id=user.id,
    )
    session.add(doc)
    session.flush()
    audit.log_event(
        session, actor_user_id=user.id, action="lpa_document.create",
        object_type="lpa_source_document", object_id=doc.id,
        after={"name": name, "type": document_type, "pages": doc.page_count, "hash": content_hash},
    )
    return doc


def extract_document(session: Session, *, user: AuthUser, document_id: int) -> SourceDocument:
    """Parse a stored document into structured rules and run quality checks.

    Re-running supersedes any previously *unapproved* rules from the same
    document; approved rules are left untouched so human decisions persist."""
    doc = session.get(SourceDocument, document_id)
    if doc is None:
        raise ValueError(f"document {document_id} not found")

    # Retire prior non-approved drafts from this document (idempotent re-parse).
    existing = (
        session.query(ExtractedRule)
        .filter(ExtractedRule.document_id == doc.id)
        .all()
    )
    for rule in existing:
        if rule.status in (RuleStatus.DRAFT_AI_EXTRACTED, RuleStatus.PENDING_REVIEW):
            rule.status = RuleStatus.SUPERSEDED

    candidates = parse_document(doc.raw_text, DocumentType(doc.document_type))
    created: list[ExtractedRule] = []
    for cand in candidates:
        rule = ExtractedRule(
            document_id=doc.id,
            entity_id=doc.entity_id,
            investor_id=doc.investor_id,
            rule_type=cand.rule_type,
            clause_type=cand.clause_type,
            source_section=cand.source_section,
            source_page_start=cand.source_page_start,
            source_page_end=cand.source_page_end,
            source_text_excerpt=cand.source_text_excerpt,
            extracted_json=json.dumps(cand.extracted, default=str),
            explanation=cand.explanation,
            confidence_score=cand.confidence,
            requires_human_review=cand.requires_human_review,
            ambiguous=cand.ambiguous,
            status=RuleStatus.PENDING_REVIEW,
        )
        session.add(rule)
        session.flush()
        lineage.record_edge(
            session, upstream_type="lpa_source_document", upstream_id=doc.id,
            downstream_type="lpa_extracted_rule", downstream_id=rule.id, relation="extracted",
        )
        created.append(rule)

    doc.status = DocumentStatus.PARSED
    audit.log_event(
        session, actor_user_id=user.id, action="lpa_document.extract",
        object_type="lpa_source_document", object_id=doc.id,
        after={"rules_extracted": len(created)},
    )

    _flag_low_confidence(session, doc, created)
    detect_missing_rules(session, doc)
    detect_conflicts(session, doc)
    return doc


def _flag_low_confidence(
    session: Session, doc: SourceDocument, rules: list[ExtractedRule]
) -> None:
    for rule in rules:
        if rule.confidence_score < Decimal("0.70"):
            session.add(
                RuleIssue(
                    document_id=doc.id,
                    entity_id=doc.entity_id,
                    rule_id=rule.id,
                    issue_type=IssueType.LOW_CONFIDENCE,
                    severity=IssueSeverity.MEDIUM,
                    rule_type=rule.rule_type,
                    message=(
                        f"{rule.rule_type.value} extracted at confidence "
                        f"{rule.confidence_score}; human review required."
                    ),
                )
            )
    session.flush()


def detect_missing_rules(session: Session, doc: SourceDocument) -> list[RuleIssue]:
    """For an LPA, ensure each expected operating rule was found across the
    fund's parsed documents. Only applies to primary LPAs."""
    if doc.document_type != DocumentType.LPA:
        return []

    present = {
        r.rule_type
        for r in session.query(ExtractedRule)
        .filter(
            ExtractedRule.document_id == doc.id,
            ExtractedRule.status != RuleStatus.SUPERSEDED,
        )
        .all()
    }
    issues: list[RuleIssue] = []
    for required in REQUIRED_PE_RULES:
        if required in present:
            continue
        # avoid duplicate open issues on re-parse
        dup = (
            session.query(RuleIssue)
            .filter(
                RuleIssue.document_id == doc.id,
                RuleIssue.issue_type == IssueType.MISSING_OPERATING_RULE,
                RuleIssue.rule_type == required,
                RuleIssue.resolved.is_(False),
            )
            .first()
        )
        if dup:
            continue
        issue = RuleIssue(
            document_id=doc.id,
            entity_id=doc.entity_id,
            issue_type=IssueType.MISSING_OPERATING_RULE,
            severity=IssueSeverity.HIGH,
            rule_type=required,
            message=f"No {required.value} provision found. Human review required.",
        )
        session.add(issue)
        issues.append(issue)
    session.flush()
    return issues


def detect_conflicts(session: Session, doc: SourceDocument) -> list[RuleConflict]:
    """Detect side-letter overrides of LPA clauses and duplicate base rules for
    the same fund/clause."""
    if doc.entity_id is None:
        return []

    conflicts: list[RuleConflict] = []
    active = (
        session.query(ExtractedRule)
        .filter(
            ExtractedRule.entity_id == doc.entity_id,
            ExtractedRule.status.in_(
                [RuleStatus.PENDING_REVIEW, RuleStatus.APPROVED, RuleStatus.DRAFT_AI_EXTRACTED]
            ),
        )
        .all()
    )

    base_rules = [r for r in active if r.rule_type != ClauseType.SIDE_LETTER]
    side_letters = [r for r in active if r.rule_type == ClauseType.SIDE_LETTER]

    base_by_clause: dict[ClauseType, list[ExtractedRule]] = {}
    for r in base_rules:
        base_by_clause.setdefault(r.clause_type, []).append(r)

    for sl in side_letters:
        payload = json.loads(sl.extracted_json or "{}")
        overridden = payload.get("overridden_clause_type")
        try:
            clause = ClauseType(overridden) if overridden else sl.clause_type
        except ValueError:
            clause = sl.clause_type
        for base in base_by_clause.get(clause, []):
            if _conflict_exists(session, base.id, sl.id):
                continue
            conflict = RuleConflict(
                entity_id=doc.entity_id,
                conflict_type="side_letter_override",
                severity=IssueSeverity.MEDIUM,
                base_rule_id=base.id,
                conflicting_rule_id=sl.id,
                base_rule_summary=_summary(base),
                conflicting_rule_summary=_summary(sl),
                resolution=f"Apply override only to investor {sl.investor_id}.",
                requires_approval=True,
            )
            session.add(conflict)
            conflicts.append(conflict)

    session.flush()
    return conflicts


def _conflict_exists(session: Session, base_id: int, conflicting_id: int) -> bool:
    return (
        session.query(RuleConflict)
        .filter(
            RuleConflict.base_rule_id == base_id,
            RuleConflict.conflicting_rule_id == conflicting_id,
        )
        .first()
        is not None
    )


def _summary(rule: ExtractedRule) -> str:
    payload = json.loads(rule.extracted_json or "{}")
    bits = [f"{k}={v}" for k, v in payload.items() if k != "source_clause" and v not in (None, [], {})]
    head = ", ".join(bits[:4]) if bits else rule.rule_type.value
    return f"[{rule.source_section or 'n/a'}] {head}"


# --------------------------------------------------------------------------- #
# Rule lifecycle                                                               #
# --------------------------------------------------------------------------- #

_APPROVABLE_FROM = {
    RuleStatus.DRAFT_AI_EXTRACTED,
    RuleStatus.PENDING_REVIEW,
    RuleStatus.NEEDS_LEGAL_REVIEW,
}


def approve_rule(session: Session, *, user: AuthUser, rule_id: int) -> ExtractedRule:
    rule = _get_rule(session, rule_id)
    if rule.status not in _APPROVABLE_FROM:
        raise ValueError(f"rule in state {rule.status} cannot be approved")
    if not rule.has_traceability():
        raise ValueError("rule lacks source traceability and cannot be approved")
    rule.status = RuleStatus.APPROVED
    rule.approved_by_user_id = user.id
    rule.reviewed_by_user_id = user.id
    rule.reviewed_at = datetime.utcnow()
    audit.log_event(
        session, actor_user_id=user.id, action="lpa_rule.approve",
        object_type="lpa_extracted_rule", object_id=rule.id, after={"status": rule.status},
    )
    return rule


def reject_rule(session: Session, *, user: AuthUser, rule_id: int, reason: str | None = None) -> ExtractedRule:
    rule = _get_rule(session, rule_id)
    rule.status = RuleStatus.REJECTED
    rule.reviewed_by_user_id = user.id
    rule.reviewed_at = datetime.utcnow()
    audit.log_event(
        session, actor_user_id=user.id, action="lpa_rule.reject",
        object_type="lpa_extracted_rule", object_id=rule.id,
        after={"status": rule.status, "reason": reason},
    )
    return rule


def mark_ambiguous(session: Session, *, user: AuthUser, rule_id: int) -> ExtractedRule:
    rule = _get_rule(session, rule_id)
    rule.ambiguous = True
    session.add(
        RuleIssue(
            document_id=rule.document_id,
            entity_id=rule.entity_id,
            rule_id=rule.id,
            issue_type=IssueType.AMBIGUOUS_RULE,
            severity=IssueSeverity.MEDIUM,
            rule_type=rule.rule_type,
            message=f"{rule.rule_type.value} marked ambiguous by {user.username}.",
        )
    )
    audit.log_event(
        session, actor_user_id=user.id, action="lpa_rule.mark_ambiguous",
        object_type="lpa_extracted_rule", object_id=rule.id, after={"ambiguous": True},
    )
    return rule


def request_legal_review(session: Session, *, user: AuthUser, rule_id: int) -> ExtractedRule:
    rule = _get_rule(session, rule_id)
    rule.status = RuleStatus.NEEDS_LEGAL_REVIEW
    audit.log_event(
        session, actor_user_id=user.id, action="lpa_rule.request_legal_review",
        object_type="lpa_extracted_rule", object_id=rule.id, after={"status": rule.status},
    )
    return rule


def edit_rule(session: Session, *, user: AuthUser, rule_id: int, extracted: dict) -> ExtractedRule:
    rule = _get_rule(session, rule_id)
    if rule.status == RuleStatus.APPROVED:
        raise ValueError("approved rules are immutable; supersede instead")
    before = rule.extracted_json
    rule.extracted_json = json.dumps(extracted, default=str)
    rule.status = RuleStatus.PENDING_REVIEW
    audit.log_event(
        session, actor_user_id=user.id, action="lpa_rule.edit",
        object_type="lpa_extracted_rule", object_id=rule.id,
        before={"extracted_json": before}, after={"extracted_json": rule.extracted_json},
    )
    return rule


def resolve_issue(session: Session, *, user: AuthUser, issue_id: int) -> RuleIssue:
    issue = session.get(RuleIssue, issue_id)
    if issue is None:
        raise ValueError(f"issue {issue_id} not found")
    issue.resolved = True
    issue.resolved_by_user_id = user.id
    audit.log_event(
        session, actor_user_id=user.id, action="lpa_issue.resolve",
        object_type="lpa_rule_issue", object_id=issue.id, after={"resolved": True},
    )
    return issue


def resolve_conflict(session: Session, *, user: AuthUser, conflict_id: int, resolution: str | None = None) -> RuleConflict:
    conflict = session.get(RuleConflict, conflict_id)
    if conflict is None:
        raise ValueError(f"conflict {conflict_id} not found")
    conflict.resolved = True
    conflict.resolved_by_user_id = user.id
    if resolution:
        conflict.resolution = resolution
    audit.log_event(
        session, actor_user_id=user.id, action="lpa_conflict.resolve",
        object_type="lpa_rule_conflict", object_id=conflict.id, after={"resolved": True},
    )
    return conflict


def _get_rule(session: Session, rule_id: int) -> ExtractedRule:
    rule = session.get(ExtractedRule, rule_id)
    if rule is None:
        raise ValueError(f"rule {rule_id} not found")
    return rule
