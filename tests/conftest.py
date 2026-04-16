import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture(autouse=True)
def _tmp_database(monkeypatch, tmp_path: Path):
    db_path = tmp_path / "test.db"
    url = f"sqlite:///{db_path}"
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("ALLOW_SELF_APPROVAL", "false")

    from app.core import config as cfg_mod
    cfg_mod.get_settings.cache_clear()

    # rebind the shared engine/Session to the test DB
    import app.core.database as db
    db.engine = create_engine(url, connect_args={"check_same_thread": False}, future=True)
    db.SessionLocal = sessionmaker(bind=db.engine, autoflush=False, autocommit=False, future=True)

    from app.models import register_models
    register_models()
    db.Base.metadata.drop_all(bind=db.engine)
    db.Base.metadata.create_all(bind=db.engine)
    yield
    db.Base.metadata.drop_all(bind=db.engine)


@pytest.fixture
def session():
    from app.core.database import SessionLocal

    s = SessionLocal()
    try:
        yield s
    finally:
        s.rollback()
        s.close()


@pytest.fixture
def seed_users(session):
    from app.models.user import User

    users = {}
    for username, roles in [
        ("alice", ["fund_accountant", "ops_analyst"]),
        ("bob", ["fund_controller"]),
        ("admin", ["sys_admin"]),
    ]:
        u = User(
            username=username,
            display_name=username.title(),
            email=f"{username}@example.com",
        )
        u.set_roles(roles)
        session.add(u)
        users[username] = u
    session.commit()
    for u in users.values():
        session.refresh(u)
    return users


@pytest.fixture
def client(seed_users):
    from app.main import create_app

    app = create_app()
    return TestClient(app)


def auth_headers(user: str) -> dict[str, str]:
    return {"X-User-Id": user}
