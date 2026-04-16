"""Security primitives: role definitions, permission checks, and the
dependency that resolves the active user for a request.

Authentication here uses a lightweight header-based scheme
(`X-User-Id: <username>`) intended for development and testing. In
production this is replaced by an SSO/OIDC integration — the
`CurrentUser` dependency is the only surface that needs to change.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

from app.core.database import get_session


# Surfaces "Authorize" button in Swagger UI; non-enforcing, the real check
# lives in `current_user` below.
api_key_scheme = APIKeyHeader(name="X-User-Id", auto_error=False)


class Role(StrEnum):
    FUND_ACCOUNTANT = "fund_accountant"
    FUND_CONTROLLER = "fund_controller"
    FINANCE_MANAGER = "finance_manager"
    OPS_ANALYST = "ops_analyst"
    IR = "investor_relations"
    PORTFOLIO_ANALYST = "portfolio_analyst"
    COMPLIANCE = "compliance"
    AUDITOR = "auditor"
    SYS_ADMIN = "sys_admin"
    EXECUTIVE = "executive"
    EXTERNAL = "external"


class Permission(StrEnum):
    READ = "read"
    CREATE = "create"
    EDIT = "edit"
    APPROVE = "approve"
    POST = "post"
    EXPORT = "export"
    ADMIN = "admin"


ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.FUND_ACCOUNTANT: {Permission.READ, Permission.CREATE, Permission.EDIT, Permission.EXPORT},
    Role.FUND_CONTROLLER: {
        Permission.READ, Permission.CREATE, Permission.EDIT,
        Permission.APPROVE, Permission.POST, Permission.EXPORT,
    },
    Role.FINANCE_MANAGER: {Permission.READ, Permission.EXPORT},
    Role.OPS_ANALYST: {Permission.READ, Permission.CREATE, Permission.EDIT, Permission.EXPORT},
    Role.IR: {Permission.READ, Permission.EXPORT},
    Role.PORTFOLIO_ANALYST: {Permission.READ, Permission.EXPORT},
    Role.COMPLIANCE: {Permission.READ, Permission.EXPORT},
    Role.AUDITOR: {Permission.READ, Permission.EXPORT},
    Role.SYS_ADMIN: {p for p in Permission},
    Role.EXECUTIVE: {Permission.READ},
    Role.EXTERNAL: {Permission.READ},
}


class AuthUser:
    def __init__(self, id: int, username: str, roles: set[Role], fund_scope: set[int] | None):
        self.id = id
        self.username = username
        self.roles = roles
        self.fund_scope = fund_scope

    def has_permission(self, permission: Permission) -> bool:
        return any(permission in ROLE_PERMISSIONS[r] for r in self.roles)

    def can_access_fund(self, fund_id: int) -> bool:
        if self.fund_scope is None:
            return True
        return fund_id in self.fund_scope


def current_user(
    x_user_id: Annotated[str | None, Depends(api_key_scheme)] = None,
    session: Session = Depends(get_session),
) -> AuthUser:
    from app.models.user import User

    if not x_user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing X-User-Id header")
    user = session.query(User).filter(User.username == x_user_id, User.active.is_(True)).one_or_none()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "unknown or inactive user")
    return AuthUser(
        id=user.id,
        username=user.username,
        roles={Role(r) for r in user.roles_list()},
        fund_scope=user.fund_scope_list(),
    )


def require_permission(permission: Permission):
    def _dep(user: AuthUser = Depends(current_user)) -> AuthUser:
        if not user.has_permission(permission):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"missing permission: {permission}")
        return user
    return _dep
