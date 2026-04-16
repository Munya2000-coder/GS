"""API-level flows for Fees schedules/runs and Waterfall models/runs."""

from tests.conftest import auth_headers


def _bootstrap(client):
    client.post(
        "/entities", headers=auth_headers("admin"),
        json={
            "code": "PE-A", "legal_name": "Fund A", "short_name": "A",
            "entity_type": "fund", "jurisdiction": "DE",
            "base_currency": "USD", "reporting_currency": "USD",
        },
    )
    fund_id = client.get("/entities", headers=auth_headers("alice")).json()[0]["id"]

    for code, amt in [("I1", "50000000"), ("I2", "50000000")]:
        client.post("/investors", headers=auth_headers("admin"),
                    json={"code": code, "legal_name": code, "short_name": code, "domicile": "US"})
    investors = client.get("/investors", headers=auth_headers("alice")).json()
    for inv in investors:
        client.post("/investors/commitments", headers=auth_headers("admin"),
                    json={
                        "investor_id": inv["id"], "entity_id": fund_id, "closing_id": "C1",
                        "closing_date": "2022-01-01", "investor_class": "A",
                        "commitment_amount": "50000000", "currency": "USD",
                    })
        client.post("/investors/capital-accounts", headers=auth_headers("admin"),
                    json={
                        "code": f"CA-{inv['code']}",
                        "investor_id": inv["id"], "entity_id": fund_id, "investor_class": "A",
                    })
    return fund_id


def test_fee_schedule_and_run_end_to_end(client):
    fund_id = _bootstrap(client)

    # alice creates, bob approves (maker-checker)
    r = client.post(
        "/fees/schedules", headers=auth_headers("alice"),
        json={
            "entity_id": fund_id, "name": "Mgmt 2%",
            "basis": "commitment", "annual_rate_bps": 200,
            "periodicity": "quarterly",
            "effective_from": "2022-01-01",
            "offsets_enabled": False,
        },
    )
    assert r.status_code == 201, r.text
    schedule_id = r.json()["id"]

    r = client.post(f"/fees/schedules/{schedule_id}/approve", headers=auth_headers("bob"))
    assert r.status_code == 200, r.text
    assert r.json()["state"] == "approved"

    r = client.post(
        "/fees/run", headers=auth_headers("alice"),
        json={
            "entity_id": fund_id,
            "period_start": "2024-01-01",
            "period_end": "2024-03-31",
        },
    )
    assert r.status_code == 201, r.text
    run = r.json()
    assert run["input_snapshot_hash"]
    assert len(run["accruals"]) == 1
    assert run["accruals"][0]["applied_rate_bps"] == 200


def test_waterfall_model_create_approve_run(client):
    fund_id = _bootstrap(client)

    r = client.post(
        "/waterfall/models", headers=auth_headers("alice"),
        json={
            "entity_id": fund_id, "name": "8/20",
            "method": "european",
            "preferred_return_bps": 800,
            "catchup_percentage_bps": 10000,
            "carried_interest_bps": 2000,
            "gp_catchup_share_bps": 10000,
            "hurdle_compounding": "annual",
            "effective_from": "2022-01-01",
        },
    )
    assert r.status_code == 201, r.text
    model_id = r.json()["id"]

    r = client.post(f"/waterfall/models/{model_id}/approve", headers=auth_headers("bob"))
    assert r.status_code == 200

    r = client.post(
        "/waterfall/run", headers=auth_headers("alice"),
        json={"model_id": model_id, "as_of": "2026-01-01"},
    )
    assert r.status_code == 201, r.text
    run = r.json()
    assert run["tiers"]
    assert run["input_snapshot_hash"]


def test_nav_publish_and_list(client):
    fund_id = _bootstrap(client)

    r = client.post(
        "/nav", headers=auth_headers("alice"),
        json={
            "entity_id": fund_id,
            "as_of": "2025-12-31",
            "gross_asset_value": "75000000",
            "liabilities": "500000",
            "currency": "USD",
            "source_reference": "Q4-2025",
        },
    )
    assert r.status_code == 201, r.text
    assert float(r.json()["ending_nav"]) == 74_500_000

    r = client.get("/nav", params={"entity_id": fund_id}, headers=auth_headers("alice"))
    assert r.status_code == 200
    assert len(r.json()) == 1
