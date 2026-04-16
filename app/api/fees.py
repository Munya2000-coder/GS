from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.fee import FeeCalculationRun, FeeSchedule
from app.models.workflow import WorkflowState
from app.schemas.fee import (
    FeeAccrualOut,
    FeeRunOut,
    FeeRunRequest,
    FeeScheduleCreate,
    FeeScheduleOut,
)
from app.services import audit, fees

router = APIRouter(prefix="/fees", tags=["fees"])


@router.post("/schedules", response_model=FeeScheduleOut, status_code=201)
def create_schedule(
    payload: FeeScheduleCreate,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    schedule = FeeSchedule(**payload.model_dump())
    session.add(schedule)
    session.flush()
    audit.log_event(
        session, actor_user_id=user.id, action="fee_schedule.create",
        object_type="fee_schedule", object_id=schedule.id, after=payload.model_dump(),
    )
    session.commit()
    session.refresh(schedule)
    return schedule


@router.post("/schedules/{schedule_id}/approve", response_model=FeeScheduleOut)
def approve_schedule(
    schedule_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.APPROVE)),
):
    from app.core.config import get_settings

    schedule = session.get(FeeSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "schedule not found")
    if schedule.state not in (WorkflowState.DRAFT, WorkflowState.PENDING_REVIEW):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"cannot approve from state {schedule.state}")
    # Maker/checker
    if schedule.approved_by_user_id is None and not get_settings().allow_self_approval:
        last_create = session.execute(
            __import__("sqlalchemy").text(
                "SELECT actor_user_id FROM audit_events "
                "WHERE object_type='fee_schedule' AND object_id=:id AND action='fee_schedule.create' "
                "ORDER BY id LIMIT 1"
            ),
            {"id": str(schedule_id)},
        ).fetchone()
        if last_create and last_create[0] == user.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "maker cannot approve own schedule")
    schedule.state = WorkflowState.APPROVED
    schedule.approved_by_user_id = user.id
    audit.log_event(
        session, actor_user_id=user.id, action="fee_schedule.approve",
        object_type="fee_schedule", object_id=schedule.id, after={"state": schedule.state},
    )
    session.commit()
    session.refresh(schedule)
    return schedule


@router.get("/schedules", response_model=list[FeeScheduleOut])
def list_schedules(
    entity_id: int | None = None,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    q = session.query(FeeSchedule)
    if entity_id is not None:
        q = q.filter(FeeSchedule.entity_id == entity_id)
    return q.all()


@router.post("/run", response_model=FeeRunOut, status_code=201)
def run_fees(
    payload: FeeRunRequest,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    try:
        run = fees.run_fees(
            session, user,
            fees.FeeRunRequest(
                entity_id=payload.entity_id,
                period_start=payload.period_start,
                period_end=payload.period_end,
            ),
        )
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(run)
    return FeeRunOut(
        id=run.id,
        entity_id=run.entity_id,
        period_start=run.period_start,
        period_end=run.period_end,
        state=run.state,
        input_snapshot_hash=run.input_snapshot_hash,
        accruals=[
            FeeAccrualOut(
                id=a.id, schedule_id=a.schedule_id, investor_id=a.investor_id,
                basis_amount=a.basis_amount, applied_rate_bps=a.applied_rate_bps,
                gross_fee=a.gross_fee, offset_amount=a.offset_amount, net_fee=a.net_fee,
            )
            for a in run.accruals
        ],
    )
