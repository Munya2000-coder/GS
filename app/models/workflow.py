"""Workflow states used across calculations, postings, and configuration."""

from __future__ import annotations

from enum import StrEnum


class WorkflowState(StrEnum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    POSTED = "posted"
    REJECTED = "rejected"
    ARCHIVED = "archived"


ALLOWED_TRANSITIONS: dict[WorkflowState, set[WorkflowState]] = {
    WorkflowState.DRAFT: {WorkflowState.PENDING_REVIEW, WorkflowState.ARCHIVED},
    WorkflowState.PENDING_REVIEW: {WorkflowState.APPROVED, WorkflowState.REJECTED, WorkflowState.DRAFT},
    WorkflowState.APPROVED: {WorkflowState.POSTED, WorkflowState.ARCHIVED},
    WorkflowState.POSTED: {WorkflowState.ARCHIVED},
    WorkflowState.REJECTED: {WorkflowState.DRAFT, WorkflowState.ARCHIVED},
    WorkflowState.ARCHIVED: set(),
}


def can_transition(src: WorkflowState, dst: WorkflowState) -> bool:
    return dst in ALLOWED_TRANSITIONS.get(src, set())
