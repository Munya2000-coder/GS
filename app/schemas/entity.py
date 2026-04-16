from __future__ import annotations

from app.models.entity import EntityStatus, EntityType
from app.schemas.common import ORMBase
from pydantic import Field


class EntityCreate(ORMBase):
    code: str = Field(min_length=2, max_length=32)
    legal_name: str
    short_name: str
    entity_type: EntityType
    jurisdiction: str
    vintage_year: int | None = None
    strategy: str | None = None
    base_currency: str = Field(min_length=3, max_length=3)
    reporting_currency: str = Field(min_length=3, max_length=3)
    parent_id: int | None = None


class EntityUpdate(ORMBase):
    legal_name: str | None = None
    short_name: str | None = None
    jurisdiction: str | None = None
    strategy: str | None = None
    status: EntityStatus | None = None
    parent_id: int | None = None


class EntityOut(ORMBase):
    id: int
    code: str
    legal_name: str
    short_name: str
    entity_type: EntityType
    jurisdiction: str
    vintage_year: int | None
    strategy: str | None
    base_currency: str
    reporting_currency: str
    status: EntityStatus
    parent_id: int | None
