# ELMS Training Management System — Developer Guide

Everything a developer needs to run, understand, edit, extend, and deploy the
app. Pair this with the [Function & Component Reference](./FUNCTION-REFERENCE.md)
(every function explained) and [ARCHITECTURE.md](./ARCHITECTURE.md) (the data
flow at a glance).

---

## 1. What this is

A single-page **React + TypeScript** app (built with **Vite**) implementing a
CQC-compliant training-management system for ELMS Health Solutions. It runs
**100% in the browser** with an in-memory data layer — no backend required — so
it's ideal for demos, prototyping, and as the front-end half of a future
full-stack build.

- **Routing:** `react-router-dom` with `HashRouter` (works from `file://`, GitHub Pages, any static host).
- **State:** one React Context store (`src/store/store.tsx`). No Redux/Zustand.
- **Styling:** one hand-written design system in `src/styles/global.css` (CSS variables + classes). No Tailwind/UI kit.
- **Charts/icons:** hand-built SVG (`Donut`, `ProgressRing`, `Meter`, `Icon`). No chart library.
- **AI:** ten features behind one swappable seam (`src/lib/ai.ts`), simulated today, ready for live Claude.

---

## 2. Prerequisites

- **Node.js ≥ 18** (developed on Node 22) and npm.
- That's it. No database, no env vars, no API keys to run the demo.

---

## 3. Run it

```bash
cd elms
npm install
npm run dev          # → http://localhost:5174  (hot-reload dev server)
```

Other scripts:

```bash
npm run build        # type-check (tsc -b) + production build → dist/
npm run preview      # serve the built dist/ locally
npm run typecheck    # type-check only
```

**Single-file build** (the click-and-go `ELMS-Training-System.html`):

```bash
SINGLE_FILE=1 npm run build   # inlines everything → standalone/index.html
```

### Demo sign-in
The login screen has one-click demo accounts. **Amara Okafor** = Registered
Manager (full access). **CQC Inspector** = read-only inspection mode
(Administration nav hidden, all edit actions removed). Data is in-memory, so a
full page refresh resets to the seeded state.

---

## 4. Project structure

```
elms/
├── index.html                 # Vite HTML entry (loads /src/main.tsx, Inter font)
├── vite.config.ts             # Vite config + SINGLE_FILE mode
├── tsconfig*.json             # TypeScript config
├── docs/                      # ← you are here
└── src/
    ├── main.tsx               # bootstrap: StrictMode → HashRouter → StoreProvider → App
    ├── App.tsx                # auth guard + route table
    ├── styles/global.css      # the entire design system (tokens + classes)
    ├── data/
    │   ├── types.ts           # the domain model (every type/interface)
    │   └── seed.ts            # deterministic in-memory demo data
    ├── lib/
    │   ├── domain.ts          # RAG engine, date math, labels (TODAY lives here)
    │   ├── analytics.ts       # compliance %, work-queues, breakdowns
    │   └── ai.ts              # ★ the AI engine / Claude swap seam
    ├── store/
    │   └── store.tsx          # global state + actions (useStore)
    ├── components/
    │   ├── Icon.tsx           # SVG icon registry
    │   ├── ui.tsx             # UI primitives (Card, Button, Modal, charts…)
    │   ├── ai.tsx             # AI UI kit + useAiTask hook
    │   ├── ToastHost.tsx      # global toasts
    │   ├── Assistant.tsx      # floating grounded AI assistant
    │   └── Layout.tsx         # app shell (sidebar + topbar + outlet)
    └── pages/                 # one file per screen (route)
        ├── Login.tsx  Dashboard.tsx  StaffRegister.tsx  StaffProfile.tsx
        ├── TrainingMatrix.tsx  ModuleCatalogue.tsx  Evidence.tsx  Overdue.tsx
        ├── Reports.tsx  AnnualReviews.tsx  Incidents.tsx  AuditLog.tsx
        └── Notifications.tsx  UserManagement.tsx  Settings.tsx
```

