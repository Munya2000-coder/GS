"""Investor master records and commitments (Epic 2)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class InvestorStatus(StrEnum):
    PROSPECT = "prospect"
    ACTIVE = "active"
    REDEEMED = "redeemed"
    TRANSFERRED = "transferred"
    INACTIVE = "inactive"


class Investor(Base, TimestampMixin):
    __tablename__ = "investors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    short_name: Mapped[str] = mapped_column(String(128), nullable=False)
    domicile: Mapped[str] = mapped_column(String(64), nullable=False)
    tax_classification: Mapped[str | None] = mapped_column(String(64), nullable=True)
    regulatory_classification: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[InvestorStatus] = mapped_column(
        Enum(InvestorStatus), default=InvestorStatus.PROSPECT, nullable=False
    )
    side_letter: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    special_economics_json: Mapped[str | None] = mapped_column(String, nullable=True)
    primary_contact: Mapped[str | None] = mapped_column(String(255), nullable=True)
    primary_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    commitments: Mapped[list["Commitment"]] = relationship(
        "Commitment", back_populates="investor", cascade="all, delete-orphan"
    )


class Commitment(Base, TimestampMixin):
    """An investor's commitment to a fund at a specific closing."""

    __tablename__ = "commitments"
    __table_args__ = (
        UniqueConstraint("investor_id", "entity_id", "closing_id", name="uq_commitment_closing"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    investor_id: Mapped[int] = mapped_column(ForeignKey("investors.id"), nullable=False)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    closing_id: Mapped[str] = mapped_column(String(32), nullable=False)
    closing_date: Mapped[date] = mapped_column(Date, nullable=False)
    investor_class: Mapped[str] = mapped_column(String(32), nullable=False)
    series: Mapped[str | None] = mapped_column(String(32), nullable=True)
    commitment_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    investor: Mapped[Investor] = relationship("Investor", back_populates="commitments")
