"""Capital accounts: investor balances by entity and class (Epic 2)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class CapitalAccount(Base, TimestampMixin):
    __tablename__ = "capital_accounts"
    __table_args__ = (
        UniqueConstraint("investor_id", "entity_id", "investor_class", name="uq_capital_account"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    investor_id: Mapped[int] = mapped_column(ForeignKey("investors.id"), nullable=False)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    investor_class: Mapped[str] = mapped_column(String(32), nullable=False)
    series: Mapped[str | None] = mapped_column(String(32), nullable=True)

    contributed: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0"), nullable=False)
    distributed: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0"), nullable=False)
    recallable: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0"), nullable=False)
    ending_nav: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0"), nullable=False)
    allocated_pnl: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0"), nullable=False)

    rights_json: Mapped[str | None] = mapped_column(String, nullable=True)
    carry_participant: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    investor = relationship("Investor")
    entity = relationship("Entity")

    @property
    def unfunded(self) -> Decimal:
        from app.models.investor import Commitment

        return Decimal("0")  # computed by services when commitment context is known
