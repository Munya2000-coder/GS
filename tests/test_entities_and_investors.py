from tests.conftest import auth_headers


def test_create_entity_and_investor_flow(client):
    # permission denied without correct role
    r = client.post(
        "/entities",
        headers=auth_headers("admin"),
        json={
            "code": "PE-I",
            "legal_name": "PE Fund I LP",
            "short_name": "PE I",
            "entity_type": "fund",
            "jurisdiction": "DE",
            "base_currency": "USD",
            "reporting_currency": "USD",
        },
    )
    assert r.status_code == 201, r.text
    fund = r.json()
    assert fund["code"] == "PE-I"
    assert fund["status"] == "setup"

    r = client.get("/entities", headers=auth_headers("alice"))
    assert r.status_code == 200
    assert len(r.json()) == 1

    # unique constraint on code
    r = client.post(
        "/entities",
        headers=auth_headers("admin"),
        json={
            "code": "PE-I",
            "legal_name": "Duplicate",
            "short_name": "dup",
            "entity_type": "fund",
            "jurisdiction": "DE",
            "base_currency": "USD",
            "reporting_currency": "USD",
        },
    )
    assert r.status_code == 409

    r = client.post(
        "/investors",
        headers=auth_headers("admin"),
        json={
            "code": "INV-001",
            "legal_name": "Pension Plan Alpha",
            "short_name": "Alpha",
            "domicile": "US",
        },
    )
    assert r.status_code == 201, r.text
    inv = r.json()

    r = client.post(
        "/investors/commitments",
        headers=auth_headers("admin"),
        json={
            "investor_id": inv["id"],
            "entity_id": fund["id"],
            "closing_id": "C1",
            "closing_date": "2024-01-15",
            "investor_class": "A",
            "commitment_amount": "50000000.00",
            "currency": "USD",
        },
    )
    assert r.status_code == 201, r.text


def test_requires_auth(client):
    r = client.get("/entities")
    assert r.status_code == 401


def test_rbac_denies_readonly_user(client, session):
    from app.models.user import User

    user = User(username="viewer", display_name="Viewer", email="v@example.com")
    user.set_roles(["executive"])
    session.add(user)
    session.commit()

    r = client.post(
        "/entities",
        headers=auth_headers("viewer"),
        json={
            "code": "X", "legal_name": "x", "short_name": "x",
            "entity_type": "fund", "jurisdiction": "US",
            "base_currency": "USD", "reporting_currency": "USD",
        },
    )
    # "X" is too short for the min_length(2) validator, so it may 422 — retry with valid
    if r.status_code == 422:
        r = client.post(
            "/entities",
            headers=auth_headers("viewer"),
            json={
                "code": "XY", "legal_name": "x", "short_name": "x",
                "entity_type": "fund", "jurisdiction": "US",
                "base_currency": "USD", "reporting_currency": "USD",
            },
        )
    assert r.status_code == 403
