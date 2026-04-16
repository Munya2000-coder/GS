"""NAV snapshots by entity and optional investor/class."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class NavSnapshot(Base, TimestampMixin):
    __tablename__ = "nav_snapshots"
    __table_args__ = (
        UniqueConstraint("entity_id", "investor_id", "as_of", name="uq_nav_snapshot"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    investor_id: Mapped[int | None] = mapped_column(ForeignKey("investors.id"), nullable=True)
    capital_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("capital_accounts.id"), nullable=True
    )
    as_of: Mapped[date] = mapped_column(Date, nullable=False)
    gross_asset_value: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    liabilities: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0"), nullable=False)
    ending_nav: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    source_reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    published_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
