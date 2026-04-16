"""Domain models. Importing this package registers all models with SQLAlchemy."""


def register_models() -> None:
    from app.models import (  # noqa: F401
        audit,
        capital_account,
        entity,
        fee,
        integration,
        investor,
        journal,
        period,
        reconciliation,
        transaction,
        user,
        waterfall,
        workflow,
    )
