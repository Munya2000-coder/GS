from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, Role, require_permission
from app.models.user import User
from app.services import audit

router = APIRouter(prefix="/admin", tags=["admin"])


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    display_name: str
    email: EmailStr
    roles: list[Role] = Field(default_factory=list)
    fund_scope: list[int] | None = None
    mfa_enabled: bool = False


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    email: str
    roles: list[str]
    fund_scope: list[int] | None
    active: bool
    mfa_enabled: bool


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.ADMIN)),
):
    if session.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "username exists")
    new_user = User(
        username=payload.username,
        display_name=payload.display_name,
        email=payload.email,
        mfa_enabled=payload.mfa_enabled,
    )
    new_user.set_roles([r.value for r in payload.roles])
    new_user.set_fund_scope(payload.fund_scope)
    session.add(new_user)
    session.flush()
    audit.log_event(
        session, actor_user_id=user.id, action="user.create",
        object_type="user", object_id=new_user.id, privileged=True,
        after={"username": payload.username, "roles": [r.value for r in payload.roles]},
    )
    session.commit()
    session.refresh(new_user)
    return UserOut(
        id=new_user.id, username=new_user.username, display_name=new_user.display_name,
        email=new_user.email, roles=new_user.roles_list(), fund_scope=sorted(list(new_user.fund_scope_list() or [])) or None,
        active=new_user.active, mfa_enabled=new_user.mfa_enabled,
    )


@router.post("/users/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(
    user_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.ADMIN)),
):
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    target.active = False
    audit.log_event(
        session, actor_user_id=user.id, action="user.deactivate",
        object_type="user", object_id=target.id, privileged=True,
    )
    session.commit()
    session.refresh(target)
    return UserOut(
        id=target.id, username=target.username, display_name=target.display_name,
        email=target.email, roles=target.roles_list(), fund_scope=sorted(list(target.fund_scope_list() or [])) or None,
        active=target.active, mfa_enabled=target.mfa_enabled,
    )


@router.get("/users", response_model=list[UserOut])
def list_users(
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.ADMIN)),
):
    return [
        UserOut(
            id=u.id, username=u.username, display_name=u.display_name, email=u.email,
            roles=u.roles_list(), fund_scope=sorted(list(u.fund_scope_list() or [])) or None,
            active=u.active, mfa_enabled=u.mfa_enabled,
        )
        for u in session.query(User).order_by(User.username).all()
    ]
