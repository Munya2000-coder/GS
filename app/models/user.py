"""Platform users with scoped entitlements (Epic 10)."""

from __future__ import annotations

import json

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    roles_json: Mapped[str] = mapped_column(String, default="[]", nullable=False)
    fund_scope_json: Mapped[str | None] = mapped_column(String, nullable=True)
    sso_subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def roles_list(self) -> list[str]:
        return json.loads(self.roles_json or "[]")

    def set_roles(self, roles: list[str]) -> None:
        self.roles_json = json.dumps(sorted(set(roles)))

    def fund_scope_list(self) -> set[int] | None:
        if self.fund_scope_json is None:
            return None
        return set(json.loads(self.fund_scope_json))

    def set_fund_scope(self, fund_ids: list[int] | None) -> None:
        self.fund_scope_json = None if fund_ids is None else json.dumps(sorted(set(fund_ids)))
