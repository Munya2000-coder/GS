from tests.conftest import auth_headers


def test_period_lifecycle_and_reopen(client):
    # Setup
    client.post(
        "/entities", headers=auth_headers("admin"),
        json={
            "code": "PE", "legal_name": "F", "short_name": "F",
            "entity_type": "fund", "jurisdiction": "DE",
            "base_currency": "USD", "reporting_currency": "USD",
        },
    )
    fund_id = client.get("/entities", headers=auth_headers("alice")).json()[0]["id"]

    r = client.post(
        "/periods", headers=auth_headers("alice"),
        json={"entity_id": fund_id, "period_type": "monthly", "any_date": "2024-06-15"},
    )
    assert r.status_code == 201
    period = r.json()
    assert period["status"] == "open"
    assert period["period_start"] == "2024-06-01"

    # Soft close then hard close (bob is controller)
    r = client.post(f"/periods/{period['id']}/soft-close", headers=auth_headers("bob"))
    assert r.status_code == 200
    assert r.json()["status"] == "soft_close"

    r = client.post(f"/periods/{period['id']}/close", headers=auth_headers("bob"))
    assert r.status_code == 200
    assert r.json()["status"] == "closed"

    # Reopen requires reason
    r = client.post(
        f"/periods/{period['id']}/reopen",
        headers=auth_headers("bob"),
        json={"reason": "late adjusting journal"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "reopened"
    assert r.json()["reopen_reason"] == "late adjusting journal"


def test_close_step_dependency_blocks_sign_off(client):
    client.post(
        "/entities", headers=auth_headers("admin"),
        json={
            "code": "PE", "legal_name": "F", "short_name": "F",
            "entity_type": "fund", "jurisdiction": "DE",
            "base_currency": "USD", "reporting_currency": "USD",
        },
    )
    fund_id = client.get("/entities", headers=auth_headers("alice")).json()[0]["id"]
    r = client.post(
        "/periods", headers=auth_headers("alice"),
        json={"entity_id": fund_id, "period_type": "monthly", "any_date": "2024-06-15"},
    )
    period_id = r.json()["id"]

    s1 = client.post(
        f"/periods/{period_id}/steps", headers=auth_headers("alice"),
        json={"name": "Recon NAV"},
    ).json()
    s2 = client.post(
        f"/periods/{period_id}/steps", headers=auth_headers("alice"),
        json={"name": "Publish statements", "depends_on_step_id": s1["id"]},
    ).json()

    r = client.post(f"/periods/steps/{s2['id']}/sign-off", headers=auth_headers("bob"))
    assert r.status_code == 400
    assert "dependency" in r.json()["detail"].lower()

    r = client.post(f"/periods/steps/{s1['id']}/sign-off", headers=auth_headers("bob"))
    assert r.status_code == 200
    r = client.post(f"/periods/steps/{s2['id']}/sign-off", headers=auth_headers("bob"))
    assert r.status_code == 200


def test_nav_publish_updates_capital_accounts(client):
    client.post(
        "/entities", headers=auth_headers("admin"),
        json={
            "code": "PE", "legal_name": "F", "short_name": "F",
            "entity_type": "fund", "jurisdiction": "DE",
            "base_currency": "USD", "reporting_currency": "USD",
        },
    )
    fund_id = client.get("/entities", headers=auth_headers("alice")).json()[0]["id"]

    client.post(
        "/investors", headers=auth_headers("admin"),
        json={"code": "I1", "legal_name": "LP1", "short_name": "LP1", "domicile": "US"},
    )
    inv_id = client.get("/investors", headers=auth_headers("alice")).json()[0]["id"]

    ca = client.post(
        "/investors/capital-accounts", headers=auth_headers("admin"),
        json={
            "code": "CA1", "investor_id": inv_id, "entity_id": fund_id, "investor_class": "A",
        },
    ).json()
    # Seed contributed so NAV allocation has a denominator
    from app.core.database import SessionLocal
    from app.models.capital_account import CapitalAccount
    from decimal import Decimal
    with SessionLocal() as s:
        c = s.get(CapitalAccount, ca["id"])
        c.contributed = Decimal("1000000")
        s.commit()

    r = client.post(
        "/nav", headers=auth_headers("alice"),
        json={
            "entity_id": fund_id, "as_of": "2024-12-31",
            "gross_asset_value": "1500000", "liabilities": "0",
            "currency": "USD",
        },
    )
    assert r.status_code == 201, r.text
    assert float(r.json()["ending_nav"]) == 1_500_000.00

    r = client.get("/nav", params={"entity_id": fund_id}, headers=auth_headers("alice"))
    assert r.status_code == 200
    assert len(r.json()) == 1
