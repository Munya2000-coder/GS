# GS Fund Document Intelligence Workbench (POC #1 front-end)

A standalone React + Vite + TypeScript SPA that drives the **Fund Document
Intelligence Workbench** — the two-screen experience from the POC #1 spec:

1. **Upload & Extract** — choose a fund, paste a governing document (LPA, PPM,
   side letter, …), and run extraction.
2. **Fund Logic Blueprint** — split-screen: extracted waterfall/fee/metadata
   fields on the left; click any value to **trace it to its verbatim source
   clause** on the right (the "citation is the product" feature). Traffic-light
   status (green = confirmed, amber = needs review).
3. **Operating Pack** — Fund Terms Summary, portable Operating Rules, Investor
   & Reporting Obligation matrices, Obligation Calendar, and the Exception
   report (including PPM↔LPA consistency mismatches).

This app is **API-only over HTTP** — it consumes the existing GS backend
endpoints under `/lpa/*` and `/entities`. It does not contain business logic;
the deterministic extraction engine lives in the Python backend.

## Prerequisites

The GS backend must be running on `http://127.0.0.1:8000`:

```bash
# from the repo root
pip install -e ".[dev]" && gsctl init && gsctl seed
uvicorn app.main:app --reload
```

## Run the Workbench

```bash
cd workbench
npm install
npm run dev          # → http://127.0.0.1:5174
```

Vite proxies `/api/*` → `http://127.0.0.1:8000` (stripping `/api`), so the SPA
calls `/api/lpa/...` which hits `/lpa/...` on the backend. Set the dev identity
with the **X-User-Id** box in the header (default `admin`).

## Build

```bash
npm run build        # type-checks then emits to ./dist
npm run typecheck    # types only
```

## Layout

```
workbench/
  index.html
  vite.config.ts        # /api proxy → :8000, dev port 5174, build → ./dist
  src/
    api.ts              # axios client, X-User-Id header, /lpa endpoints
    types.ts            # response shapes mirrored from the backend
    lib.tsx             # traffic-light + formatting helpers
    App.tsx             # orchestrator: fund select → upload/extract → blueprint → pack
    components/
      BlueprintView.tsx # split-screen click-to-trace
      PackView.tsx      # tabbed operating pack (terms, rules, matrices, calendar, exceptions)
```

## Notes / next steps

- The right-panel "source evidence" highlights the **verbatim clause text**.
  True PDF rendering with pixel bounding-box highlighting needs a
  coordinate-aware PDF layer in the backend (the citation already carries a
  `bounding_box_coordinates` slot); a PDF viewer (e.g. `pdf.js`) would slot in
  on the right panel.
- Auth is the dev header scheme (`X-User-Id`); swap for real SSO when the
  backend does.
