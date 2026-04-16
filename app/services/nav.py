"""NAV snapshot management. Publishing a NAV updates the derived
`CapitalAccount.ending_nav` for reporting convenience."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.models.capital_account import CapitalAccount
from app.models.nav import NavSnapshot
from app.services import audit, lineage


def publish_nav(
    session: Session,
    *,
    user: AuthUser,
    entity_id: int,
    as_of: date,
    gross_asset_value: Decimal,
    liabilities: Decimal,
    currency: str,
    investor_id: int | None = None,
    capital_account_id: int | None = None,
    source_reference: str | None = None,
) -> NavSnapshot:
    ending = gross_asset_value - liabilities
    existing = session.query(NavSnapshot).filter(
        NavSnapshot.entity_id == entity_id,
        NavSnapshot.investor_id == investor_id,
        NavSnapshot.as_of == as_of,
    ).one_or_none()
    if existing:
        existing.gross_asset_value = gross_asset_value
        existing.liabilities = liabilities
        existing.ending_nav = ending
        existing.currency = currency
        existing.source_reference = source_reference
        existing.published_by_user_id = user.id
        snap = existing
    else:
        snap = NavSnapshot(
            entity_id=entity_id,
            investor_id=investor_id,
            capital_account_id=capital_account_id,
            as_of=as_of,
            gross_asset_value=gross_asset_value,
            liabilities=liabilities,
            ending_nav=ending,
            currency=currency,
            source_reference=source_reference,
            published_by_user_id=user.id,
        )
        session.add(snap)
    session.flush()

    if investor_id is not None:
        ca = session.query(CapitalAccount).filter(
            CapitalAccount.entity_id == entity_id,
            CapitalAccount.investor_id == investor_id,
        ).first()
        if ca:
            ca.ending_nav = ending
    else:
        accounts = session.query(CapitalAccount).filter(CapitalAccount.entity_id == entity_id).all()
        total_contrib = sum((a.contributed for a in accounts), Decimal("0")) or Decimal("1")
        for a in accounts:
            a.ending_nav = (a.contributed / total_contrib) * ending

    lineage.record_edge(
        session, upstream_type="nav_snapshot", upstream_id=snap.id,
        downstream_type="capital_account", downstream_id=entity_id,
        relation="updated_nav",
    )
    audit.log_event(
        session, actor_user_id=user.id, action="nav.publish",
        object_type="nav_snapshot", object_id=snap.id,
        after={"ending_nav": str(ending), "as_of": str(as_of)},
    )
    return snap
