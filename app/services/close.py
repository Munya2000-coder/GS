"""Period lifecycle and close calendar operations."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.security import AuthUser, Permission
from app.models.period import AccountingPeriod, CloseStep, PeriodStatus, PeriodType
from app.services import audit


def _period_bounds(period_type: PeriodType, start: date) -> tuple[date, date]:
    if period_type == PeriodType.DAILY:
        return (start, start)
    if period_type == PeriodType.MONTHLY:
        next_month = date(start.year + (start.month // 12), ((start.month % 12) + 1), 1)
        return (start.replace(day=1), next_month - timedelta(days=1))
    if period_type == PeriodType.QUARTERLY:
        q_start_month = ((start.month - 1) // 3) * 3 + 1
        q_start = date(start.year, q_start_month, 1)
        end_month = q_start_month + 2
        end_next = date(start.year + (end_month // 12), ((end_month % 12) + 1), 1)
        return (q_start, end_next - timedelta(days=1))
    if period_type == PeriodType.ANNUAL:
        return (date(start.year, 1, 1), date(start.year, 12, 31))
    raise ValueError(f"unknown period type: {period_type}")


def ensure_period(
    session: Session, *, entity_id: int, period_type: PeriodType, any_date: date
) -> AccountingPeriod:
    p_start, p_end = _period_bounds(period_type, any_date)
    existing = session.query(AccountingPeriod).filter(
        AccountingPeriod.entity_id == entity_id,
        AccountingPeriod.period_type == period_type,
        AccountingPeriod.period_start == p_start,
    ).first()
    if existing:
        return existing
    period = AccountingPeriod(
        entity_id=entity_id,
        period_type=period_type,
        period_start=p_start,
        period_end=p_end,
        status=PeriodStatus.OPEN,
    )
    session.add(period)
    session.flush()
    return period


def soft_close(session: Session, user: AuthUser, period_id: int) -> AccountingPeriod:
    period = session.get(AccountingPeriod, period_id)
    if not period:
        raise ValueError("period not found")
    if period.status != PeriodStatus.OPEN:
        raise ValueError(f"cannot soft-close from {period.status}")
    period.status = PeriodStatus.SOFT_CLOSE
    audit.log_event(
        session, actor_user_id=user.id, action="period.soft_close",
        object_type="accounting_period", object_id=period.id, after={"status": period.status},
    )
    return period


def hard_close(session: Session, user: AuthUser, period_id: int) -> AccountingPeriod:
    if not user.has_permission(Permission.APPROVE):
        raise PermissionError("approve permission required to close period")
    period = session.get(AccountingPeriod, period_id)
    if not period:
        raise ValueError("period not found")
    if period.status not in (PeriodStatus.OPEN, PeriodStatus.SOFT_CLOSE, PeriodStatus.REOPENED):
        raise ValueError(f"cannot hard-close from {period.status}")
    pending = session.query(CloseStep).filter(
        CloseStep.period_id == period.id, CloseStep.status != "signed_off"
    ).count()
    if pending > 0:
        raise ValueError(f"cannot close; {pending} close step(s) awaiting sign-off")
    period.status = PeriodStatus.CLOSED
    period.closed_by_user_id = user.id
    audit.log_event(
        session, actor_user_id=user.id, action="period.close",
        object_type="accounting_period", object_id=period.id,
        after={"status": period.status}, privileged=True,
    )
    return period


def reopen(session: Session, user: AuthUser, period_id: int, reason: str) -> AccountingPeriod:
    if not user.has_permission(Permission.APPROVE):
        raise PermissionError("approve permission required to reopen period")
    period = session.get(AccountingPeriod, period_id)
    if not period:
        raise ValueError("period not found")
    if period.status not in (PeriodStatus.CLOSED, PeriodStatus.SOFT_CLOSE):
        raise ValueError(f"cannot reopen from {period.status}")
    before = period.status
    period.status = PeriodStatus.REOPENED
    period.reopen_reason = reason
    audit.log_event(
        session, actor_user_id=user.id, action="period.reopen",
        object_type="accounting_period", object_id=period.id,
        before={"status": before}, after={"status": period.status, "reason": reason},
        privileged=True,
    )
    return period


def add_close_step(
    session: Session, *, user: AuthUser, period_id: int, name: str,
    owner_user_id: int | None = None, due_date: date | None = None,
    depends_on_step_id: int | None = None,
) -> CloseStep:
    step = CloseStep(
        period_id=period_id, name=name, owner_user_id=owner_user_id,
        due_date=due_date, depends_on_step_id=depends_on_step_id,
    )
    session.add(step)
    session.flush()
    audit.log_event(
        session, actor_user_id=user.id, action="close_step.create",
        object_type="close_step", object_id=step.id, after={"name": name},
    )
    return step


def sign_off_step(session: Session, user: AuthUser, step_id: int) -> CloseStep:
    step = session.get(CloseStep, step_id)
    if not step:
        raise ValueError("step not found")
    if step.depends_on_step_id:
        dep = session.get(CloseStep, step.depends_on_step_id)
        if dep and dep.status != "signed_off":
            raise ValueError(f"dependency step {dep.id} not yet signed off")
    step.status = "signed_off"
    step.signed_off_by_user_id = user.id
    audit.log_event(
        session, actor_user_id=user.id, action="close_step.sign_off",
        object_type="close_step", object_id=step.id, after={"status": "signed_off"},
    )
    return step
