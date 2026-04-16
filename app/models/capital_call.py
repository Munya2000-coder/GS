"""Capital calls and distributions tracked as first-class objects."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Date, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin
from app.models.workflow import WorkflowState


class CashEventPurpose(StrEnum):
    INVESTMENT = "investment"
    MANAGEMENT_FEE = "management_fee"
    EXPENSE = "expense"
    RETURN_OF_CAPITAL = "return_of_capital"
    PROFIT = "profit"
    RECALLABLE_RETURN = "recallable_return"


class CapitalCall(Base, TimestampMixin):
    __tablename__ = "capital_calls"
    __table_args__ = (UniqueConstraint("entity_id", "call_number", name="uq_call_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    call_number: Mapped[str] = mapped_column(String(32), nullable=False)
    notice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    purpose: Mapped[CashEventPurpose] = mapped_column(Enum(CashEventPurpose), nullable=False)
    state: Mapped[WorkflowState] = mapped_column(
        Enum(WorkflowState), default=WorkflowState.DRAFT, nullable=False
    )
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    allocations: Mapped[list["CapitalCallAllocation"]] = relationship(
        "CapitalCallAllocation", back_populates="call", cascade="all, delete-orphan"
    )


class CapitalCallAllocation(Base):
    __tablename__ = "capital_call_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    call_id: Mapped[int] = mapped_column(ForeignKey("capital_calls.id"), nullable=False)
    investor_id: Mapped[int] = mapped_column(ForeignKey("investors.id"), nullable=False)
    capital_account_id: Mapped[int] = mapped_column(ForeignKey("capital_accounts.id"), nullable=False)
    commitment_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    pro_rata_share: Mapped[Decimal] = mapped_column(Numeric(10, 8), nullable=False)
    allocated_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)

    call: Mapped[CapitalCall] = relationship("CapitalCall", back_populates="allocations")


class Distribution(Base, TimestampMixin):
    __tablename__ = "distributions"
    __table_args__ = (UniqueConstraint("entity_id", "distribution_number", name="uq_distribution_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    distribution_number: Mapped[str] = mapped_column(String(32), nullable=False)
    notice_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    purpose: Mapped[CashEventPurpose] = mapped_column(Enum(CashEventPurpose), nullable=False)
    state: Mapped[WorkflowState] = mapped_column(
        Enum(WorkflowState), default=WorkflowState.DRAFT, nullable=False
    )
    recallable: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    allocations: Mapped[list["DistributionAllocation"]] = relationship(
        "DistributionAllocation", back_populates="distribution", cascade="all, delete-orphan"
    )


class DistributionAllocation(Base):
    __tablename__ = "distribution_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    distribution_id: Mapped[int] = mapped_column(ForeignKey("distributions.id"), nullable=False)
    investor_id: Mapped[int] = mapped_column(ForeignKey("investors.id"), nullable=False)
    capital_account_id: Mapped[int] = mapped_column(ForeignKey("capital_accounts.id"), nullable=False)
    allocation_basis: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    pro_rata_share: Mapped[Decimal] = mapped_column(Numeric(10, 8), nullable=False)
    allocated_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)

    distribution: Mapped[Distribution] = relationship("Distribution", back_populates="allocations")
