from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.audit import AuditEvent
from app.services import lineage

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/events")
def search_events(
    object_type: str | None = None,
    object_id: str | None = None,
    action: str | None = None,
    limit: int = 200,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
) -> list[dict[str, Any]]:
    q = session.query(AuditEvent)
    if object_type:
        q = q.filter(AuditEvent.object_type == object_type)
    if object_id:
        q = q.filter(AuditEvent.object_id == str(object_id))
    if action:
        q = q.filter(AuditEvent.action == action)
    events = q.order_by(AuditEvent.id.desc()).limit(min(limit, 1000)).all()
    return [
        {
            "id": e.id,
            "occurred_at": e.occurred_at.isoformat(),
            "actor_user_id": e.actor_user_id,
            "action": e.action,
            "object_type": e.object_type,
            "object_id": e.object_id,
            "before": e.before_state,
            "after": e.after_state,
            "privileged": e.privileged,
        }
        for e in events
    ]


@router.get("/lineage/upstream")
def upstream(
    object_type: str,
    object_id: str,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
) -> list[dict[str, Any]]:
    return lineage.trace_upstream(session, object_type, object_id)


@router.get("/lineage/downstream")
def downstream(
    object_type: str,
    object_id: str,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
) -> list[dict[str, Any]]:
    return lineage.trace_downstream(session, object_type, object_id)
