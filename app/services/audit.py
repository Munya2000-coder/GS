"""Append-only audit logging service."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit import AuditEvent


def log_event(
    session: Session,
    *,
    actor_user_id: int | None,
    action: str,
    object_type: str,
    object_id: str | int,
    before: Any = None,
    after: Any = None,
    context: dict | None = None,
    privileged: bool = False,
    actor_system: str | None = None,
) -> AuditEvent:
    event = AuditEvent(
        actor_user_id=actor_user_id,
        actor_system=actor_system,
        action=action,
        object_type=object_type,
        object_id=str(object_id),
        before_state=None if before is None else json.dumps(before, default=str),
        after_state=None if after is None else json.dumps(after, default=str),
        context=None if context is None else json.dumps(context, default=str),
        privileged=privileged,
    )
    session.add(event)
    session.flush()
    return event
