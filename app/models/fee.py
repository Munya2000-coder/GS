"""Fee schedules and calculation runs (Epic 5)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import EffectiveDatingMixin, TimestampMixin
from app.models.workflow import WorkflowState


class FeeBasis(StrEnum):
    COMMITMENT = "commitment"
    INVESTED_CAPITAL = "invested_capital"
    NAV = "nav"
    FLAT = "flat"


class FeeSchedule(Base, TimestampMixin, EffectiveDatingMixin):
    __tablename__ = "fee_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    investor_class: Mapped[str | None] = mapped_column(String(32), nullable=True)
    investor_id: Mapped[int | None] = mapped_column(ForeignKey("investors.id"), nullable=True)

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    basis: Mapped[FeeBasis] = mapped_column(Enum(FeeBasis), nullable=False)
    annual_rate_bps: Mapped[int] = mapped_column(Integer, nullable=False)
    periodicity: Mapped[str] = mapped_column(String(16), default="quarterly", nullable=False)
    step_down_json: Mapped[str | None] = mapped_column(String, nullable=True)
    offsets_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    state: Mapped[WorkflowState] = mapped_column(
        Enum(WorkflowState), default=WorkflowState.DRAFT, nullable=False
    )
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class FeeAccrual(Base, TimestampMixin):
    __tablename__ = "fee_accruals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    schedule_id: Mapped[int] = mapped_column(ForeignKey("fee_schedules.id"), nullable=False)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    investor_id: Mapped[int | None] = mapped_column(ForeignKey("investors.id"), nullable=True)

    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    basis_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    applied_rate_bps: Mapped[int] = mapped_column(Integer, nullable=False)
    gross_fee: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    offset_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0"), nullable=False)
    net_fee: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)

    run_id: Mapped[int] = mapped_column(ForeignKey("fee_calculation_runs.id"), nullable=False)


class FeeCalculationRun(Base, TimestampMixin):
    __tablename__ = "fee_calculation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    executed_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    input_snapshot_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    schedule_version_snapshot: Mapped[str] = mapped_column(String, nullable=False)
    state: Mapped[WorkflowState] = mapped_column(
        Enum(WorkflowState), default=WorkflowState.DRAFT, nullable=False
    )
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    accruals: Mapped[list[FeeAccrual]] = relationship("FeeAccrual")
