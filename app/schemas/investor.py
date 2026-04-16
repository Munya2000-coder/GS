from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import Field

from app.models.investor import InvestorStatus
from app.schemas.common import ORMBase


class InvestorCreate(ORMBase):
    code: str = Field(min_length=2, max_length=32)
    legal_name: str
    short_name: str
    domicile: str
    tax_classification: str | None = None
    regulatory_classification: str | None = None
    side_letter: bool = False
    primary_contact: str | None = None
    primary_email: str | None = None


class InvestorOut(ORMBase):
    id: int
    code: str
    legal_name: str
    short_name: str
    domicile: str
    status: InvestorStatus
    side_letter: bool
    primary_email: str | None


class CommitmentCreate(ORMBase):
    investor_id: int
    entity_id: int
    closing_id: str
    closing_date: date
    investor_class: str
    series: str | None = None
    commitment_amount: Decimal
    currency: str = Field(min_length=3, max_length=3)


class CommitmentOut(ORMBase):
    id: int
    investor_id: int
    entity_id: int
    closing_id: str
    closing_date: date
    investor_class: str
    commitment_amount: Decimal
    currency: str


class CapitalAccountCreate(ORMBase):
    code: str
    investor_id: int
    entity_id: int
    investor_class: str
    series: str | None = None
    carry_participant: bool = False


class CapitalAccountOut(ORMBase):
    id: int
    code: str
    investor_id: int
    entity_id: int
    investor_class: str
    contributed: Decimal
    distributed: Decimal
    recallable: Decimal
    ending_nav: Decimal
    allocated_pnl: Decimal
    carry_participant: bool
