from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import Field

from app.models.fee import FeeBasis
from app.models.workflow import WorkflowState
from app.schemas.common import ORMBase


class FeeScheduleCreate(ORMBase):
    entity_id: int
    investor_id: int | None = None
    investor_class: str | None = None
    name: str
    basis: FeeBasis
    annual_rate_bps: int = Field(ge=0, le=10000)
    periodicity: str = "quarterly"
    effective_from: date
    effective_to: date | None = None
    offsets_enabled: bool = False


class FeeScheduleOut(ORMBase):
    id: int
    entity_id: int
    investor_id: int | None
    investor_class: str | None
    name: str
    basis: FeeBasis
    annual_rate_bps: int
    effective_from: date
    effective_to: date | None
    version: int
    state: WorkflowState


class FeeRunRequest(ORMBase):
    entity_id: int
    period_start: date
    period_end: date


class FeeAccrualOut(ORMBase):
    id: int
    schedule_id: int
    investor_id: int | None
    basis_amount: Decimal
    applied_rate_bps: int
    gross_fee: Decimal
    offset_amount: Decimal
    net_fee: Decimal


class FeeRunOut(ORMBase):
    id: int
    entity_id: int
    period_start: date
    period_end: date
    state: WorkflowState
    input_snapshot_hash: str
    accruals: list[FeeAccrualOut]
