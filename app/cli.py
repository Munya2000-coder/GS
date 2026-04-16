"""Command-line utility: seed data, list entities, reset database, and
print platform summary."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime

from app.core.database import Base, SessionLocal, engine, init_db


def cmd_init(_args: argparse.Namespace) -> int:
    init_db()
    print("database initialised")
    return 0


def cmd_reset(args: argparse.Namespace) -> int:
    if not args.yes:
        print("refusing to drop tables without --yes", file=sys.stderr)
        return 2
    from app.models import register_models
    register_models()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("database reset")
    return 0


def cmd_seed(_args: argparse.Namespace) -> int:
    from app.services import seed as seed_svc
    init_db()
    with SessionLocal() as session:
        try:
            result = seed_svc.seed(session)
            session.commit()
        except Exception:
            session.rollback()
            raise
    print(json.dumps(result, indent=2))
    return 0


def cmd_summary(_args: argparse.Namespace) -> int:
    from app.services.dashboards import platform_summary
    init_db()
    with SessionLocal() as session:
        print(json.dumps(platform_summary(session), indent=2, default=str))
    return 0


def cmd_list_entities(_args: argparse.Namespace) -> int:
    from app.models.entity import Entity
    init_db()
    with SessionLocal() as session:
        for e in session.query(Entity).order_by(Entity.code).all():
            print(f"{e.id:>4}  {e.code:<10}  {e.legal_name}  [{e.status.value}]")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="gsctl", description="GS Private Capital Suite administration")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("init", help="initialise the database")

    p_reset = sub.add_parser("reset", help="drop and recreate all tables")
    p_reset.add_argument("--yes", action="store_true", help="confirm destructive action")

    sub.add_parser("seed", help="load demo data")
    sub.add_parser("summary", help="print platform KPIs")
    sub.add_parser("list-entities", help="list registered entities")

    args = parser.parse_args(argv)
    handlers = {
        "init": cmd_init, "reset": cmd_reset, "seed": cmd_seed,
        "summary": cmd_summary, "list-entities": cmd_list_entities,
    }
    if args.command not in handlers:
        parser.print_help()
        return 1
    return handlers[args.command](args)


if __name__ == "__main__":
    raise SystemExit(main())
