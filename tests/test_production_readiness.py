"""Production-readiness tests: security headers, problem+json errors,
request-id correlation, readiness probe, production secret validation."""

import pytest

from tests.conftest import auth_headers


def test_security_headers_present(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert "content-security-policy" in r.headers
    assert "strict-transport-security" in r.headers


def test_request_id_echoed(client):
    r = client.get("/health", headers={"X-Request-Id": "corr-abc-123"})
    assert r.headers["x-request-id"] == "corr-abc-123"


def test_request_id_generated_when_absent(client):
    r = client.get("/health")
    rid = r.headers.get("x-request-id")
    assert rid and len(rid) >= 16


def test_problem_json_on_error(client):
    r = client.get("/entities")  # missing X-User-Id
    assert r.status_code == 401
    assert r.headers["content-type"].startswith("application/problem+json")
    body = r.json()
    assert body["status"] == 401
    assert body["title"]
    assert "request_id" in body


def test_readyz_probe(client):
    r = client.get("/readyz")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ready"
    assert "environment" in data


def test_admin_me(client):
    r = client.get("/admin/me", headers=auth_headers("admin"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["username"] == "admin"
    assert "sys_admin" in body["roles"]
    assert "admin" in body["permissions"]


def test_production_secret_required(monkeypatch):
    from app.core.config import Settings

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "change-me-in-production")
    with pytest.raises(Exception, match="SECRET_KEY must be set"):
        Settings()

    # Valid secret passes
    monkeypatch.setenv("SECRET_KEY", "a-properly-long-random-secret-value")
    Settings()
