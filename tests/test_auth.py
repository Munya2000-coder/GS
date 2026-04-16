"""Auth / dev-admin auto-provisioning."""

import app.core.database as db
from app.models.user import User


def test_ensure_dev_admin_creates_when_empty(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    from app.core import config
    config.get_settings.cache_clear()

    with db.SessionLocal() as s:
        assert s.query(User).count() == 0

    created = db.ensure_dev_admin()
    assert created == "dev-admin"
    with db.SessionLocal() as s:
        u = s.query(User).filter(User.username == "dev-admin").one()
        assert "sys_admin" in u.roles_list()
        assert u.active is True


def test_ensure_dev_admin_skips_in_non_dev(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    from app.core import config
    config.get_settings.cache_clear()

    created = db.ensure_dev_admin()
    assert created is None
    with db.SessionLocal() as s:
        assert s.query(User).filter(User.username == "dev-admin").count() == 0


def test_ensure_dev_admin_skips_when_users_exist(monkeypatch, seed_users):
    monkeypatch.setenv("ENVIRONMENT", "development")
    from app.core import config
    config.get_settings.cache_clear()

    created = db.ensure_dev_admin()
    assert created is None


def test_openapi_exposes_authorize_button(client):
    spec = client.get("/openapi.json").json()
    schemes = spec.get("components", {}).get("securitySchemes", {})
    assert any(
        scheme.get("in") == "header" and scheme.get("name") == "X-User-Id"
        for scheme in schemes.values()
    ), f"X-User-Id security scheme not found in {schemes}"


def test_api_accepts_header_auth(client):
    r = client.get("/entities", headers={"X-User-Id": "admin"})
    assert r.status_code == 200
    r = client.get("/entities")
    assert r.status_code == 401