**Mental model of the data flow:**
`seed.ts` → `store.tsx` (raw state) → `computed` selector applies `computeRag`
(domain.ts) → pages read `computed` and call `analytics.ts` / `ai.ts` to render.
Mutations go back through store actions, which also write the audit trail and
fire a toast. See [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 5. Conventions

- **TypeScript is strict** (`noUnusedLocals`, `noUnusedParameters`, `strict`). Remove unused imports or the build fails. Run `npm run typecheck` before committing.
- **No CSS-in-JS.** Styling is utility/component classes in `global.css`. Add new tokens under `:root`. Reuse classes like `card`, `btn`, `badge`, `row`, `col`, `gap-12`, `grid`.
- **State only through the store.** Never mutate seed arrays directly; call a store action (so audit + toast stay consistent). Read via `useStore()`.
- **Dates are ISO strings** (`YYYY-MM-DD`) everywhere; convert with `parse`/`fmtDate`/`iso` from `lib/domain.ts`. The system clock is the fixed `TODAY` constant.
- **AI calls go through `useAiTask`** so loading state and the stale-closure fix come for free.
- **Components are presentational + class-driven.** Prefer composing existing primitives from `components/ui.tsx`.

---

## 6. How to edit — recipes

### Add a new training module to the seed catalogue
Edit `src/data/seed.ts` → append to `MODULES`:
```ts
{ id: "m-fluids", code: "FLU-01", title: "Hydration & Fluids", category: "Specialist Care Training",
  cqcDomain: "Effective", refresh: "Annual", mandatory: false, delivery: "eLearning",
  appliesTo: ["care_worker", "senior_carer"], evidenceRequired: false, provider: "ELMS Internal",
  description: "Supporting good hydration." }
```
Records are generated for every applicable staff member automatically. (At runtime, admins can also add modules via the **Module Catalogue → New module** UI, which calls `addModule`.)

### Add a staff member to the seed
Edit `rawStaff` in `seed.ts` (terse form); `STAFF` expands it (email, labels, avatar). Or use **Staff Register → Add staff member** at runtime (`addStaff`).

### Change the RAG thresholds
- Amber window: change `DUE_SOON_DAYS` in `lib/domain.ts`.
- The logic itself: `computeRag` in `lib/domain.ts` (single source of truth for status).

### Add a brand-new page/screen
1. Create `src/pages/MyPage.tsx` exporting a component.
2. Register the route in `src/App.tsx` inside the `<Layout>` route: `<Route path="/mypage" element={<MyPage />} />`.
3. Add it to the sidebar + topbar in `src/components/Layout.tsx`: push a `NavItem` into one of the nav group arrays, and add a `PAGE_META["/mypage"]` entry.

### Add a store action / new state
In `src/store/store.tsx`: add a `useState`, a `useCallback` action (call `logAudit` + `pushToast` to stay consistent), expose both on the `StoreShape` interface and in the `value` object. Consume with `useStore()`.

### Add an icon
Add an entry to the `paths` map in `src/components/Icon.tsx` (24×24 SVG geometry, stroke-based). It's now a valid `IconName`.

### Restyle / rebrand
All colours and geometry are CSS variables at the top of `src/styles/global.css` (`--brand-*`, `--green/amber/red`, radii, shadows). Change the brand ramp to re-skin the whole app. The AI surfaces use the `--ai-*` gradient tokens.

### Make the demo "live" (use the real clock)
Change `TODAY` in `lib/domain.ts` to `new Date()`. (Kept fixed only so the seeded data tells a stable story.)

---

## 7. Wiring the AI to real Claude

Today every AI feature is a grounded simulation in `src/lib/ai.ts`, returning
through `think(simulated)`. The return **shapes** (`CertExtraction`,
`AiAnswer`, `RiskScore`, etc.) are the contract — the UI depends only on those,
so you can swap the bodies without touching any component.

**Step 1 — add a tiny backend proxy** (never call the Anthropic API directly
from the browser; your API key must stay server-side). The commented
`callClaude` helper in `ai.ts` shows the intended client call:

```ts
// client side (already sketched in ai.ts)
async function callClaude(system: string, prompt: string, schema?: object) {
  const r = await fetch("/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-opus-4-8", system, prompt, schema }),
  });
  return r.json();
}
```

**Step 2 — implement `/api/ai`** on a small server (Express/Fastify/Next route).
It proxies to the Anthropic **Messages API** and, for the structured features,
uses **tool use / JSON output** so the response matches the TypeScript shape.
Keep `ANTHROPIC_API_KEY` in server env.

**Step 3 — swap one function at a time.** e.g. for certificate intelligence:
```ts
export async function aiExtractCertificate(rec: ComputedRecord): Promise<CertExtraction> {
  return callClaude(
    "You are a CQC compliance assistant. Extract certificate fields and recommend approve/review/return.",
    JSON.stringify({ module: rec.module, staff: rec.staff, evidence: rec.evidence }),
    CERT_EXTRACTION_JSON_SCHEMA, // forces output to match CertExtraction
  );
}
```
The grounded query (`aiAnswerQuery`) is best kept as a **tool the model calls**
against your real data (so answers stay citation-backed and never hallucinate
records) — pass the filtered records as context or expose a query tool.

**Guardrails to keep (already reflected in the UI):** keep a human in the loop
for anything that changes compliance status; log every AI action to the audit
trail; show confidence + sources; and never let AI auto-approve without the
recommendation being explicitly applied by a manager.

---

## 8. Build & deploy

`npm run build` produces a static `dist/` you can host anywhere (it uses
`HashRouter`, so no server rewrite rules are needed).

- **Any static host / S3 / nginx:** serve `dist/`.
- **GitHub Pages:** push `dist/` (or wire a Pages Action). `base: "./"` is already set in `vite.config.ts` so assets resolve from any sub-path.
- **Single file:** `SINGLE_FILE=1 npm run build` → `standalone/index.html`, a self-contained file you can email and double-click.

Generated artifacts (`dist/`, `standalone/`, `*.tsbuildinfo`, the packaged HTML)
are git-ignored.

---

## 9. Testing & verification

There's no unit-test suite yet (it's a prototype). The build itself is the gate:
`npm run build` runs `tsc -b` (strict type-check) then Vite. For manual
verification we drive the built app with headless Chromium (Playwright) — sign
in, click through each screen and AI feature, and assert no console errors. A
good first test target would be `lib/domain.ts` (`computeRag`, date math) and
`lib/analytics.ts` (pure functions, trivial to unit-test with Vitest).

---

## 10. Where to look first

| I want to change… | Go to |
|---|---|
| What "overdue/amber/green" means | `lib/domain.ts` → `computeRag`, `DUE_SOON_DAYS` |
| The demo data | `data/seed.ts` |
| Compliance %, work-queues | `lib/analytics.ts` |
| Any AI feature's behaviour | `lib/ai.ts` (one function per feature) |
| Global state / a workflow action | `store/store.tsx` |
| Colours, spacing, the whole look | `styles/global.css` (`:root` tokens) |
| A specific screen | `pages/<Screen>.tsx` |
| Nav / page titles | `components/Layout.tsx` |
| Routes / auth guard | `App.tsx` |

For the line-by-line "what does this function do," see
[FUNCTION-REFERENCE.md](./FUNCTION-REFERENCE.md).
