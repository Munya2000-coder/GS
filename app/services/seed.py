"""Seed demo data: users, fund, investors, commitments, capital accounts,
approved fee schedule & waterfall model, and a realistic transaction history
so the UI and reports have something to show."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.security import AuthUser, Role
from app.models.capital_account import CapitalAccount
from app.models.entity import Entity, EntityStatus, EntityType
from app.models.fee import FeeBasis, FeeSchedule
from app.models.investor import Commitment, Investor, InvestorStatus
from app.models.user import User
from app.models.waterfall import WaterfallMethod, WaterfallModel
from app.models.workflow import WorkflowState
from app.services import accounting, capital_calls, distributions, nav


def seed(session: Session) -> dict[str, int]:
    """Populate a deterministic demo dataset. Safe to run multiple times — if
    the primary fund already exists the function becomes a no-op."""
    if session.query(Entity).filter(Entity.code == "PE-I").first():
        return {"skipped": 1}

    admin = _ensure_user(session, "admin", ["sys_admin", "fund_controller", "fund_accountant"])
    alice = _ensure_user(session, "alice", ["fund_accountant", "ops_analyst"])
    bob = _ensure_user(session, "bob", ["fund_controller"])
    charlie = _ensure_user(session, "charlie", ["investor_relations"])
    session.commit()

    auth_admin = _auth(admin)
    auth_bob = _auth(bob)

    fund = Entity(
        code="PE-I", legal_name="GS Private Equity Fund I LP", short_name="PE I",
        entity_type=EntityType.FUND, jurisdiction="DE",
        vintage_year=2022, strategy="Mid-market buyout",
        base_currency="USD", reporting_currency="USD",
        status=EntityStatus.ACTIVE,
    )
    session.add(fund)
    session.flush()

    investors_data = [
        ("PEN-001", "State Pension Fund A", "US", Decimal("25000000")),
        ("END-002", "University Endowment B", "US", Decimal("10000000")),
        ("SWF-003", "Sovereign Wealth Fund C", "SG", Decimal("40000000")),
        ("FOF-004", "Fund of Funds D", "LU", Decimal("15000000")),
        ("FAM-005", "Family Office E", "CH", Decimal("10000000")),
    ]
    investors: list[Investor] = []
    for code, name, dom, commit_amt in investors_data:
        inv = Investor(
            code=code, legal_name=name, short_name=name.split()[0],
            domicile=dom, tax_classification="exempt" if "Pension" in name else "taxable",
            status=InvestorStatus.ACTIVE,
            side_letter=(code == "SWF-003"),
        )
        session.add(inv)
        session.flush()
        investors.append(inv)

        session.add(Commitment(
            investor_id=inv.id, entity_id=fund.id, closing_id="C1",
            closing_date=date(2022, 3, 15), investor_class="A",
            commitment_amount=commit_amt, currency="USD",
        ))
        session.add(CapitalAccount(
            code=f"CA-{fund.code}-{inv.code}",
            investor_id=inv.id, entity_id=fund.id,
            investor_class="A", carry_participant=False,
        ))

    fee_schedule = FeeSchedule(
        entity_id=fund.id, name="Management Fee 2%",
        basis=FeeBasis.COMMITMENT, annual_rate_bps=200,
        periodicity="quarterly",
        effective_from=date(2022, 3, 15),
        state=WorkflowState.APPROVED,
        approved_by_user_id=bob.id,
    )
    session.add(fee_schedule)

    waterfall = WaterfallModel(
        entity_id=fund.id, name="8/20 European",
        method=WaterfallMethod.EUROPEAN,
        preferred_return_bps=800, catchup_percentage_bps=10000,
        carried_interest_bps=2000, hurdle_compounding="annual",
        effective_from=date(2022, 3, 15),
        tiers_json="[]",
        state=WorkflowState.APPROVED,
        approved_by_user_id=bob.id,
    )
    session.add(waterfall)
    session.commit()

    # Capital calls
    call1 = capital_calls.generate_capital_call(
        session, user=auth_admin,
        entity_id=fund.id, call_number="CC-001",
        notice_date=date(2022, 6, 1), due_date=date(2022, 6, 30),
        total_amount=Decimal("30000000"), currency="USD",
    )
    session.commit()
    capital_calls.approve_capital_call(session, auth_bob, call1.id)
    txs = capital_calls.record_funding(session, user=auth_bob, call_id=call1.id)
    for tx in txs:
        accounting.post_transaction(session, auth_bob, tx.id)
    session.commit()

    call2 = capital_calls.generate_capital_call(
        session, user=auth_admin,
        entity_id=fund.id, call_number="CC-002",
        notice_date=date(2023, 3, 1), due_date=date(2023, 3, 31),
        total_amount=Decimal("25000000"), currency="USD",
    )
    session.commit()
    capital_calls.approve_capital_call(session, auth_bob, call2.id)
    txs = capital_calls.record_funding(session, user=auth_bob, call_id=call2.id)
    for tx in txs:
        accounting.post_transaction(session, auth_bob, tx.id)
    session.commit()

    # Distribution
    dist1 = distributions.generate_distribution(
        session, user=auth_admin,
        entity_id=fund.id, distribution_number="DIST-001",
        notice_date=date(2025, 6, 1), payment_date=date(2025, 6, 30),
        total_amount=Decimal("15000000"), currency="USD",
    )
    session.commit()
    distributions.approve_distribution(session, auth_bob, dist1.id)
    pay_txs = distributions.record_payout(session, user=auth_bob, dist_id=dist1.id)
    for tx in pay_txs:
        accounting.post_transaction(session, auth_bob, tx.id)
    session.commit()

    # NAV
    nav.publish_nav(
        session, user=auth_admin, entity_id=fund.id,
        as_of=date(2025, 12, 31),
        gross_asset_value=Decimal("75000000"),
        liabilities=Decimal("500000"),
        currency="USD",
        source_reference="Q4-2025 valuation",
    )
    session.commit()

    return {
        "fund_id": fund.id,
        "investors": len(investors),
        "users": 4,
        "capital_calls": 2,
        "distributions": 1,
    }


def _ensure_user(session: Session, username: str, roles: list[str]) -> User:
    existing = session.query(User).filter(User.username == username).one_or_none()
    if existing:
        return existing
    user = User(
        username=username,
        display_name=username.title(),
        email=f"{username}@example.com",
    )
    user.set_roles(roles)
    session.add(user)
    session.flush()
    return user


def _auth(user: User) -> AuthUser:
    return AuthUser(
        id=user.id, username=user.username,
        roles={Role(r) for r in user.roles_list()},
        fund_scope=None,
    )
