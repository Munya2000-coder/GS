from datetime import date
from decimal import Decimal

from app.models.capital_account import CapitalAccount
from app.models.entity import Entity, EntityType
from app.models.investor import Commitment, Investor
from app.models.transaction import ImportBatch, Transaction, TransactionState, TransactionType
from app.models.user import User
from app.services.performance import compute_metrics, _xirr


def test_xirr_converges_on_simple_two_point_stream():
    # -100 at t0, +120 one year later ≈ 20% IRR
    flows = [(date(2024, 1, 1), Decimal("-100")), (date(2025, 1, 1), Decimal("120"))]
    irr = _xirr(flows)
    assert irr is not None
    assert Decimal("0.19") < irr < Decimal("0.21")


def _setup(session):
    entity = Entity(
        code="PE", legal_name="F", short_name="F",
        entity_type=EntityType.FUND, jurisdiction="DE",
        base_currency="USD", reporting_currency="USD",
    )
    session.add(entity)
    investor = Investor(code="L", legal_name="LP", short_name="LP", domicile="US")
    session.add(investor)
    user = User(username="u", display_name="u", email="u@example.com")
    user.set_roles(["fund_accountant"])
    session.add(user)
    session.flush()
    batch = ImportBatch(
        source_system="t", source_owner="t", mapping_version="v",
        record_count=0, raw_payload="[]", submitted_by_user_id=user.id, status="ok",
    )
    session.add(batch)
    session.flush()
    session.add(Commitment(
        investor_id=investor.id, entity_id=entity.id, closing_id="C1",
        closing_date=date(2024, 1, 1), investor_class="A",
        commitment_amount=Decimal("10000000"), currency="USD",
    ))
    ca = CapitalAccount(
        code="CA", investor_id=investor.id, entity_id=entity.id,
        investor_class="A", contributed=Decimal("5000000"),
        distributed=Decimal("2000000"), ending_nav=Decimal("4000000"),
    )
    session.add(ca)
    session.commit()
    for d, amt, tp in [
        (date(2024, 1, 1), Decimal("5000000"), TransactionType.CONTRIBUTION),
        (date(2025, 6, 30), Decimal("2000000"), TransactionType.DISTRIBUTION),
    ]:
        session.add(Transaction(
            batch_id=batch.id, source_reference=f"T{d}", entity_id=entity.id,
            investor_id=investor.id, capital_account_id=ca.id,
            transaction_type=tp, transaction_date=d, amount=amt,
            currency="USD", state=TransactionState.POSTED,
        ))
    session.commit()
    session.refresh(entity)
    return entity


def test_metrics_compute_tvpi_dpi_rvpi(session):
    entity = _setup(session)
    m = compute_metrics(session, entity_id=entity.id, as_of=date(2026, 1, 1))
    assert m.paid_in == Decimal("5000000")
    assert m.distributions == Decimal("2000000")
    assert m.nav == Decimal("4000000")
    # TVPI = (2M + 4M) / 5M = 1.2
    assert m.tvpi == Decimal("1.2000")
    # DPI = 2M / 5M = 0.4
    assert m.dpi == Decimal("0.4000")
    # RVPI = 4M / 5M = 0.8
    assert m.rvpi == Decimal("0.8000")
    # PIC = 5M / 10M = 0.5
    assert m.pic_ratio == Decimal("0.5000")
    # IRR should be positive given a gain
    assert m.irr is not None and m.irr > 0
