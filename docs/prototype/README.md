# Clickable prototype

`index.html` is a self-contained, dependency-free prototype of the Private
Capital Suite. Open it directly in a browser — no build, no API, no network.

It mirrors the React SPA in `frontend/`: the same 18 routes, the same tables and
columns, the same design tokens from `frontend/src/styles.css`, and the seed
data from `app/services/seed.py` (GS Private Equity Fund I LP, five LPs,
$100M committed / $55M contributed / $15M distributed / $74.5M NAV).

## What actually works

State lives in memory and is persisted per-browser in `localStorage`;
**Reset demo** in the top bar restores the seeded fund.

- **RBAC** — sign in as `admin`, `alice`, `bob` or `charlie`. Roles resolve to
  permissions through the same `ROLE_PERMISSIONS` map as
  `app/core/security.py`, and controls the signed-in user cannot use are
  disabled with the reason in the tooltip.
- **Maker-checker** — draft a capital call and try to approve it yourself:
  `409 · maker cannot approve own submission`, matching
  `services/workflow.py`.
- **Capital calls / distributions** — pro-rata allocation by commitment,
  approve, then fund or pay; funding writes one posted transaction per LP.
- **Transactions** — `validated → approved → posted`. Posting into a
  soft-closed or closed period is refused.
- **Fees** — accrual against an approved schedule, with the input hash and
  schedule version recorded on the run.
- **Waterfall** — a faithful port of `services/waterfall.py::_compute_tiers`,
  including `compute_hurdle`. Change the distributable amount and re-run to
  watch return of capital, preferred return, GP catch-up and carry fill in
  order.
- **Periods** — soft close, hard close (blocked until every close step is
  signed off and exceptions are cleared), and reopen with a logged reason.
- **Import & reconciliation** — malformed and unknown-investor rows become
  exceptions you can assign and resolve.
- **Audit** — every action above appends to the audit log and, where relevant,
  writes lineage edges.

Performance figures are computed, not hard-coded: IRR is bisection over the
dated cashflows, and TVPI/DPI/RVPI/MOIC/PIC follow `services/performance.py`.

## What it is not

There is no API, no persistence beyond the browser, and no authentication.
CSV export records a job and a toast rather than producing a file — exports
stream from `/exports` in the running application.
