"""Transaction ingestion (Epic 3). Raw imported records and normalised
business transactions. Every transaction carries lineage back to its
import batch and source payload."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Date, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin
from app.models.workflow import WorkflowState


class TransactionType(StrEnum):
    CAPITAL_CALL = "capital_call"
    CONTRIBUTION = "contribution"
    DISTRIBUTION = "distribution"
    RECALL = "recall"
    MGMT_FEE = "management_fee"
    FEE_OFFSET = "fee_offset"
    EXPENSE = "expense"
    NAV = "nav"
    REALISED_GAIN = "realised_gain"
    REALISED_LOSS = "realised_loss"
    UNREALISED_PNL = "unrealised_pnl"
    PORTFOLIO_CASH_IN = "portfolio_cash_in"
    PORTFOLIO_CASH_OUT = "portfolio_cash_out"
    JOURNAL = "journal"


class TransactionState(StrEnum):
    DRAFT = "draft"
    VALIDATED = "validated"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    POSTED = "posted"
    REVERSED = "reversed"
    REJECTED = "rejected"


class ImportBatch(Base, TimestampMixin):
    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_system: Mapped[str] = mapped_column(String(64), nullable=False)
    source_owner: Mapped[str] = mapped_column(String(64), nullable=False)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mapping_version: Mapped[str] = mapped_column(String(32), nullable=False)
    record_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    accepted_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rejected_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="received", nullable=False)
    raw_payload: Mapped[str] = mapped_column(String, nullable=False)
    submitted_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="batch")
    exceptions: Mapped[list["ImportException"]] = relationship(
        "ImportException", back_populates="batch", cascade="all, delete-orphan"
    )


class ImportException(Base, TimestampMixin):
    __tablename__ = "import_exceptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("import_batches.id"), nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    severity: Mapped[str] = mapped_column(String(16), default="error", nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[str] = mapped_column(String(1024), nullable=False)
    source_payload: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False)
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    remediation_note: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    batch: Mapped[ImportBatch] = relationship("ImportBatch", back_populates="exceptions")


class Transaction(Base, TimestampMixin):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("batch_id", "source_reference", name="uq_tx_source_ref"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("import_batches.id"), nullable=False)
    source_reference: Mapped[str] = mapped_column(String(128), nullable=False)

    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    investor_id: Mapped[int | None] = mapped_column(ForeignKey("investors.id"), nullable=True)
    capital_account_id: Mapped[int | None] = mapped_column(ForeignKey("capital_accounts.id"), nullable=True)

    transaction_type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)

    state: Mapped[TransactionState] = mapped_column(
        Enum(TransactionState), default=TransactionState.DRAFT, nullable=False
    )
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    posted_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reversed_by_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("transactions.id"), nullable=True
    )

    batch: Mapped[ImportBatch] = relationship("ImportBatch", back_populates="transactions")
