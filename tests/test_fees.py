from datetime import date
from decimal import Decimal

import pytest

from app.core.security import AuthUser, Role
from app.models.entity import Entity, EntityType
from app.models.fee import FeeBasis, FeeSchedule
from app.models.investor import Commitment, Investor
from app.models.user import User
from app.models.workflow import WorkflowState
from app.services import fees


@pytest.fixture
def fund(session):
    entity = Entity(
        code="PE-I", legal_name="Fund", short_name="F",
        entity_type=EntityType.FUND, jurisdiction="DE",
        base_currency="USD", reporting_currency="USD",
    )
    session.add(entity)
    session.flush()
    investor = Investor(code="INV-1", legal_name="LP", short_name="LP", domicile="US")
    session.add(investor)
    session.flush()
    commitment = Commitment(
        investor_id=investor.id, entity_id=entity.id, closing_id="C1",
        closing_date=date(2024, 1, 1), investor_class="A",
        commitment_amount=Decimal("100000000"), currency="USD",
    )
    session.add(commitment)

    user = User(username="u", display_name="u", email="u@example.com")
    user.set_roles(["fund_accountant"])
    session.add(user)

    schedule = FeeSchedule(
        entity_id=entity.id, name="Mgmt Fee 2%",
        basis=FeeBasis.COMMITMENT, annual_rate_bps=200,
        effective_from=date(2024, 1, 1),
        state=WorkflowState.APPROVED,
    )
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    session.refresh(entity)
    session.refresh(user)
    return entity, user, schedule


def test_fee_accrual_uses_basis_and_rate(session, fund):
    entity, user, schedule = fund
    auth = AuthUser(id=user.id, username=user.username, roles={Role.FUND_ACCOUNTANT}, fund_scope=None)

    run = fees.run_fees(
        session, auth,
        fees.FeeRunRequest(
            entity_id=entity.id,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 3, 31),
        ),
    )
    session.commit()
    session.refresh(run)
    assert len(run.accruals) == 1
    accrual = run.accruals[0]
    assert accrual.basis_amount == Decimal("100000000")
    assert accrual.applied_rate_bps == 200
    # 2% annualised over ~91/366 days on $100M ≈ $497,267.76 (2024 is a leap year)
    assert Decimal("490000") < accrual.gross_fee < Decimal("505000")
    assert accrual.net_fee == accrual.gross_fee
    assert run.input_snapshot_hash


def test_fee_run_fails_without_approved_schedule(session, fund):
    entity, user, schedule = fund
    schedule.state = WorkflowState.DRAFT
    session.commit()
    auth = AuthUser(id=user.id, username=user.username, roles={Role.FUND_ACCOUNTANT}, fund_scope=None)

    with pytest.raises(ValueError, match="no approved fee schedule"):
        fees.run_fees(
            session, auth,
            fees.FeeRunRequest(entity_id=entity.id, period_start=date(2024, 1, 1), period_end=date(2024, 3, 31)),
        )


def test_fee_run_is_reproducible(session, fund):
    entity, user, schedule = fund
    auth = AuthUser(id=user.id, username=user.username, roles={Role.FUND_ACCOUNTANT}, fund_scope=None)

    r1 = fees.run_fees(session, auth, fees.FeeRunRequest(entity_id=entity.id, period_start=date(2024, 1, 1), period_end=date(2024, 3, 31)))
    r2 = fees.run_fees(session, auth, fees.FeeRunRequest(entity_id=entity.id, period_start=date(2024, 1, 1), period_end=date(2024, 3, 31)))
    # Same inputs → identical snapshot hash
    assert r1.input_snapshot_hash == r2.input_snapshot_hash
