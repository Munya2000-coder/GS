"""Integration metadata: interface contracts and run logs (Epic 9)."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class InterfaceDirection(StrEnum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class Interface(Base, TimestampMixin):
    __tablename__ = "interfaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    direction: Mapped[InterfaceDirection] = mapped_column(Enum(InterfaceDirection), nullable=False)
    source_owner: Mapped[str] = mapped_column(String(128), nullable=False)
    target_owner: Mapped[str] = mapped_column(String(128), nullable=False)
    schema_version: Mapped[str] = mapped_column(String(32), nullable=False)
    mapping_json: Mapped[str] = mapped_column(String, nullable=False)
    frequency: Mapped[str] = mapped_column(String(32), nullable=False)
    retry_policy: Mapped[str] = mapped_column(String(64), default="manual", nullable=False)


class InterfaceRun(Base):
    __tablename__ = "interface_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    interface_id: Mapped[int] = mapped_column(ForeignKey("interfaces.id"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="running", nullable=False)
    record_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_detail: Mapped[str | None] = mapped_column(String, nullable=True)
    reconciliation_ok: Mapped[bool] = mapped_column(default=False, nullable=False)
    triggered_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
