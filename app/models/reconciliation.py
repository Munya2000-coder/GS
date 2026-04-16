"""Reconciliation and exception models (Epic 11)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class ReconciliationStatus(StrEnum):
    PENDING = "pending"
    IN_REVIEW = "in_review"
    MATCHED = "matched"
    BREAK = "break"
    SIGNED_OFF = "signed_off"


class Reconciliation(Base, TimestampMixin):
    __tablename__ = "reconciliations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    reconciliation_type: Mapped[str] = mapped_column(String(64), nullable=False)
    as_of: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    source_total: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    target_total: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    variance: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    status: Mapped[ReconciliationStatus] = mapped_column(
        Enum(ReconciliationStatus), default=ReconciliationStatus.PENDING, nullable=False
    )
    signed_off_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    remediation_note: Mapped[str | None] = mapped_column(String(1024), nullable=True)
