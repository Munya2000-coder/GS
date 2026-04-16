from tests.conftest import auth_headers


def test_root_redirects_to_spa(client):
    r = client.get("/", follow_redirects=False)
    assert r.status_code in (302, 307)
    assert r.headers["location"].startswith("/app")


def test_legacy_ui_paths_redirect_to_spa(client):
    for path in ["/ui", "/ui/", "/ui/login", "/ui/funds", "/ui/anything"]:
        r = client.get(path, follow_redirects=False)
        assert r.status_code in (302, 307), f"{path} did not redirect"
        assert r.headers["location"].startswith("/app")


def test_csv_export_of_transactions(client):
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
        "/transactions/import", headers=auth_headers("alice"),
        json={
            "source_system": "s", "source_owner": "o", "mapping_version": "v1",
            "records": [{
                "source_reference": "T1", "entity_id": fund_id,
                "transaction_type": "contribution", "transaction_date": "2024-01-01",
                "amount": "100", "currency": "USD",
            }],
        },
    )
    r = client.get("/exports/transactions.csv", headers=auth_headers("alice"))
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    lines = r.text.strip().splitlines()
    assert lines[0].startswith("id,source_reference,")
    assert "T1" in r.text
