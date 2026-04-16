from datetime import date
from decimal import Decimal

from tests.conftest import auth_headers


def _bootstrap_fund(client):
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

    inv_ids: list[int] = []
    for code, amt in [("INV-1", "20000000"), ("INV-2", "30000000")]:
        client.post(
            "/investors", headers=auth_headers("admin"),
            json={"code": code, "legal_name": code, "short_name": code, "domicile": "US"},
        )
        inv_id = [i["id"] for i in client.get("/investors", headers=auth_headers("alice")).json() if i["code"] == code][0]
        inv_ids.append(inv_id)
        client.post(
            "/investors/commitments", headers=auth_headers("admin"),
            json={
                "investor_id": inv_id, "entity_id": fund_id, "closing_id": "C1",
                "closing_date": "2024-01-01", "investor_class": "A",
                "commitment_amount": amt, "currency": "USD",
            },
        )
        client.post(
            "/investors/capital-accounts", headers=auth_headers("admin"),
            json={
                "code": f"CA-{inv_id}", "investor_id": inv_id,
                "entity_id": fund_id, "investor_class": "A",
            },
        )
    return fund_id, inv_ids


def test_capital_call_pro_rata_allocation(client):
    fund_id, inv_ids = _bootstrap_fund(client)

    r = client.post(
        "/capital-calls", headers=auth_headers("alice"),
        json={
            "entity_id": fund_id, "call_number": "CC-001",
            "notice_date": "2024-02-01", "due_date": "2024-02-28",
            "total_amount": "5000000.00", "currency": "USD",
            "purpose": "investment",
        },
    )
    assert r.status_code == 201, r.text
    call = r.json()

    shares = {a["investor_id"]: Decimal(a["amount"]) for a in call["allocations"]}
    # Investor with 20M commitment → 2M; with 30M → 3M
    total_committed = Decimal("50000000")
    assert shares[inv_ids[0]] == (Decimal("5000000") * Decimal("20000000") / total_committed).quantize(Decimal("0.01"))
    # Last allocation absorbs any rounding residual
    assert sum(shares.values()) == Decimal("5000000")

    # approval (different user) then funding
    r = client.post(f"/capital-calls/{call['id']}/approve", headers=auth_headers("bob"))
    assert r.status_code == 200, r.text
    assert r.json()["state"] == "approved"

    r = client.post(f"/capital-calls/{call['id']}/fund", headers=auth_headers("bob"))
    assert r.status_code == 200, r.text
    result = r.json()
    assert len(result["funded_transaction_ids"]) == 2

    # Post the generated contributions
    for tx_id in result["funded_transaction_ids"]:
        r = client.post(f"/transactions/{tx_id}/post", headers=auth_headers("bob"))
        assert r.status_code == 200, r.text

    # Capital account statement shows contributions
    r = client.get(
        "/reports/capital-account",
        params={"investor_id": inv_ids[0], "entity_id": fund_id, "as_of": "2024-12-31"},
        headers=auth_headers("alice"),
    )
    assert float(r.json()["contributed"]) == 2_000_000.00


def test_distribution_and_payout(client):
    fund_id, inv_ids = _bootstrap_fund(client)

    # Capital call + funding to create contributed balance
    call = client.post(
        "/capital-calls", headers=auth_headers("alice"),
        json={
            "entity_id": fund_id, "call_number": "CC-001",
            "notice_date": "2024-02-01", "due_date": "2024-02-28",
            "total_amount": "5000000.00", "currency": "USD",
        },
    ).json()
    client.post(f"/capital-calls/{call['id']}/approve", headers=auth_headers("bob"))
    funded = client.post(f"/capital-calls/{call['id']}/fund", headers=auth_headers("bob")).json()
    for tx_id in funded["funded_transaction_ids"]:
        client.post(f"/transactions/{tx_id}/post", headers=auth_headers("bob"))

    # Distribution
    r = client.post(
        "/distributions", headers=auth_headers("alice"),
        json={
            "entity_id": fund_id, "distribution_number": "DIST-001",
            "notice_date": "2025-06-01", "payment_date": "2025-06-30",
            "total_amount": "1000000.00", "currency": "USD", "purpose": "profit",
        },
    )
    assert r.status_code == 201, r.text
    dist = r.json()
    assert sum(Decimal(a["amount"]) for a in dist["allocations"]) == Decimal("1000000")

    client.post(f"/distributions/{dist['id']}/approve", headers=auth_headers("bob"))
    r = client.post(f"/distributions/{dist['id']}/pay", headers=auth_headers("bob"))
    assert r.status_code == 200, r.text
    for tx_id in r.json()["paid_transaction_ids"]:
        client.post(f"/transactions/{tx_id}/post", headers=auth_headers("bob"))

    # Performance endpoint
    r = client.get(
        "/performance",
        params={"entity_id": fund_id, "as_of": "2025-12-31"},
        headers=auth_headers("alice"),
    )
    assert r.status_code == 200, r.text
    m = r.json()
    assert Decimal(m["paid_in"]) == Decimal("5000000.00")
    assert Decimal(m["distributions"]) == Decimal("1000000.00")
    assert Decimal(m["dpi"]) == Decimal("0.2000")
