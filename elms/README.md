# ELMS Training Management System

A CQC-compliant training, compliance and evidence platform for **ELMS Health
Solutions Ltd** — replacing fragile spreadsheet tracking with an auditable,
automated, easy-to-use system.

This is a polished, fully-interactive front-end built to the attached PRD, with
a realistic in-memory data layer so every screen is usable end-to-end.

## Highlights

- **Crisp, accessible design system** — light healthcare-grade theme, Inter
  typography, soft elevation, RAG colour language (Green / Amber / Red / Grey),
  custom SVG icon set and charts (no heavy chart dependencies).
- **Live RAG compliance engine** — status is derived from completion + expiry
  dates and the certificate approval state, exactly as specified.
- **Every PRD screen**, wired to shared state.

## Screens

| Area | Screen |
|------|--------|
| Overview | Dashboard (compliance %, RAG donut, CQC-domain bars, action queue, readiness) |
| Workforce | Staff Register · Staff Profile (training, documents, activity) |
| Compliance | Training Matrix (the live CQC grid) · Module Catalogue (configurable) |
| Workflow | Evidence & Approvals (upload → pending → approve/return → auto-update → audit) |
| Risk | Overdue & Due Soon (90/60/30/7-day reminder schedule) |
| Reporting | Reports & CQC Export (PDF/Excel/CSV) · time-limited inspector access |
| Governance | Annual Review Log · Audit Trail · Notifications (Email/SMS/in-system) |
| Admin | User Management (role permissions) · Settings (org, reminders, channels, rules) |

## Key features mapped to the PRD

- Role-based access (Registered Manager, Compliance Lead, Training Manager,
  care roles, Director, **read-only CQC inspection mode**).
- Training matrix mapped to the five CQC domains (Safe, Effective, Caring,
  Responsive, Well-Led) with configurable modules, refresh frequencies, role
  assignment and evidence requirements.
- Certificate approval workflow with automatic status & expiry recalculation
  and full audit logging.
- Automated expiry tracking and a multi-stage reminder/escalation schedule.
- CQC evidence pack export and secure, auto-expiring inspector accounts.
- DBS / right-to-work / visa expiry monitoring on every staff profile.

## Running locally

```bash
cd elms
npm install
npm run dev        # http://localhost:5174
```

Build & preview a production bundle:

```bash
npm run build
npm run preview
```

### Demo sign-in

The login screen offers one-click demo accounts. **CQC Inspector** signs you in
to the read-only inspection mode (administration hidden, all edit actions
removed).

## Tech

React 18 · TypeScript · Vite · React Router. State and the seeded compliance
data live in `src/store` and `src/data`; the RAG logic is in `src/lib/domain.ts`
and analytics in `src/lib/analytics.ts`. No backend is required to explore the
system.
