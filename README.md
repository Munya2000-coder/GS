# GS Private Capital Suite

End-to-end private capital operations platform: fund accounting, partnership
accounting, investor administration, fee management, carry/waterfall
administration, reporting, reconciliations, audit trails, and integrations.

Covers all 13 epics of the master user story package with a real REST API,
server-rendered HTML UI, background-job tracking, CSV exports, performance
analytics, capital-call & distribution workflows, NAV management, period and
close-calendar controls, and a CLI for administration.

## Authentication

This is a reference implementation — authentication is **header-based**
(`X-User-Id: <username>`) and intended for development and demos. It is the
single surface to replace when wiring real SSO/OIDC/SAML: swap
`app.core.security.current_user` for your IdP integration and keep the rest of
the permission and RBAC machinery unchanged.

- **UI (Jinja2 templates at `/ui/`)**: real login page at `/ui/login`. Enter a
  username, the server sets a `gs_user` cookie, and subsequent navigation is
  authenticated for the session. `/ui/logout` clears the cookie.
- **API**: every endpoint requires the `X-User-Id` header. In Swagger UI
  (`/docs`) click **Authorize** and paste a username.
- **curl**:

  ```bash
  curl -H "X-User-Id: dev-admin" http://127.0.0.1:8000/dashboards/platform
  ```

### Dev auto-provisioning

When `ENVIRONMENT=development` (the default), startup auto-creates a
`dev-admin` sys_admin user **only if the users table is empty**. This lets you
hit any endpoint immediately after `gsctl init` without running the full seed.
The username is logged at startup. In any other environment this behaviour
is skipped and you must provision users explicitly via `/admin/users` or
`gsctl seed`.

### Seed users

`gsctl seed` creates four users with different permission scopes so
maker-checker flows can be exercised:

| Username  | Roles                                   |
|-----------|-----------------------------------------|
| `admin`   | sys_admin, fund_controller, fund_accountant |
| `alice`   | fund_accountant, ops_analyst            |
| `bob`     | fund_controller                         |
| `charlie` | investor_relations                      |

## Quickstart

```bash
./scripts/bootstrap.sh
# or manually:
pip install -e ".[dev]"
gsctl init                       # create tables
gsctl seed                       # load demo data
cd frontend && npm install && npm run build && cd ..    # build the SPA
uvicorn app.main:app --reload
```

Browse:

- **React SPA**: <http://127.0.0.1:8000/app> — full interactive UI
- Legacy Jinja UI: <http://127.0.0.1:8000/ui/>
- OpenAPI docs: <http://127.0.0.1:8000/docs>
- Health: <http://127.0.0.1:8000/health>

### Working on the SPA

```bash
# terminal 1: API
uvicorn app.main:app --reload

# terminal 2: Vite dev server with HMR + /api proxy
cd frontend && npm run dev
# → http://127.0.0.1:5173
```

Sign in with any known username (`dev-admin` auto-created on first start, or
`admin`/`alice`/`bob`/`charlie` after `gsctl seed`). The SPA stores the
identity in `localStorage` and attaches `X-User-Id` on every API call.

Or with Docker:

```bash
docker compose up --build
```

## Stack

- Python 3.11+ · FastAPI · SQLAlchemy 2.x · Pydantic v2
- Jinja2 server-rendered UI
- SQLite (dev) / Postgres (prod) — swap via `DATABASE_URL`
- pytest (50 tests)

## Layout

