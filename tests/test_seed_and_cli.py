from app.services import seed as seed_svc


def test_seed_creates_demo_data(session):
    result = seed_svc.seed(session)
    session.commit()
    assert "fund_id" in result
    assert result["investors"] == 5
    assert result["capital_calls"] == 2
    assert result["distributions"] == 1

    # Re-run is a no-op
    result2 = seed_svc.seed(session)
    assert result2 == {"skipped": 1}


def test_seed_populates_performance(session):
    seed_svc.seed(session)
    session.commit()
    from app.models.entity import Entity
    from app.services.performance import compute_metrics
    from datetime import date

    fund = session.query(Entity).filter(Entity.code == "PE-I").one()
    m = compute_metrics(session, entity_id=fund.id, as_of=date(2026, 1, 1))
    assert m.paid_in > 0
    assert m.distributions > 0
    assert m.nav > 0
