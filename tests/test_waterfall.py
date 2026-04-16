from datetime import date
from decimal import Decimal

import pytest

from app.core.security import AuthUser, Role
from app.models.entity import Entity, EntityType
from app.models.transaction import ImportBatch, Transaction, TransactionState, TransactionType
from app.models.user import User
from app.models.waterfall import WaterfallMethod, WaterfallModel
from app.models.workflow import WorkflowState
from app.services import waterfall


@pytest.fixture
def setup_fund(session):
    entity = Entity(
        code="PE-I", legal_name="Fund", short_name="F",
        entity_type=EntityType.FUND, jurisdiction="DE",
        base_currency="USD", reporting_currency="USD",
    )
    session.add(entity)
    user = User(username="u", display_name="u", email="u@example.com")
    user.set_roles(["fund_accountant"])
    session.add(user)
    session.flush()

    batch = ImportBatch(
        source_system="test", source_owner="test", mapping_version="v1",
        record_count=0, raw_payload="[]", submitted_by_user_id=user.id, status="done",
    )
    session.add(batch)
    session.flush()

    # $100M contributed, $180M realised proceeds, zero unrealised
    for i, (d, amt, ttype) in enumerate([
        (date(2022, 1, 1), Decimal("100000000"), TransactionType.CONTRIBUTION),
        (date(2026, 1, 1), Decimal("180000000"), TransactionType.PORTFOLIO_CASH_IN),
    ]):
        t = Transaction(
            batch_id=batch.id, source_reference=f"REF-{i}", entity_id=entity.id,
            transaction_type=ttype, transaction_date=d, amount=amt, currency="USD",
            state=TransactionState.POSTED,
        )
        session.add(t)
    session.commit()
    session.refresh(entity)
    session.refresh(user)
    return entity, user


def test_european_waterfall_produces_four_tiers(session, setup_fund):
    entity, user = setup_fund
    model = WaterfallModel(
        entity_id=entity.id, name="Standard",
        method=WaterfallMethod.EUROPEAN,
        preferred_return_bps=800, catchup_percentage_bps=10000,
        carried_interest_bps=2000, hurdle_compounding="annual",
        effective_from=date(2022, 1, 1),
        tiers_json="[]",
        state=WorkflowState.APPROVED,
    )
    session.add(model)
    session.commit()
    session.refresh(model)

    auth = AuthUser(id=user.id, username=user.username, roles={Role.FUND_ACCOUNTANT, Role.FUND_CONTROLLER}, fund_scope=None)
    run = waterfall.run_waterfall(session, user=auth, model_id=model.id, as_of=date(2026, 1, 1))
    session.commit()
    session.refresh(run)

    assert len(run.tiers) == 4
    tiers = {t.tier_name: t for t in run.tiers}
    assert tiers["Return of Capital"].lp_amount == Decimal("100000000.00")
    assert tiers["Preferred Return"].lp_amount > 0
    assert tiers["GP Catch-up"].gp_amount > 0
    assert tiers["Carried Interest"].gp_amount > 0

    lp_total = sum((t.lp_amount for t in run.tiers), Decimal("0"))
    gp_total = sum((t.gp_amount for t in run.tiers), Decimal("0"))
    assert abs((lp_total + gp_total) - Decimal("180000000")) < Decimal("10")


def test_waterfall_requires_approved_model_for_production_run(session, setup_fund):
    entity, user = setup_fund
    model = WaterfallModel(
        entity_id=entity.id, name="Draft",
        method=WaterfallMethod.EUROPEAN,
        effective_from=date(2022, 1, 1), tiers_json="[]",
        state=WorkflowState.DRAFT,
    )
    session.add(model)
    session.commit()
    session.refresh(model)

    auth = AuthUser(id=user.id, username=user.username, roles={Role.FUND_ACCOUNTANT}, fund_scope=None)
    with pytest.raises(ValueError, match="approved"):
        waterfall.run_waterfall(session, user=auth, model_id=model.id, as_of=date(2026, 1, 1))

    # but a scenario run is permitted
    run = waterfall.run_waterfall(
        session, user=auth, model_id=model.id, as_of=date(2026, 1, 1),
        scenario_label="upside", is_scenario=True,
    )
    assert run.is_scenario
    assert run.scenario_label == "upside"


def test_american_waterfall_excludes_unrealised(session, setup_fund):
    entity, user = setup_fund
    model = WaterfallModel(
        entity_id=entity.id, name="Deal by Deal",
        method=WaterfallMethod.AMERICAN,
        preferred_return_bps=800, catchup_percentage_bps=10000,
        carried_interest_bps=2000, hurdle_compounding="annual",
        effective_from=date(2022, 1, 1), tiers_json="[]",
        state=WorkflowState.APPROVED,
    )
    session.add(model)
    session.commit()
    session.refresh(model)

    auth = AuthUser(id=user.id, username=user.username, roles={Role.FUND_ACCOUNTANT}, fund_scope=None)
    run = waterfall.run_waterfall(session, user=auth, model_id=model.id, as_of=date(2026, 1, 1))
    lp_total = sum((t.lp_amount for t in run.tiers), Decimal("0"))
    gp_total = sum((t.gp_amount for t in run.tiers), Decimal("0"))
    # American method uses realised proceeds = 180M
    assert abs((lp_total + gp_total) - Decimal("180000000")) < Decimal("10")
