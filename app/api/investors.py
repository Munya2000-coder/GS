from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.capital_account import CapitalAccount
from app.models.investor import Commitment, Investor
from app.schemas.investor import (
    CapitalAccountCreate,
    CapitalAccountOut,
    CommitmentCreate,
    CommitmentOut,
    InvestorCreate,
    InvestorOut,
)
from app.services import audit

router = APIRouter(prefix="/investors", tags=["investors"])


@router.post("", response_model=InvestorOut, status_code=201)
def create_investor(
    payload: InvestorCreate,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    if session.query(Investor).filter(Investor.code == payload.code).first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"investor code {payload.code} exists")
    investor = Investor(**payload.model_dump())
    session.add(investor)
    session.flush()
    audit.log_event(
        session, actor_user_id=user.id, action="investor.create",
        object_type="investor", object_id=investor.id, after=payload.model_dump(),
    )
    session.commit()
    session.refresh(investor)
    return investor


@router.get("", response_model=list[InvestorOut])
def list_investors(session: Session = Depends(get_session), _: AuthUser = Depends(require_permission(Permission.READ))):
    return session.query(Investor).order_by(Investor.code).all()


@router.post("/commitments", response_model=CommitmentOut, status_code=201)
def add_commitment(
    payload: CommitmentCreate,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    commitment = Commitment(**payload.model_dump())
    session.add(commitment)
    session.flush()
    audit.log_event(
        session, actor_user_id=user.id, action="commitment.create",
        object_type="commitment", object_id=commitment.id, after=payload.model_dump(),
    )
    session.commit()
    session.refresh(commitment)
    return commitment


@router.get("/{investor_id}/commitments", response_model=list[CommitmentOut])
def list_commitments(investor_id: int, session: Session = Depends(get_session), _: AuthUser = Depends(require_permission(Permission.READ))):
    return session.query(Commitment).filter(Commitment.investor_id == investor_id).all()


@router.post("/capital-accounts", response_model=CapitalAccountOut, status_code=201)
def create_capital_account(
    payload: CapitalAccountCreate,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    ca = CapitalAccount(**payload.model_dump())
    session.add(ca)
    session.flush()
    audit.log_event(
        session, actor_user_id=user.id, action="capital_account.create",
        object_type="capital_account", object_id=ca.id, after=payload.model_dump(),
    )
    session.commit()
    session.refresh(ca)
    return ca


@router.get("/{investor_id}/capital-accounts", response_model=list[CapitalAccountOut])
def list_capital_accounts(investor_id: int, session: Session = Depends(get_session), _: AuthUser = Depends(require_permission(Permission.READ))):
    return session.query(CapitalAccount).filter(CapitalAccount.investor_id == investor_id).all()
