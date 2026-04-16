"""Full ingestion → approve → post → report lineage."""

from tests.conftest import auth_headers


def _bootstrap(client):
    client.post(
        "/entities",
        headers=auth_headers("admin"),
        json={
            "code": "PE-I", "legal_name": "PE Fund I LP", "short_name": "PE I",
            "entity_type": "fund", "jurisdiction": "DE",
            "base_currency": "USD", "reporting_currency": "USD",
        },
    )
    fund_id = client.get("/entities", headers=auth_headers("alice")).json()[0]["id"]

    client.post(
        "/investors",
        headers=auth_headers("admin"),
        json={"code": "INV-001", "legal_name": "Alpha", "short_name": "Alpha", "domicile": "US"},
    )
    inv_id = client.get("/investors", headers=auth_headers("alice")).json() if False else None
    # list_investors isn't registered; fetch via session-less path
    from app.core.database import SessionLocal
    from app.models.investor import Investor
    with SessionLocal() as s:
        inv_id = s.query(Investor).first().id

    client.post(
        "/investors/commitments",
        headers=auth_headers("admin"),
        json={
            "investor_id": inv_id, "entity_id": fund_id,
            "closing_id": "C1", "closing_date": "2024-01-15",
            "investor_class": "A", "commitment_amount": "10000000.00", "currency": "USD",
        },
    )

    r = client.post(
        "/investors/capital-accounts",
        headers=auth_headers("admin"),
        json={
            "code": f"CA-{inv_id}-{fund_id}",
            "investor_id": inv_id, "entity_id": fund_id,
            "investor_class": "A", "carry_participant": False,
        },
    )
    assert r.status_code == 201, r.text
    ca_id = r.json()["id"]

    return fund_id, inv_id, ca_id


def test_import_and_post_builds_journal(client):
    fund_id, inv_id, ca_id = _bootstrap(client)

    payload = {
        "source_system": "accounting-legacy",
        "source_owner": "ops",
        "mapping_version": "v1.0",
        "records": [
            {
                "source_reference": "TX-001",
                "entity_id": fund_id,
                "investor_id": inv_id,
                "capital_account_id": ca_id,
                "transaction_type": "contribution",
                "transaction_date": "2024-03-31",
                "amount": "1000000.00",
                "currency": "USD",
                "description": "Initial contribution",
            },
            {
                "source_reference": "TX-002",
                "entity_id": fund_id,
                "investor_id": inv_id,
                "capital_account_id": ca_id,
                "transaction_type": "distribution",
                "transaction_date": "2024-09-30",
                "amount": "250000.00",
                "currency": "USD",
            },
            {
                # invalid: missing currency
                "source_reference": "TX-003",
                "entity_id": fund_id,
                "transaction_type": "contribution",
                "transaction_date": "2024-03-31",
                "amount": "500.00",
            },
        ],
    }

    r = client.post("/transactions/import", headers=auth_headers("alice"), json=payload)
    assert r.status_code == 201, r.text
    result = r.json()
    assert result["accepted"] == 2
    assert result["rejected"] == 1
    tx_ids = result["transaction_ids"]
    batch_id = result["batch_id"]

    # exceptions visible
    r = client.get(f"/transactions/batches/{batch_id}/exceptions", headers=auth_headers("alice"))
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["code"] == "MISSING_FIELD"

    # bob approves and posts (maker = alice; checker = bob)
    for tx in tx_ids:
        r = client.post(f"/transactions/{tx}/approve", headers=auth_headers("bob"))
        assert r.status_code == 200, r.text
        r = client.post(f"/transactions/{tx}/post", headers=auth_headers("bob"))
        assert r.status_code == 200, r.text
        entry = r.json()
        assert len(entry["lines"]) == 2
        assert sum(float(l["debit"]) for l in entry["lines"]) == sum(float(l["credit"]) for l in entry["lines"])

    # self-approval blocked
    r = client.post("/transactions/import", headers=auth_headers("bob"), json={
        "source_system": "x", "source_owner": "x", "mapping_version": "v1.0",
        "records": [{
            "source_reference": "TX-SELF", "entity_id": fund_id,
            "transaction_type": "contribution", "transaction_date": "2024-03-31",
            "amount": "100", "currency": "USD",
        }],
    })
    assert r.status_code == 201
    self_tx_id = r.json()["transaction_ids"][0]
    r = client.post(f"/transactions/{self_tx_id}/approve", headers=auth_headers("bob"))
    assert r.status_code == 400
    assert "maker cannot approve" in r.json()["detail"].lower()

    # capital account statement reflects posted activity
    r = client.get(
        "/reports/capital-account",
        params={"investor_id": inv_id, "entity_id": fund_id, "as_of": "2024-12-31"},
        headers=auth_headers("alice"),
    )
    assert r.status_code == 200, r.text
    stmt = r.json()
    assert float(stmt["contributed"]) == 1_000_000.00
    assert float(stmt["distributed"]) == 250_000.00
    assert len(stmt["transactions"]) == 2

    # trial balance has balanced debits/credits
    r = client.get(
        "/reports/trial-balance",
        params={"entity_id": fund_id, "as_of": "2024-12-31"},
        headers=auth_headers("alice"),
    )
    assert r.status_code == 200
    rows = r.json()["rows"]
    total_debit = sum(float(row["debit"]) for row in rows)
    total_credit = sum(float(row["credit"]) for row in rows)
    assert abs(total_debit - total_credit) < 0.01

    # lineage: transaction -> journal_entry
    r = client.get(
        "/audit/lineage/downstream",
        params={"object_type": "transaction", "object_id": str(tx_ids[0])},
        headers=auth_headers("alice"),
    )
    assert r.status_code == 200
    relations = {e["relation"] for e in r.json()}
    assert "posted" in relations
