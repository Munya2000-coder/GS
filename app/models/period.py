"""Accounting periods and close calendar (Epic 3, Epic 8)."""

from __future__ import annotations

from datetime import date
from enum import StrEnum

from sqlalchemy import Date, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class PeriodStatus(StrEnum):
    OPEN = "open"
    SOFT_CLOSE = "soft_close"
    CLOSED = "closed"
    REOPENED = "reopened"
    ARCHIVED = "archived"


class PeriodType(StrEnum):
    DAILY = "daily"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"


class AccountingPeriod(Base, TimestampMixin):
    __tablename__ = "accounting_periods"
    __table_args__ = (
        UniqueConstraint("entity_id", "period_type", "period_start", name="uq_period"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    period_type: Mapped[PeriodType] = mapped_column(Enum(PeriodType), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[PeriodStatus] = mapped_column(
        Enum(PeriodStatus), default=PeriodStatus.OPEN, nullable=False
    )
    closed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reopen_reason: Mapped[str | None] = mapped_column(String(512), nullable=True)

    def allows_posting(self) -> bool:
        return self.status in (PeriodStatus.OPEN, PeriodStatus.REOPENED)


class CloseStep(Base, TimestampMixin):
    __tablename__ = "close_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("accounting_periods.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    depends_on_step_id: Mapped[int | None] = mapped_column(ForeignKey("close_steps.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    signed_off_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
