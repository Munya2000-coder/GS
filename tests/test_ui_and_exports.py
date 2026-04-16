from tests.conftest import auth_headers


def test_login_then_dashboards_render(client):
    r = client.get("/ui/login")
    assert r.status_code == 200
    assert "Sign in" in r.text

    r = client.post("/ui/login", data={"username": "admin"}, follow_redirects=False)
    assert r.status_code == 302
    assert r.cookies.get("gs_user") == "admin"

    r = client.get("/ui/", cookies={"gs_user": "admin"})
    assert r.status_code == 200
    assert "Platform Overview" in r.text

    r = client.get("/ui/funds", cookies={"gs_user": "admin"})
    assert r.status_code == 200

    r = client.get("/ui/investors", cookies={"gs_user": "admin"})
    assert r.status_code == 200

    r = client.get("/ui/operations", cookies={"gs_user": "admin"})
    assert r.status_code == 200


def test_ui_redirects_when_not_signed_in(client):
    r = client.get("/ui/", follow_redirects=False)
    assert r.status_code in (302, 307)
    assert "/ui/login" in r.headers.get("location", "")


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
