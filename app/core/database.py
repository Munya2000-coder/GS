from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


_settings = get_settings()

connect_args = {"check_same_thread": False} if _settings.database_url.startswith("sqlite") else {}
engine = create_engine(_settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def init_db() -> None:
    from app.models import register_models

    register_models()
    Base.metadata.create_all(bind=engine)


def ensure_dev_admin() -> str | None:
    """In development, provision a `dev-admin` sys_admin user if no users
    exist. Returns the username created, or None if skipped."""
    settings = get_settings()
    if settings.environment != "development":
        return None
    from app.models.user import User

    with SessionLocal() as s:
        if s.query(User).count() > 0:
            return None
        user = User(
            username="dev-admin",
            display_name="Development Admin",
            email="dev-admin@example.local",
        )
        user.set_roles(["sys_admin"])
        s.add(user)
        s.commit()
        return user.username
