"""LPA document intelligence & fund operating rule extraction API (Epic 13).

Surface: upload governing documents, run the deterministic extraction pipeline,
review/approve/reject extracted rules, triage missing-rule issues and conflicts,
and run independent validations of fees / capital calls / waterfalls against the
*approved* rule set.
"""

from __future__ import annotations

import json
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.lpa import (
    ClauseType,
    ExtractedRule,
    RuleConflict,
    RuleIssue,
    RuleStatus,
    SourceDocument,
)
from app.schemas.lpa import (
    CapitalCallValidationRequest,
    ConflictResolution,
    DocumentCreate,
    DocumentOut,
    ExtractedRuleOut,
    ExtractionSummary,
    FeeValidationRequest,
    RuleConflictOut,
    RuleEdit,
    RuleIssueOut,
    RuleRejection,
    WaterfallValidationRequest,
)
from app.services import lpa_blueprint, lpa_extraction, lpa_operating_pack, lpa_validation
from app.services.exports import to_csv
from app.services.lpa_parser import traffic_light

router = APIRouter(prefix="/lpa", tags=["lpa"])


def _rule_out(rule: ExtractedRule) -> ExtractedRuleOut:
    payload = json.loads(rule.extracted_json or "{}")
    return ExtractedRuleOut(
        id=rule.id,
        document_id=rule.document_id,
        entity_id=rule.entity_id,
        investor_id=rule.investor_id,
        rule_type=rule.rule_type,
        clause_type=rule.clause_type,
        source_section=rule.source_section,
        source_page_start=rule.source_page_start,
        source_page_end=rule.source_page_end,
        source_text_excerpt=rule.source_text_excerpt,
        exact_extracted_text=payload.get("exact_extracted_text"),
        extracted=payload,
        explanation=rule.explanation,
        confidence_score=rule.confidence_score,
        status_light=traffic_light(Decimal(str(rule.confidence_score)), rule.ambiguous),
        requires_human_review=rule.requires_human_review,
        ambiguous=rule.ambiguous,
        status=rule.status,
    )


# --------------------------------------------------------------------------- #
# Documents                                                                    #
# --------------------------------------------------------------------------- #

