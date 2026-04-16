from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import Field

from app.models.transaction import TransactionState, TransactionType
from app.schemas.common import ORMBase


class ImportRequest(ORMBase):
    source_system: str
    source_owner: str
    mapping_version: str
    file_name: str | None = None
    records: list[dict[str, Any]] = Field(min_length=1)


class ImportResultOut(ORMBase):
    batch_id: int
    accepted: int
    rejected: int
    transaction_ids: list[int]
    exception_ids: list[int]


class TransactionOut(ORMBase):
    id: int
    batch_id: int
    source_reference: str
    entity_id: int
    investor_id: int | None
    capital_account_id: int | None
    transaction_type: TransactionType
    transaction_date: date
    amount: Decimal
    currency: str
    description: str | None
    state: TransactionState


class JournalLineOut(ORMBase):
    account_code: str
    debit: Decimal
    credit: Decimal
    currency: str
    capital_account_id: int | None
    memo: str | None


class JournalEntryOut(ORMBase):
    id: int
    entity_id: int
    period_id: int
    entry_date: date
    description: str
    rule_version: str
    source_transaction_id: int | None
    lines: list[JournalLineOut]
