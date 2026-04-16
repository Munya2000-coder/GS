from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import Field

from app.models.waterfall import WaterfallMethod
from app.models.workflow import WorkflowState
from app.schemas.common import ORMBase


class WaterfallModelCreate(ORMBase):
    entity_id: int
    investor_class: str | None = None
    name: str
    method: WaterfallMethod = WaterfallMethod.EUROPEAN
    preferred_return_bps: int = Field(default=800, ge=0, le=10000)
    catchup_percentage_bps: int = Field(default=10000, ge=0, le=10000)
    carried_interest_bps: int = Field(default=2000, ge=0, le=10000)
    gp_catchup_share_bps: int = Field(default=10000, ge=0, le=10000)
    hurdle_compounding: str = "annual"
    effective_from: date
    effective_to: date | None = None
    tiers_json: str = "[]"


class WaterfallModelOut(ORMBase):
    id: int
    entity_id: int
    investor_class: str | None
    name: str
    method: WaterfallMethod
    preferred_return_bps: int
    catchup_percentage_bps: int
    carried_interest_bps: int
    hurdle_compounding: str
    effective_from: date
    effective_to: date | None
    version: int
    state: WorkflowState


class WaterfallRunRequest(ORMBase):
    model_id: int
    as_of: date
    scenario_label: str | None = None
    is_scenario: bool = False


class WaterfallTierOut(ORMBase):
    tier_order: int
    tier_name: str
    lp_amount: Decimal
    gp_amount: Decimal
    formula_text: str


class WaterfallRunOut(ORMBase):
    id: int
    model_id: int
    entity_id: int
    as_of_date: date
    scenario_label: str | None
    is_scenario: bool
    state: WorkflowState
    input_snapshot_hash: str
    tiers: list[WaterfallTierOut]