```
app/
  core/           config, database, security/RBAC
  models/         domain model (24 tables)
  schemas/        Pydantic contracts
  services/       accounting, fees, waterfall, capital calls, distributions,
                  NAV, close, performance (IRR/TVPI/DPI), dashboards,
                  reconciliation, exports, jobs, migration, seed
  api/            REST routers (19, one per epic/sub-domain)
  ui/             Jinja2 HTML (legacy, kept for /ui/)
  spa.py          mounts the compiled React SPA from app/static/
  cli.py          gsctl command-line tool
frontend/         React + TypeScript + Vite SPA
  src/api/        typed API client + endpoints
  src/context/    AuthContext (X-User-Id header + localStorage)
  src/components/ Layout, Kpi, StateBadge, ErrorBanner
  src/pages/      Login, Dashboard, Funds, FundDetail, Investors,
                  Transactions, CapitalCalls, Distributions, Periods,
                  Operations, Audit
tests/            pytest suite (50 tests)
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
| LPA Intelligence | `/lpa/documents` upload+extract, `/lpa/documents/{id}/blueprint` (Fund Logic Blueprint), `/lpa/rules` review/approve/reject, `/lpa/issues`, `/lpa/conflicts`, `/lpa/validate/{management-fee,capital-call,waterfall}` |
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
| 13 | LPA Document Intelligence & Rule Extraction | `models/lpa.py`, `services/lpa_parser.py`, `services/lpa_extraction.py`, `services/lpa_validation.py`, `api/lpa.py` |

### Epic 13 — LPA as the source of truth

The LPA (and its side letters / amendments) is converted into a structured,
source-traceable, human-approved operating rule set that downstream validators
execute against. This is **not** a generic PDF chatbot — it is a deterministic
fund operating rule extraction system:

- **Parse** governing-document text into numbered sections (page ranges
  preserved via form-feed or `[[page]]` markers).
- **Classify** each section against the approved clause taxonomy
  (`ClauseType`: management_fee, distribution_waterfall, preferred_return,
  carried_interest, clawback, capital_call, …).
- **Extract** a structured JSON rule per clause with **full source
  traceability** (document, section, page, text excerpt) and a **confidence
  score**. Money-movement clauses are always flagged for human review.
- **Detect** missing required operating rules and conflicts (e.g. a side-letter
  fee override of an LPA clause) as first-class records.
- **Review lifecycle**: `draft_ai_extracted → pending_review → approved`
  (also `rejected`, `needs_legal_review`, `superseded`). No rule is executable
  until it is `approved` *and* carries source traceability.
- **Validate independently**: `/lpa/validate/*` recompute expected management
  fees, capital calls, and distribution waterfalls from the approved rules and
  explain every variance back to the governing source clause — the spreadsheet
  is never simply trusted.

#### POC #1 — Fund Logic Blueprint

`GET /lpa/documents/{id}/blueprint` returns the consolidated **Fund Logic
Blueprint** that powers the split-screen "Aha!" workspace, mapping directly to
the POC #1 functional requirements:

- **FR-2 Domain-targeted schema**: `fund_metadata` (fund_name, currency),
  `waterfall_rules` (preferred_return_rate, calculation_basis,
  gp_catch_up_provision, gp_catch_up_split, carried_interest_rate),
  `fee_economics` (management_fee_rate, fee_basis_investment_period,
  fee_basis_post_investment_period).
- **FR-3 Ground-truth citations**: every field carries a `citation` with
  `page_number`, `clause_reference`, `exact_extracted_text` (verbatim), and a
  `bounding_box_coordinates` slot. The citation is the product — the front-end
  click-to-trace highlights the source paragraph from these anchors.
- **FR-4 Confidence & traffic-light**: each field exposes a confidence score
  and a `status` of `green_confirmed` (≥90%) or `amber_review` (<75% or
  contains a discretionary/ambiguous phrase such as "in the sole discretion of
  the General Partner"). `side_letter_overrides` surfaces LP-specific carve-outs
  with their own citations.

> **Citation note:** ingestion is text-based (PDF text + `[[page]]`/form-feed
> page markers), so citations resolve to page + clause + verbatim text. Pixel
> `bounding_box_coordinates` require a coordinate-aware PDF parse layer — the
> field is present and reserved for that next step. The two-screen UI
> (drag-and-drop upload → split-screen blueprint/PDF with click-to-trace) is a
> front-end build on top of this API.

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
