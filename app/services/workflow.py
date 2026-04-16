"""Workflow transitions with maker-checker enforcement."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import AuthUser, Permission
from app.models.workflow import WorkflowState, can_transition
from app.services.audit import log_event


class WorkflowError(Exception):
    pass


@dataclass
class Transitionable:
    object_type: str
    object_id: int
    current_state: WorkflowState
    created_by_user_id: int | None
    approved_by_user_id: int | None = None


def transition(
    session: Session,
    user: AuthUser,
    target: Transitionable,
    new_state: WorkflowState,
    *,
    require_permission: Permission | None = None,
) -> None:
    if not can_transition(target.current_state, new_state):
        raise WorkflowError(
            f"illegal transition {target.current_state} -> {new_state} "
            f"for {target.object_type}:{target.object_id}"
        )

    settings = get_settings()
    if new_state in (WorkflowState.APPROVED, WorkflowState.POSTED):
        if require_permission and not user.has_permission(require_permission):
            raise WorkflowError(f"missing permission: {require_permission}")
        if not user.has_permission(Permission.APPROVE):
            raise WorkflowError("approver permission required")
        if (
            target.created_by_user_id is not None
            and target.created_by_user_id == user.id
            and not settings.allow_self_approval
        ):
            raise WorkflowError("maker cannot approve own submission")

    log_event(
        session,
        actor_user_id=user.id,
        action=f"workflow.{new_state}",
        object_type=target.object_type,
        object_id=target.object_id,
        before={"state": target.current_state},
        after={"state": new_state},
    )
