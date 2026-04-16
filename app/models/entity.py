"""Fund, sub-fund, SPV, blocker, feeder, and co-invest entities (Epic 1)."""

from __future__ import annotations

from enum import StrEnum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import EffectiveDatingMixin, TimestampMixin


class EntityType(StrEnum):
    FUND = "fund"
    SUB_FUND = "sub_fund"
    SPV = "spv"
    BLOCKER = "blocker"
    FEEDER = "feeder"
    CO_INVEST = "co_invest"
    MASTER = "master"
    AIV = "aiv"


class EntityStatus(StrEnum):
    SETUP = "setup"
    ACTIVE = "active"
    WINDING_DOWN = "winding_down"
    CLOSED = "closed"
    INACTIVE = "inactive"


class Entity(Base, TimestampMixin):
    __tablename__ = "entities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    short_name: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[EntityType] = mapped_column(Enum(EntityType), nullable=False)
    jurisdiction: Mapped[str] = mapped_column(String(64), nullable=False)
    vintage_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    strategy: Mapped[str | None] = mapped_column(String(128), nullable=True)
    base_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    reporting_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus), default=EntityStatus.SETUP, nullable=False
    )
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id"), nullable=True)

    parent: Mapped["Entity | None"] = relationship("Entity", remote_side="Entity.id", backref="children")
    versions: Mapped[list["EntityVersion"]] = relationship(
        "EntityVersion", back_populates="entity", cascade="all, delete-orphan"
    )

    def has_posted_activity(self, session) -> bool:
        from app.models.transaction import Transaction, TransactionState
        return session.query(Transaction).filter(
            Transaction.entity_id == self.id,
            Transaction.state == TransactionState.POSTED,
        ).first() is not None


class EntityVersion(Base, TimestampMixin, EffectiveDatingMixin):
    """Immutable snapshot of entity configuration so historical reports
    continue using the configuration in force for the historical period."""

    __tablename__ = "entity_versions"
    __table_args__ = (UniqueConstraint("entity_id", "effective_from", name="uq_entity_version_from"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_json: Mapped[str] = mapped_column(String, nullable=False)
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    entity: Mapped[Entity] = relationship("Entity", back_populates="versions")