@router.post("/documents", response_model=DocumentOut, status_code=201)
def create_document(
    payload: DocumentCreate,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    doc = lpa_extraction.create_document(
        session, user=user, name=payload.name, document_type=payload.document_type,
        raw_text=payload.raw_text, entity_id=payload.entity_id, investor_id=payload.investor_id,
    )
    session.commit()
    session.refresh(doc)
    return doc


@router.get("/documents", response_model=list[DocumentOut])
def list_documents(
    entity_id: int | None = None,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    q = session.query(SourceDocument)
    if entity_id is not None:
        q = q.filter(SourceDocument.entity_id == entity_id)
    return q.order_by(SourceDocument.id.desc()).all()


@router.get("/documents/{document_id}/blueprint")
def get_blueprint(
    document_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    """The FR-2 Fund Logic Blueprint: consolidated waterfall / fee / metadata
    fields, each with a ground-truth citation (FR-3) and traffic-light status
    (FR-4), plus flagged side-letter overrides."""
    try:
        return lpa_blueprint.build_blueprint(session, document_id=document_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(ex))


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    doc = session.get(SourceDocument, document_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document not found")
    return doc


@router.post("/documents/{document_id}/extract", response_model=ExtractionSummary, status_code=201)
def extract_document(
    document_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    try:
        doc = lpa_extraction.extract_document(session, user=user, document_id=document_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(ex))
    session.commit()
    session.refresh(doc)

    rules = (
        session.query(ExtractedRule)
        .filter(
            ExtractedRule.document_id == doc.id,
            ExtractedRule.status != RuleStatus.SUPERSEDED,
        )
        .order_by(ExtractedRule.id)
        .all()
    )
    issues = session.query(RuleIssue).filter(RuleIssue.document_id == doc.id).all()
    conflicts = (
        session.query(RuleConflict).filter(RuleConflict.entity_id == doc.entity_id).all()
        if doc.entity_id is not None
        else []
    )
    return ExtractionSummary(
        document_id=doc.id,
        status=doc.status,
        rules=[_rule_out(r) for r in rules],
        issues=[RuleIssueOut.model_validate(i) for i in issues],
        conflicts=[RuleConflictOut.model_validate(c) for c in conflicts],
    )


# --------------------------------------------------------------------------- #
# Rules                                                                        #
# --------------------------------------------------------------------------- #

@router.get("/rules", response_model=list[ExtractedRuleOut])
def list_rules(
    document_id: int | None = None,
    entity_id: int | None = None,
    rule_status: RuleStatus | None = None,
    rule_type: ClauseType | None = None,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    q = session.query(ExtractedRule)
    if document_id is not None:
        q = q.filter(ExtractedRule.document_id == document_id)
    if entity_id is not None:
        q = q.filter(ExtractedRule.entity_id == entity_id)
    if rule_status is not None:
        q = q.filter(ExtractedRule.status == rule_status)
    if rule_type is not None:
        q = q.filter(ExtractedRule.rule_type == rule_type)
    return [_rule_out(r) for r in q.order_by(ExtractedRule.id).all()]


@router.get("/rules/{rule_id}", response_model=ExtractedRuleOut)
def get_rule(
    rule_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    rule = session.get(ExtractedRule, rule_id)
    if not rule:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "rule not found")
    return _rule_out(rule)


@router.patch("/rules/{rule_id}", response_model=ExtractedRuleOut)
def edit_rule(
    rule_id: int,
    payload: RuleEdit,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.EDIT)),
):
    try:
        rule = lpa_extraction.edit_rule(session, user=user, rule_id=rule_id, extracted=payload.extracted)
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(rule)
    return _rule_out(rule)


@router.post("/rules/{rule_id}/approve", response_model=ExtractedRuleOut)
def approve_rule(
    rule_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.APPROVE)),
):
    try:
        rule = lpa_extraction.approve_rule(session, user=user, rule_id=rule_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(rule)
    return _rule_out(rule)


@router.post("/rules/{rule_id}/reject", response_model=ExtractedRuleOut)
def reject_rule(
    rule_id: int,
    payload: RuleRejection | None = None,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.APPROVE)),
):
    try:
        rule = lpa_extraction.reject_rule(
            session, user=user, rule_id=rule_id, reason=payload.reason if payload else None
        )
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(rule)
    return _rule_out(rule)


@router.post("/rules/{rule_id}/mark-ambiguous", response_model=ExtractedRuleOut)
def mark_ambiguous(
    rule_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.EDIT)),
):
    try:
        rule = lpa_extraction.mark_ambiguous(session, user=user, rule_id=rule_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(rule)
    return _rule_out(rule)


@router.post("/rules/{rule_id}/request-legal-review", response_model=ExtractedRuleOut)
def request_legal_review(
    rule_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.EDIT)),
):
    try:
        rule = lpa_extraction.request_legal_review(session, user=user, rule_id=rule_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(rule)
    return _rule_out(rule)


# --------------------------------------------------------------------------- #
# Issues & conflicts                                                          #
# --------------------------------------------------------------------------- #

@router.get("/issues", response_model=list[RuleIssueOut])
def list_issues(
    document_id: int | None = None,
    entity_id: int | None = None,
    resolved: bool | None = None,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    q = session.query(RuleIssue)
    if document_id is not None:
        q = q.filter(RuleIssue.document_id == document_id)
    if entity_id is not None:
        q = q.filter(RuleIssue.entity_id == entity_id)
    if resolved is not None:
        q = q.filter(RuleIssue.resolved.is_(resolved))
    return q.order_by(RuleIssue.id).all()


@router.post("/issues/{issue_id}/resolve", response_model=RuleIssueOut)
def resolve_issue(
    issue_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.EDIT)),
):
    try:
        issue = lpa_extraction.resolve_issue(session, user=user, issue_id=issue_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(ex))
    session.commit()
    session.refresh(issue)
    return issue


@router.get("/conflicts", response_model=list[RuleConflictOut])
def list_conflicts(
    entity_id: int | None = None,
    resolved: bool | None = None,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    q = session.query(RuleConflict)
    if entity_id is not None:
        q = q.filter(RuleConflict.entity_id == entity_id)
    if resolved is not None:
        q = q.filter(RuleConflict.resolved.is_(resolved))
    return q.order_by(RuleConflict.id).all()


@router.post("/conflicts/{conflict_id}/resolve", response_model=RuleConflictOut)
def resolve_conflict(
    conflict_id: int,
    payload: ConflictResolution | None = None,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.APPROVE)),
):
    try:
        conflict = lpa_extraction.resolve_conflict(
            session, user=user, conflict_id=conflict_id,
            resolution=payload.resolution if payload else None,
        )
    except ValueError as ex:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(ex))
    session.commit()
    session.refresh(conflict)
    return conflict


# --------------------------------------------------------------------------- #
# Fund Operating Logic Pack                                                    #
# --------------------------------------------------------------------------- #

