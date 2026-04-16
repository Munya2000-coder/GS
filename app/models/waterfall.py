"""Waterfall models and calculation runs (Epic 4)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import EffectiveDatingMixin, TimestampMixin
from app.models.workflow import WorkflowState


class WaterfallMethod(StrEnum):
    AMERICAN = "american"
    EUROPEAN = "european"
    HYBRID = "hybrid"


class WaterfallModel(Base, TimestampMixin, EffectiveDatingMixin):
    """Parameter-driven waterfall configuration. `tiers_json` is a JSON
    array of tier definitions: return-of-capital, preferred return,
    catch-up, carried interest split, and optional gates/hurdles."""

    __tablename__ = "waterfall_models"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    investor_class: Mapped[str | None] = mapped_column(String(32), nullable=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    method: Mapped[WaterfallMethod] = mapped_column(Enum(WaterfallMethod), nullable=False)
    preferred_return_bps: Mapped[int] = mapped_column(Integer, default=800, nullable=False)
    catchup_percentage_bps: Mapped[int] = mapped_column(Integer, default=10000, nullable=False)
    carried_interest_bps: Mapped[int] = mapped_column(Integer, default=2000, nullable=False)
    gp_catchup_share_bps: Mapped[int] = mapped_column(Integer, default=10000, nullable=False)
    hurdle_compounding: Mapped[str] = mapped_column(String(32), default="annual", nullable=False)
    tiers_json: Mapped[str] = mapped_column(String, nullable=False, default="[]")

    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    state: Mapped[WorkflowState] = mapped_column(
        Enum(WorkflowState), default=WorkflowState.DRAFT, nullable=False
    )
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class WaterfallRun(Base, TimestampMixin):
    __tablename__ = "waterfall_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("waterfall_models.id"), nullable=False)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    as_of_date: Mapped[date] = mapped_column(nullable=False)
    scenario_label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    executed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    executed_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    input_snapshot_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    model_version_snapshot: Mapped[str] = mapped_column(String, nullable=False)
    is_scenario: Mapped[bool] = mapped_column(default=False, nullable=False)
    state: Mapped[WorkflowState] = mapped_column(
        Enum(WorkflowState), default=WorkflowState.DRAFT, nullable=False
    )
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    tiers: Mapped[list["WaterfallTierResult"]] = relationship(
        "WaterfallTierResult", back_populates="run", cascade="all, delete-orphan", order_by="WaterfallTierResult.tier_order"
    )
    allocations: Mapped[list["ParticipantAllocation"]] = relationship(
        "ParticipantAllocation", back_populates="run", cascade="all, delete-orphan"
    )


class WaterfallTierResult(Base):
    __tablename__ = "waterfall_tier_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("waterfall_runs.id"), nullable=False)
    tier_order: Mapped[int] = mapped_column(Integer, nullable=False)
    tier_name: Mapped[str] = mapped_column(String(64), nullable=False)
    lp_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0"), nullable=False)
    gp_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0"), nullable=False)
    formula_text: Mapped[str] = mapped_column(String(512), nullable=False)

    run: Mapped[WaterfallRun] = relationship("WaterfallRun", back_populates="tiers")


class ParticipantAllocation(Base):
    __tablename__ = "participant_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("waterfall_runs.id"), nullable=False)
    participant: Mapped[str] = mapped_column(String(128), nullable=False)
    participant_type: Mapped[str] = mapped_column(String(32), nullable=False)
    allocation_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)

    run: Mapped[WaterfallRun] = relationship("WaterfallRun", back_populates="allocations")
