# GS Private Capital Suite

End-to-end private capital operations platform: fund accounting, partnership
accounting, investor administration, fee management, carry/waterfall
administration, reporting, reconciliations, audit trails, and integrations.

Covers all 12 epics of the master user story package with a real REST API,
server-rendered HTML UI, background-job tracking, CSV exports, performance
analytics, capital-call & distribution workflows, NAV management, period and
close-calendar controls, and a CLI for administration.

## Quickstart

```bash
./scripts/bootstrap.sh
# or manually:
pip install -e ".[dev]"
gsctl init         # create tables
gsctl seed         # load demo data (fund, investors, calls, distributions, NAV)
gsctl summary      # print platform KPIs
uvicorn app.main:app --reload
```

Browse:

- UI dashboard: <http://127.0.0.1:8000/ui/> (sign in as `admin`, `alice`, `bob`, `charlie`)
- OpenAPI docs: <http://127.0.0.1:8000/docs>
- Health: <http://127.0.0.1:8000/health>

Or with Docker:

```bash
docker compose up --build
```

## Stack

- Python 3.11+ · FastAPI · SQLAlchemy 2.x · Pydantic v2
- Jinja2 server-rendered UI
- SQLite (dev) / Postgres (prod) — swap via `DATABASE_URL`
- pytest (28 tests)

## Layout

```
app/
  core/           config, database, security/RBAC
  models/         domain model (20 tables)
  schemas/        Pydantic contracts
  services/       accounting, fees, waterfall, capital calls, distributions,
                  NAV, close, performance (IRR/TVPI/DPI), dashboards,
                  reconciliation, exports, jobs, migration, seed
  api/            REST routers (18, one per epic/sub-domain)
  ui/             Jinja2 HTML dashboard & fund/investor/operations views
  cli.py          gsctl command-line tool
tests/            pytest suite
scripts/          bootstrap + ops helpers
Dockerfile, docker-compose.yml
```

## REST API surface

| Area | Routes |
|------|--------|
| Health | `GET /health` |
| Entities | `/entities` CRUD |
| Investors | `/investors`, `/investors/commitments`, `/investors/capital-accounts` |
| Transactions | `/transactions/import`, approve, post, exceptions |
| Fees | `/fees/schedules`, approve, `/fees/run` |
| Waterfall | `/waterfall/models`, approve, `/waterfall/run`, approve |
| Capital Calls | `/capital-calls` create, approve, fund |
| Distributions | `/distributions` create, approve, pay |
| NAV | `/nav` publish, list |
| Periods | `/periods` ensure, soft-close, close, reopen, steps, sign-off |
| Reports | trial balance, capital account, contrib/distrib, waterfall, fees |
| Performance | IRR, TVPI, DPI, RVPI, MOIC, PIC |
| Dashboards | platform, fund, operations |
| Exports | transactions.csv, trial-balance.csv, capital-accounts.csv, journal-entries.csv |
| Audit | events, lineage upstream/downstream |
| Admin | users provisioning, deactivate |
| Reconciliation | batch recon, exception assignment |
| Integrations | interfaces, transaction import template, runs |
| Jobs | list, retry |

## Coverage by epic

| # | Epic | Modules |
|---|------|---------|
| 1 | Fund & Entity Setup | `models/entity.py`, `api/entities.py` |
| 2 | Investor & Relationship | `models/investor.py`, `models/capital_account.py` |
| 3 | Transaction Ingestion & Accounting | `services/accounting.py`, `models/journal.py`, `models/period.py` |
| 4 | Waterfall & Carry | `services/waterfall.py` (American + European + hybrid) |
| 5 | Fee Management | `services/fees.py` (commitment / invested / NAV basis, step-downs) |
| 6 | Reporting & Analytics | `services/reporting.py`, `services/dashboards.py`, `services/performance.py`, `ui/` |
| 7 | Audit, Lineage, Transparency | `services/audit.py`, `services/lineage.py` |
| 8 | Workflow, Approvals, Operations | `services/workflow.py`, `services/close.py`, `services/jobs.py` |
| 9 | Integration & Data Exchange | `api/integrations.py`, `api/exports.py`, `services/exports.py` |
| 10 | Security & User Administration | `core/security.py`, `models/user.py`, `api/admin.py` |
| 11 | Reconciliation & Controls | `services/reconciliation.py`, import exception queue |
| 12 | Migration, Testing, Go-Live | `services/migration.py`, `services/seed.py`, test suite |

## Design principles

- **Effective dating everywhere**: entity versions, fee schedules, waterfall
  models carry `effective_from` / `effective_to`; historical reports reproduce
  exactly against the configuration in force at the time.
- **Versioned, immutable calculation runs**: every fee and waterfall run
  persists the input-data snapshot hash, model version, user, and timestamp.
  Approved runs cannot be silently overwritten.
- **Workflow states**: `DRAFT → PENDING_REVIEW → APPROVED → POSTED → ARCHIVED`.
  Maker cannot approve own work unless `ALLOW_SELF_APPROVAL=true`.
- **Lineage**: `LineageEdge` records connect import batches → transactions →
  journal entries → calculations → reports. Traversable via the API.
- **Append-only audit log**: `AuditEvent` captures every state change; cannot
  be modified by standard roles.
- **RBAC**: roles (fund accountant, controller, ops analyst, IR, compliance,
  auditor, sys admin, executive, external) map to fine-grained permissions
  (read/create/edit/approve/post/export/admin). Fund-scope restriction supported.

## Performance metrics

IRR uses Newton-Raphson on dated cashflows; TVPI/DPI/RVPI/MOIC/PIC are
computed from posted transactions and ending NAV. Run against the seed data:

```bash
$ gsctl summary
{
  "funds": {"total": 1, "active": 1},
  "investors": 5,
  "aum": {
    "committed": "100000000.00",
    "contributed": "55000000.00",
    "distributed": "15000000.00",
    "nav": "74500000.00"
  }
}
```

## Running tests

```bash
python -m pytest
```

28 tests covering: RBAC, entity/investor CRUD, full ingest→approve→post→report
pipeline, fee accrual math & reproducibility, American & European waterfalls,
IRR/TVPI/DPI, capital-call pro-rata allocation, distribution payout,
period lifecycle, close-step dependencies, NAV publishing, UI rendering,
CSV export, seed data, and audit/lineage traversal.
