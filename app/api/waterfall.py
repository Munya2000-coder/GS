from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.waterfall import WaterfallModel, WaterfallRun
from app.models.workflow import WorkflowState
from app.schemas.waterfall import (
    WaterfallModelCreate,
    WaterfallModelOut,
    WaterfallRunOut,
    WaterfallRunRequest,
    WaterfallTierOut,
)
from app.services import audit, waterfall

router = APIRouter(prefix="/waterfall", tags=["waterfall"])


@router.post("/models", response_model=WaterfallModelOut, status_code=201)
def create_model(
    payload: WaterfallModelCreate,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    model = WaterfallModel(**payload.model_dump())
    session.add(model)
    session.flush()
    audit.log_event(
        session, actor_user_id=user.id, action="waterfall_model.create",
        object_type="waterfall_model", object_id=model.id, after=payload.model_dump(),
    )
    session.commit()
    session.refresh(model)
    return model


@router.post("/models/{model_id}/approve", response_model=WaterfallModelOut)
def approve_model(
    model_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.APPROVE)),
):
    from app.core.config import get_settings

    model = session.get(WaterfallModel, model_id)
    if not model:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "model not found")
    if model.state not in (WorkflowState.DRAFT, WorkflowState.PENDING_REVIEW):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"cannot approve from state {model.state}")
    # validate parameters
    if model.carried_interest_bps + model.preferred_return_bps > 20000:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid waterfall parameters")
    model.state = WorkflowState.APPROVED
    model.approved_by_user_id = user.id
    audit.log_event(
        session, actor_user_id=user.id, action="waterfall_model.approve",
        object_type="waterfall_model", object_id=model.id, after={"state": model.state},
    )
    session.commit()
    session.refresh(model)
    return model


@router.get("/models", response_model=list[WaterfallModelOut])
def list_models(
    entity_id: int | None = None,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    q = session.query(WaterfallModel)
    if entity_id is not None:
        q = q.filter(WaterfallModel.entity_id == entity_id)
    return q.all()


@router.post("/run", response_model=WaterfallRunOut, status_code=201)
def run_waterfall(
    payload: WaterfallRunRequest,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    try:
        run = waterfall.run_waterfall(
            session, user=user, model_id=payload.model_id,
            as_of=payload.as_of, scenario_label=payload.scenario_label,
            is_scenario=payload.is_scenario,
        )
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(run)
    return WaterfallRunOut(
        id=run.id, model_id=run.model_id, entity_id=run.entity_id,
        as_of_date=run.as_of_date, scenario_label=run.scenario_label,
        is_scenario=run.is_scenario, state=run.state,
        input_snapshot_hash=run.input_snapshot_hash,
        tiers=[
            WaterfallTierOut(
                tier_order=t.tier_order, tier_name=t.tier_name,
                lp_amount=t.lp_amount, gp_amount=t.gp_amount, formula_text=t.formula_text,
            )
            for t in run.tiers
        ],
    )


@router.post("/runs/{run_id}/approve", response_model=WaterfallRunOut)
def approve_run(
    run_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.APPROVE)),
):
    try:
        run = waterfall.approve_run(session, user, run_id)
    except (ValueError, PermissionError) as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(run)
    return WaterfallRunOut(
        id=run.id, model_id=run.model_id, entity_id=run.entity_id,
        as_of_date=run.as_of_date, scenario_label=run.scenario_label,
        is_scenario=run.is_scenario, state=run.state,
        input_snapshot_hash=run.input_snapshot_hash,
        tiers=[
            WaterfallTierOut(
                tier_order=t.tier_order, tier_name=t.tier_name,
                lp_amount=t.lp_amount, gp_amount=t.gp_amount, formula_text=t.formula_text,
            )
            for t in run.tiers
        ],
    )