@router.get("/funds/{entity_id}/operating-pack")
def get_operating_pack(
    entity_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    """The complete Fund Operating Logic Pack: terms summary, portable rules,
    investor & reporting obligation matrices, obligation calendar, and the
    exception report."""
    try:
        return lpa_operating_pack.build_operating_pack(session, entity_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(ex))


@router.get("/funds/{entity_id}/fund-terms")
def get_fund_terms(
    entity_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    return lpa_operating_pack.fund_terms_summary(session, entity_id)


@router.get("/funds/{entity_id}/reporting-matrix")
def get_reporting_matrix(
    entity_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    return lpa_operating_pack.reporting_obligation_matrix(session, entity_id)


@router.get("/funds/{entity_id}/investor-matrix")
def get_investor_matrix(
    entity_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    return lpa_operating_pack.investor_obligation_matrix(session, entity_id)


@router.get("/funds/{entity_id}/calendar")
def get_obligation_calendar(
    entity_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    return lpa_operating_pack.obligation_calendar(session, entity_id)


@router.get("/funds/{entity_id}/exceptions")
def get_exceptions(
    entity_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    return lpa_operating_pack.exception_report(session, entity_id)


@router.post("/funds/{entity_id}/consistency-check")
def run_consistency_check(
    entity_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    """Re-run PPM-vs-LPA (and cross-document) consistency checks and return any
    newly-detected mismatches."""
    conflicts = lpa_extraction.detect_consistency(session, entity_id)
    session.commit()
    return [
        {
            "id": c.id, "conflict_type": c.conflict_type, "severity": c.severity.value,
            "base": c.base_rule_summary, "conflicting": c.conflicting_rule_summary,
            "resolution": c.resolution,
        }
        for c in conflicts
    ]


@router.get("/funds/{entity_id}/operating-pack.json")
def export_operating_pack_json(
    entity_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.EXPORT)),
):
    try:
        pack = lpa_operating_pack.build_operating_pack(session, entity_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(ex))
    body = json.dumps(pack, indent=2, default=str)
    return Response(
        content=body, media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="operating_pack_{pack["fund_id"]}.json"'},
    )


def _csv(body: str, filename: str) -> Response:
    return Response(
        content=body, media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/funds/{entity_id}/reporting-matrix.csv")
def export_reporting_matrix_csv(
    entity_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.EXPORT)),
):
    rows = lpa_operating_pack.reporting_obligation_matrix(session, entity_id)
    headers = ["report", "frequency", "due_date", "recipient", "source", "owner", "investor_specific"]
    body = to_csv(headers, [[r.get(h) for h in headers] for r in rows])
    return _csv(body, f"reporting_matrix_{entity_id}.csv")


@router.get("/funds/{entity_id}/investor-matrix.csv")
def export_investor_matrix_csv(
    entity_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.EXPORT)),
):
    rows = lpa_operating_pack.investor_obligation_matrix(session, entity_id)
    headers = ["investor", "commitment", "side_letter", "custom_reporting",
               "restriction", "tax_requirement", "notice_variant", "mfn", "review_needed"]
    body = to_csv(headers, [[r.get(h) for h in headers] for r in rows])
    return _csv(body, f"investor_matrix_{entity_id}.csv")


# --------------------------------------------------------------------------- #
# Independent validations                                                      #
# --------------------------------------------------------------------------- #

@router.post("/validate/management-fee")
def validate_management_fee(
    payload: FeeValidationRequest,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    rule = lpa_validation.get_approved_rule(
        session, entity_id=payload.entity_id, rule_type=ClauseType.MANAGEMENT_FEE
    )
    if payload.annual_rate is None and rule is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "no approved management_fee rule for entity and no annual_rate supplied",
        )
    try:
        return lpa_validation.validate_management_fee(
            investor=payload.investor, fee_base=payload.fee_base, actual_fee=payload.actual_fee,
            annual_rate=payload.annual_rate, periods_per_year=payload.periods_per_year,
            period=payload.period, rule=rule,
        )
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))


@router.post("/validate/capital-call")
def validate_capital_call(
    payload: CapitalCallValidationRequest,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    rule = lpa_validation.get_approved_rule(
        session, entity_id=payload.entity_id, rule_type=ClauseType.CAPITAL_CALL
    )
    return lpa_validation.validate_capital_call(
        investors=[i.model_dump() for i in payload.investors],
        total_call_amount=payload.total_call_amount,
        rule=rule,
    )


@router.post("/validate/waterfall")
def validate_waterfall(
    payload: WaterfallValidationRequest,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    preferred_rule = lpa_validation.get_approved_rule(
        session, entity_id=payload.entity_id, rule_type=ClauseType.PREFERRED_RETURN
    )
    carry_rule = lpa_validation.get_approved_rule(
        session, entity_id=payload.entity_id, rule_type=ClauseType.CARRIED_INTEREST
    )
    waterfall_rule = lpa_validation.get_approved_rule(
        session, entity_id=payload.entity_id, rule_type=ClauseType.DISTRIBUTION_WATERFALL
    )
    return lpa_validation.validate_waterfall(
        investors=[i.model_dump() for i in payload.investors],
        distribution_amount=payload.distribution_amount,
        preferred_rate=payload.preferred_rate,
        carry_pct=payload.carry_pct,
        years=payload.years or Decimal("1"),
        preferred_rule=preferred_rule,
        carry_rule=carry_rule,
        waterfall_rule=waterfall_rule,
    )
