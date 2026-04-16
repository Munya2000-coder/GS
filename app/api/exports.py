from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.capital_account import CapitalAccount
from app.models.investor import Investor
from app.models.journal import Account, JournalEntry, JournalLine
from app.models.transaction import Transaction
from app.services import audit
from app.services.exports import to_csv
from app.services.reporting import (
    capital_account_statement,
    fee_accrual_report,
    trial_balance,
    waterfall_summary,
)

router = APIRouter(prefix="/exports", tags=["exports"])


def _csv_response(body: str, filename: str) -> Response:
    return Response(
        content=body,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/transactions.csv")
def export_transactions(
    entity_id: int | None = None,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.EXPORT)),
):
    q = session.query(Transaction)
    if entity_id is not None:
        q = q.filter(Transaction.entity_id == entity_id)
    rows = [
        [t.id, t.source_reference, t.entity_id, t.investor_id, t.capital_account_id,
         t.transaction_type, str(t.transaction_date), str(t.amount), t.currency,
         t.state, t.description or ""]
        for t in q.order_by(Transaction.transaction_date).all()
    ]
    body = to_csv(
        ["id", "source_reference", "entity_id", "investor_id", "capital_account_id",
         "transaction_type", "transaction_date", "amount", "currency", "state", "description"],
        rows,
    )
    audit.log_event(
        session, actor_user_id=user.id, action="export.transactions",
        object_type="export", object_id="transactions.csv", after={"rows": len(rows)},
    )
    session.commit()
    return _csv_response(body, "transactions.csv")


@router.get("/trial-balance.csv")
def export_trial_balance(
    entity_id: int,
    as_of: date,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.EXPORT)),
):
    data = trial_balance(session, entity_id, as_of)
    rows = [[r["account_code"], r["account_name"], r["debit"], r["credit"], r["net"]] for r in data["rows"]]
    body = to_csv(["account_code", "account_name", "debit", "credit", "net"], rows)
    audit.log_event(
        session, actor_user_id=user.id, action="export.trial_balance",
        object_type="export", object_id="trial-balance.csv",
        after={"entity_id": entity_id, "as_of": str(as_of)},
    )
    session.commit()
    return _csv_response(body, f"trial-balance-{entity_id}-{as_of}.csv")


@router.get("/capital-accounts.csv")
def export_capital_accounts(
    entity_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.EXPORT)),
):
    rows = []
    for a in session.query(CapitalAccount).filter(CapitalAccount.entity_id == entity_id).all():
        inv = session.get(Investor, a.investor_id)
        rows.append([
            a.id, a.code, inv.code if inv else "", inv.legal_name if inv else "",
            a.investor_class, str(a.contributed), str(a.distributed),
            str(a.recallable), str(a.ending_nav), str(a.allocated_pnl),
        ])
    body = to_csv(
        ["id", "code", "investor_code", "investor_name", "class",
         "contributed", "distributed", "recallable", "ending_nav", "allocated_pnl"],
        rows,
    )
    audit.log_event(
        session, actor_user_id=user.id, action="export.capital_accounts",
        object_type="export", object_id="capital-accounts.csv",
        after={"entity_id": entity_id, "rows": len(rows)},
    )
    session.commit()
    return _csv_response(body, f"capital-accounts-{entity_id}.csv")


@router.get("/journal-entries.csv")
def export_journal(
    entity_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.EXPORT)),
):
    rows = []
    entries = session.query(JournalEntry).filter(JournalEntry.entity_id == entity_id).all()
    for e in entries:
        for line in e.lines:
            acct = session.get(Account, line.account_id)
            rows.append([
                e.id, str(e.entry_date), e.description, e.source_transaction_id,
                acct.code if acct else "", str(line.debit), str(line.credit), line.currency,
            ])
    body = to_csv(
        ["entry_id", "entry_date", "description", "source_transaction_id",
         "account_code", "debit", "credit", "currency"],
        rows,
    )
    audit.log_event(
        session, actor_user_id=user.id, action="export.journal",
        object_type="export", object_id="journal-entries.csv",
        after={"entity_id": entity_id, "rows": len(rows)},
    )
    session.commit()
    return _csv_response(body, f"journal-entries-{entity_id}.csv")
