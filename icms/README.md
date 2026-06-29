# ICMS — Immigration Compliance Management System

A secure, audit-ready UKVI sponsor-licence compliance platform for **ELMS Health
Solutions Ltd**, built from the ICMS Product Requirements Document (v1.0).

It manages the sponsor licence lifecycle from a single source of truth:
Certificate of Sponsorship approvals, sponsored-worker compliance files,
right-to-work checks, Appendix D documents, SMS reporting duties, and a
tamper-evident audit trail — with role-based access control throughout.

> **This repository also contains an unrelated application** (the "GS Private
> Capital Suite") at the repo root. ICMS is self-contained in this `icms/`
> directory and does not touch it.

---

## Stack

Built to the PRD's specified architecture (§7.1):

| Layer | Technology |
|-------|-----------|
| Frontend / Backend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn-style components, ELMS brand theme |
| ORM / DB | Prisma — **SQLite for dev**, PostgreSQL (Azure) for production |
| Auth | Pluggable: dev role-switcher now, Azure Entra ID / MSAL ready |
| Storage | Pluggable: local disk now, Azure Blob ready |
| Alerts | Pluggable: DB/log now, Microsoft Graph (email/Teams) ready |

### Azure-bound features and their dev adapters

The PRD targets Azure (Entra ID SSO, Blob Storage, Microsoft Graph, App
Service). Those require a live tenant, so each is behind an adapter with a
working local fallback, selected by env var. The integration boundary is clearly
marked in code so production wiring is a drop-in:

| Concern | Dev fallback (`*_MODE`) | Production target | Boundary file |
|---------|------------------------|-------------------|---------------|
| Auth | cookie role-switcher (`AUTH_MODE=dev`) | Entra ID / MSAL (`entra`) | `src/lib/auth.ts` |
| File storage | local disk (`STORAGE_MODE=local`) | Azure Blob (`azure-blob`) | `src/lib/storage.ts` |
| Alerts | DB + console (`ALERT_MODE=log`) | Graph API (`graph`) | `src/lib/alerts.ts` |

---

## Quickstart

```bash
cd icms
cp .env.example .env          # defaults: SQLite + dev auth + local storage
npm install
npm run db:push               # create the SQLite schema
npm run db:seed               # load ELMS demo data
npm run dev                   # http://localhost:3000
```

On the login screen, pick any seeded user to explore the system under that
role. (In production, internal staff sign in via Entra ID SSO with MFA — there
is no local password system.)

### Seeded users / roles

| User | Role(s) |
|------|---------|
| Margaret Okafor | Authorising Officer |
| Daniel Price | Key Contact / Level 1 SMS |
| Tom Reilly | System Administrator |
| Priya Nair | Compliance Manager |
| Sarah Hughes | HR Manager |
| James Adeyemi | Finance Manager |
| Laura Barnes | Care Operations Manager |
| Internal Auditor | Auditor |
| Home Office Inspector | Read-Only Inspector (time-limited, 72h) |

---

## What's implemented (vertical-slice MVP)

This first build delivers the **core compliance spine** end-to-end, with the
remaining modules scaffolded (data model + navigation + planned-requirement
pages). Implemented modules:

- **Dashboard** (Module 15) — licence status, RAG worker counts, metric tiles,
  high-risk workers, upcoming SMS deadlines.
- **Sponsored Workers** (Modules 5 & 14) — master list and per-worker compliance
  file with a **live, weighted compliance score** and Green/Amber/Red/Critical
  banding.
- **CoS Management** (Modules 2 & 7) — the **5-stage gated approval workflow**
  with the PRD's hard invariants enforced server-side:
  - no stage-skipping (ICMS-009)
  - submitter cannot final-approve their own request (ICMS-011)
  - per-stage RBAC (only the right role can action a stage)
  - approval blocked while mandatory Appendix D evidence is missing (ICMS-012)
  - immutable stage records (ICMS-010)
- **Right to Work** (Module 6) — checks, share codes, repeat-check expiry windows
  on the 180/120/90/60/30/14/7-day schedule.
- **Documents / Appendix D** (Modules 12 & 13) — checklist status across workers,
  missing/expired tracking, version metadata; upload constraints (25 MB,
  format allow-list, virus-scan hook) implemented in the storage adapter.
- **SMS Reporting** (Module 11) — reportable-event register, configurable
  **deadline calculator**, lifecycle stepper, and the **reference-required close
  gate** (ICMS-055).
- **Audit Trail** (Module 20) — append-only, non-editable action log with a
  page-level RBAC guard.
- **Governance / Risk Register / Audits & CAPA** — read-only views over real
  seeded data.

Scaffolded (planned-requirement placeholder pages): Recruitment, Payroll & Rota,
Inspection Mode, Reports, Settings.

### RBAC

Roles and permissions live in `src/lib/rbac.ts` (PRD Module 19 / §13). Access is
enforced at **two layers** per PRD §10.1: navigation is filtered to permitted
modules, and sensitive pages additionally call a server-side `pageGuard()`.

---

## Project layout

```
icms/
├── prisma/
│   ├── schema.prisma        # core data model (PRD §12)
│   └── seed.ts              # ELMS demo data
├── src/
│   ├── app/
│   │   ├── (app)/           # authenticated shell + all module pages
│   │   ├── login/           # dev sign-in + auth server actions
│   │   └── layout.tsx
│   ├── components/          # UI primitives, layout, RAG badges, guards
│   └── lib/
│       ├── auth.ts          # pluggable auth (dev / Entra)
│       ├── rbac.ts          # roles, permissions, CoS approval stages
│       ├── audit.ts         # tamper-evident audit trail
│       ├── compliance-score.ts  # weighted worker score (Module 14)
│       ├── sms.ts           # reportable events + deadline calculator
│       ├── appendix-d.ts    # Appendix D checklist template
│       ├── storage.ts       # pluggable file storage + upload rules
│       └── alerts.ts        # pluggable alert delivery
```

---

## Moving to production (PostgreSQL on Azure)

1. In `prisma/schema.prisma` set `datasource.provider = "postgresql"`.
2. Point `DATABASE_URL` at Azure Database for PostgreSQL Flexible Server.
3. Run `npx prisma migrate deploy` (switch from `db push` to migrations).
4. Set `AUTH_MODE=entra`, `STORAGE_MODE=azure-blob`, `ALERT_MODE=graph` and
   supply the corresponding Azure credentials in the environment.
5. Implement the three adapter boundaries (`resolveEntraSession`, the Blob
   branch in `putFile`, and the Graph dispatch in `sendAlert`).
6. Reinforce the audit trail with an append-only grant / row-level-security
   policy so immutability holds at the database layer (ICMS-086).

---

## Scope note

This is a reference build of the compliance spine, not the complete 31-module
system. Where a requirement needs Azure/third-party connectivity
(CareLineLive, BrightPay, Graph, Entra) the boundary is stubbed and labelled
rather than mocked silently. Enforced compliance invariants are implemented for
real against the database.
