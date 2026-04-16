"""Transaction ingestion, validation, and journal posting (Epic 3)."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.security import AuthUser, Permission
from app.models.capital_account import CapitalAccount
from app.models.entity import Entity
from app.models.investor import Investor
from app.models.journal import Account, JournalEntry, JournalLine
from app.models.period import AccountingPeriod
from app.models.transaction import (
    ImportBatch,
    ImportException,
    Transaction,
    TransactionState,
    TransactionType,
)
from app.services import audit, lineage

RULE_VERSION = "2026.04.01"


@dataclass
class ImportResult:
    batch_id: int
    accepted: int
    rejected: int
    transaction_ids: list[int]
    exception_ids: list[int]


POSTING_RULES: dict[TransactionType, tuple[str, str]] = {
    TransactionType.CAPITAL_CALL: ("CONTRIB_RECEIVABLE", "CONTRIBUTED_CAPITAL"),
    TransactionType.CONTRIBUTION: ("CASH", "CONTRIBUTED_CAPITAL"),
    TransactionType.DISTRIBUTION: ("DISTRIBUTIONS", "CASH"),
    TransactionType.RECALL: ("CASH", "CONTRIBUTED_CAPITAL"),
    TransactionType.MGMT_FEE: ("MGMT_FEE_EXPENSE", "MGMT_FEE_PAYABLE"),
    TransactionType.FEE_OFFSET: ("MGMT_FEE_PAYABLE", "FEE_OFFSET_INCOME"),
    TransactionType.EXPENSE: ("FUND_EXPENSE", "CASH"),
    TransactionType.REALISED_GAIN: ("INVESTMENTS", "REALISED_PNL"),
    TransactionType.REALISED_LOSS: ("REALISED_PNL", "INVESTMENTS"),
    TransactionType.UNREALISED_PNL: ("INVESTMENTS", "UNREALISED_PNL"),
    TransactionType.PORTFOLIO_CASH_IN: ("CASH", "INVESTMENTS"),
    TransactionType.PORTFOLIO_CASH_OUT: ("INVESTMENTS", "CASH"),
    TransactionType.NAV: ("NAV_CONTROL", "NAV_CONTROL"),
    TransactionType.JOURNAL: ("SUSPENSE", "SUSPENSE"),
}


def ensure_accounts(session: Session) -> dict[str, Account]:
    codes = sorted({code for pair in POSTING_RULES.values() for code in pair})
    existing = {a.code: a for a in session.query(Account).filter(Account.code.in_(codes)).all()}
    created = {}
    for code in codes:
        if code in existing:
            continue
        acct = Account(code=code, name=code.replace("_", " ").title(), account_type="GENERIC")
        session.add(acct)
        created[code] = acct
    session.flush()
    return {**existing, **created}


def _hash_payload(payload: list[dict]) -> str:
    canonical = json.dumps(payload, sort_keys=True, default=str).encode()
    return hashlib.sha256(canonical).hexdigest()


def import_transactions(
    session: Session,
    *,
    user: AuthUser,
    source_system: str,
    source_owner: str,
    mapping_version: str,
    records: list[dict],
    file_name: str | None = None,
) -> ImportResult:
    batch = ImportBatch(
        source_system=source_system,
        source_owner=source_owner,
        file_name=file_name,
        mapping_version=mapping_version,
        record_count=len(records),
        raw_payload=json.dumps(records, default=str),
        submitted_by_user_id=user.id,
        status="processing",
    )
    session.add(batch)
    session.flush()

    seen_refs: set[str] = set()
    transactions: list[Transaction] = []
    exceptions: list[ImportException] = []

    for row_no, record in enumerate(records, start=1):
        err = _validate_record(session, record, seen_refs)
        if err:
            exc = ImportException(
                batch_id=batch.id,
                row_number=row_no,
                code=err[0],
                message=err[1],
                source_payload=json.dumps(record, default=str),
            )
            session.add(exc)
            exceptions.append(exc)
            continue

        tx = Transaction(
            batch_id=batch.id,
            source_reference=record["source_reference"],
            entity_id=record["entity_id"],
            investor_id=record.get("investor_id"),
            capital_account_id=record.get("capital_account_id"),
            transaction_type=TransactionType(record["transaction_type"]),
            transaction_date=date.fromisoformat(str(record["transaction_date"])),
            amount=Decimal(str(record["amount"])),
            currency=record["currency"],
            description=record.get("description"),
            state=TransactionState.VALIDATED,
        )
        session.add(tx)
        transactions.append(tx)
        seen_refs.add(record["source_reference"])

    session.flush()
    batch.accepted_count = len(transactions)
    batch.rejected_count = len(exceptions)
    batch.status = "completed"

    for tx in transactions:
        lineage.record_edge(
            session,
            upstream_type="import_batch",
            upstream_id=batch.id,
            downstream_type="transaction",
            downstream_id=tx.id,
            relation="ingested",
        )

    audit.log_event(
        session,
        actor_user_id=user.id,
        action="transactions.import",
        object_type="import_batch",
        object_id=batch.id,
        after={"accepted": batch.accepted_count, "rejected": batch.rejected_count},
    )

    return ImportResult(
        batch_id=batch.id,
        accepted=len(transactions),
        rejected=len(exceptions),
        transaction_ids=[t.id for t in transactions],
        exception_ids=[e.id for e in exceptions],
    )


def _validate_record(session: Session, record: dict, seen_refs: set[str]) -> tuple[str, str] | None:
    required = ["source_reference", "entity_id", "transaction_type", "transaction_date", "amount", "currency"]
    for field in required:
        if record.get(field) in (None, ""):
            return ("MISSING_FIELD", f"missing required field: {field}")

    if record["source_reference"] in seen_refs:
        return ("DUPLICATE_REF", f"duplicate source_reference: {record['source_reference']}")

    existing = session.query(Transaction).filter(
        Transaction.source_reference == record["source_reference"]
    ).first()
    if existing:
        return ("DUPLICATE_REF", f"source_reference already imported: {record['source_reference']}")

    try:
        TransactionType(record["transaction_type"])
    except ValueError:
        return ("INVALID_TYPE", f"unknown transaction_type: {record['transaction_type']}")

    entity = session.get(Entity, record["entity_id"])
    if not entity:
        return ("UNKNOWN_ENTITY", f"entity {record['entity_id']} not found")

    try:
        amount = Decimal(str(record["amount"]))
    except Exception:
        return ("INVALID_AMOUNT", f"amount not numeric: {record['amount']}")
    if amount == 0:
        return ("ZERO_AMOUNT", "amount must be non-zero")

    if record.get("investor_id"):
        if not session.get(Investor, record["investor_id"]):
            return ("UNKNOWN_INVESTOR", f"investor {record['investor_id']} not found")

    if record.get("capital_account_id"):
        if not session.get(CapitalAccount, record["capital_account_id"]):
            return ("UNKNOWN_CAPITAL_ACCOUNT", f"capital account {record['capital_account_id']} not found")

    try:
        date.fromisoformat(str(record["transaction_date"]))
    except Exception:
        return ("INVALID_DATE", f"transaction_date not ISO-8601: {record['transaction_date']}")

    return None


def approve_transaction(session: Session, user: AuthUser, tx_id: int) -> Transaction:
    if not user.has_permission(Permission.APPROVE):
        raise PermissionError("approve permission required")
    tx = session.get(Transaction, tx_id)
    if not tx:
        raise ValueError(f"transaction {tx_id} not found")
    if tx.state != TransactionState.VALIDATED:
        raise ValueError(f"cannot approve transaction in state {tx.state}")
    if tx.batch.submitted_by_user_id == user.id:
        from app.core.config import get_settings
        if not get_settings().allow_self_approval:
            raise PermissionError("maker cannot approve own transaction")
    tx.state = TransactionState.APPROVED
    tx.approved_by_user_id = user.id
    audit.log_event(
        session, actor_user_id=user.id, action="transaction.approve",
        object_type="transaction", object_id=tx.id,
        after={"state": tx.state},
    )
    return tx


def post_transaction(session: Session, user: AuthUser, tx_id: int) -> JournalEntry:
    if not user.has_permission(Permission.POST):
        raise PermissionError("post permission required")
    tx = session.get(Transaction, tx_id)
    if not tx:
        raise ValueError(f"transaction {tx_id} not found")
    if tx.state != TransactionState.APPROVED:
        raise ValueError(f"cannot post transaction in state {tx.state}")

    period = _resolve_or_create_period(session, tx.entity_id, tx.transaction_date)
    if not period.allows_posting():
        raise ValueError(f"period {period.period_start}..{period.period_end} does not allow posting")

    accounts = ensure_accounts(session)
    debit_code, credit_code = POSTING_RULES[tx.transaction_type]

    entry = JournalEntry(
        entity_id=tx.entity_id,
        period_id=period.id,
        entry_date=tx.transaction_date,
        description=tx.description or f"{tx.transaction_type} {tx.source_reference}",
        source_transaction_id=tx.id,
        rule_version=RULE_VERSION,
        posted_by_user_id=user.id,
    )
    session.add(entry)
    session.flush()

    entry.lines.append(
        JournalLine(
            entry_id=entry.id,
            account_id=accounts[debit_code].id,
            capital_account_id=tx.capital_account_id,
            debit=tx.amount,
            credit=Decimal("0"),
            currency=tx.currency,
        )
    )
    entry.lines.append(
        JournalLine(
            entry_id=entry.id,
            account_id=accounts[credit_code].id,
            capital_account_id=tx.capital_account_id,
            debit=Decimal("0"),
            credit=tx.amount,
            currency=tx.currency,
        )
    )

    tx.state = TransactionState.POSTED
    tx.posted_by_user_id = user.id

    _apply_capital_account_impact(session, tx)

    lineage.record_edge(
        session,
        upstream_type="transaction",
        upstream_id=tx.id,
        downstream_type="journal_entry",
        downstream_id=entry.id,
        relation="posted",
        metadata={"rule_version": RULE_VERSION},
    )
    audit.log_event(
        session, actor_user_id=user.id, action="transaction.post",
        object_type="transaction", object_id=tx.id,
        after={"state": tx.state, "journal_entry_id": entry.id},
    )
    session.flush()
    return entry


def _resolve_or_create_period(session: Session, entity_id: int, tx_date: date) -> AccountingPeriod:
    from app.models.period import PeriodStatus, PeriodType

    period = (
        session.query(AccountingPeriod)
        .filter(
            AccountingPeriod.entity_id == entity_id,
            AccountingPeriod.period_type == PeriodType.MONTHLY,
            AccountingPeriod.period_start <= tx_date,
            AccountingPeriod.period_end >= tx_date,
        )
        .first()
    )
    if period:
        return period
    # auto-create a monthly period in OPEN state for the transaction's month
    first = tx_date.replace(day=1)
    if first.month == 12:
        nxt = date(first.year + 1, 1, 1)
    else:
        nxt = date(first.year, first.month + 1, 1)
    last = date(nxt.year, nxt.month, 1)
    from datetime import timedelta

    last = last - timedelta(days=1)
    period = AccountingPeriod(
        entity_id=entity_id,
        period_type=PeriodType.MONTHLY,
        period_start=first,
        period_end=last,
        status=PeriodStatus.OPEN,
    )
    session.add(period)
    session.flush()
    return period


def _apply_capital_account_impact(session: Session, tx: Transaction) -> None:
    if tx.capital_account_id is None:
        return
    ca = session.get(CapitalAccount, tx.capital_account_id)
    if not ca:
        return
    if tx.transaction_type in (TransactionType.CONTRIBUTION, TransactionType.CAPITAL_CALL):
        ca.contributed += tx.amount
    elif tx.transaction_type == TransactionType.DISTRIBUTION:
        ca.distributed += tx.amount
    elif tx.transaction_type == TransactionType.RECALL:
        ca.recallable += tx.amount
    elif tx.transaction_type in (TransactionType.REALISED_GAIN, TransactionType.UNREALISED_PNL):
        ca.allocated_pnl += tx.amount
    elif tx.transaction_type == TransactionType.REALISED_LOSS:
        ca.allocated_pnl -= tx.amount
