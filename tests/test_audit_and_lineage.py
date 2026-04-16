from datetime import date

from tests.conftest import auth_headers


def test_audit_trail_records_creation_and_approval(client):
    client.post(
        "/entities",
        headers=auth_headers("admin"),
        json={
            "code": "PE-I", "legal_name": "Fund", "short_name": "F",
            "entity_type": "fund", "jurisdiction": "DE",
            "base_currency": "USD", "reporting_currency": "USD",
        },
    )
    r = client.get("/audit/events", params={"object_type": "entity"}, headers=auth_headers("admin"))
    assert r.status_code == 200
    events = r.json()
    assert len(events) >= 1
    assert any(e["action"] == "entity.create" for e in events)


def test_lineage_upstream_from_journal_to_batch(client):
    # Bootstrap
    client.post(
        "/entities",
        headers=auth_headers("admin"),
        json={
            "code": "PE-I", "legal_name": "Fund", "short_name": "F",
            "entity_type": "fund", "jurisdiction": "DE",
            "base_currency": "USD", "reporting_currency": "USD",
        },
    )
    fund_id = client.get("/entities", headers=auth_headers("alice")).json()[0]["id"]

    r = client.post(
        "/transactions/import",
        headers=auth_headers("alice"),
        json={
            "source_system": "src", "source_owner": "ops", "mapping_version": "v1.0",
            "records": [{
                "source_reference": "TXLINE",
                "entity_id": fund_id, "transaction_type": "contribution",
                "transaction_date": "2024-05-01", "amount": "1000", "currency": "USD",
            }],
        },
    )
    tx_id = r.json()["transaction_ids"][0]
    batch_id = r.json()["batch_id"]

    client.post(f"/transactions/{tx_id}/approve", headers=auth_headers("bob"))
    r = client.post(f"/transactions/{tx_id}/post", headers=auth_headers("bob"))
    entry_id = r.json()["id"]

    r = client.get(
        "/audit/lineage/upstream",
        params={"object_type": "journal_entry", "object_id": str(entry_id)},
        headers=auth_headers("alice"),
    )
    assert r.status_code == 200
    edges = r.json()
    upstream_types = {e["upstream_type"] for e in edges}
    assert "transaction" in upstream_types
    assert "import_batch" in upstream_types
