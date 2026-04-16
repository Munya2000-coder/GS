# GS Private Capital Suite

End-to-end private capital operations platform: fund accounting, partnership
accounting, investor administration, fee management, carry/waterfall
administration, reporting, reconciliations, audit trails, and integrations.

This repository contains a reference backend implementation that addresses the
master user story package (12 epics, 20+ stories). The intent is a credible
foundation — the domain model, calculation engines, workflow states, audit
logging, and API surface are real; some surface areas (UI, every integration
adapter, full migration tooling) are scaffolded for extension rather than fully
productised.

## Stack

- Python 3.11+
- FastAPI (REST API)
- SQLAlchemy 2.x (domain model, ORM)
- Pydantic v2 (schemas, validation)
- SQLite by default; swap `DATABASE_URL` for Postgres in production
- pytest (tests)

## Layout

```
app/
  core/           config, database, security/RBAC primitives
  models/         SQLAlchemy domain model
  schemas/        Pydantic request/response contracts
  services/       business logic: fees, waterfall, accounting, lineage, audit
  api/            REST routes grouped by epic
tests/            unit + integration tests
```

## Coverage by epic

| Epic | Module |
|------|--------|
| 1. Fund & Entity Setup | `models/entity.py`, `api/entities.py` |
| 2. Investor & Relationship | `models/investor.py`, `models/capital_account.py`, `api/investors.py` |
| 3. Transaction Ingestion & Accounting | `models/transaction.py`, `models/journal.py`, `services/accounting.py`, `api/transactions.py` |
| 4. Waterfall & Carry | `models/waterfall.py`, `services/waterfall.py`, `api/waterfall.py` |
| 5. Fee Management | `models/fee.py`, `services/fees.py`, `api/fees.py` |
| 6. Reporting & Analytics | `services/reporting.py`, `api/reports.py` |
| 7. Audit, Lineage, Transparency | `services/audit.py`, `services/lineage.py`, `api/audit.py` |
| 8. Workflow & Approvals | `models/workflow.py`, `services/workflow.py` |
| 9. Integration | `api/integrations.py` (import templates, export) |
| 10. Security & Admin | `core/security.py`, `models/user.py`, `api/admin.py` |
| 11. Reconciliation & Controls | `services/reconciliation.py`, `api/reconciliation.py` |
| 12. Migration & Go-Live | `services/migration.py` |

## Running

```bash
pip install -e .
uvicorn app.main:app --reload
pytest
```

## Key design principles

- **Effective dating everywhere**: economic terms, fee schedules, waterfall
  models, and entity configs carry `effective_from` / `effective_to` so
  historical reports reproduce exactly.
- **Versioned, immutable calculation runs**: every fee or waterfall calculation
  is persisted as a `CalculationRun` with input-data-version, model-version,
  user, timestamp, and approval state. Approved runs are immutable.
- **Workflow states**: `DRAFT → PENDING_REVIEW → APPROVED → POSTED → ARCHIVED`
  with maker-checker separation enforced at the service layer.
- **Lineage**: every accounting entry links to its source transaction and
  import batch; every calculation run links to its input dataset snapshot.
- **Audit log**: append-only `AuditEvent` table; standard roles cannot modify
  rows.
