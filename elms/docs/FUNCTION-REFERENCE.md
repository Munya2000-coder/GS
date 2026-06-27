# ELMS Training Management System — Function & Component Reference

A complete, file-by-file reference for **every function, component, hook, type
and data constant** in the codebase. Use it as a map when you need to find or
change behaviour.

**How to read this**
- Each entry shows a signature, a **Kind** (component / hook / util / type / engine-fn / page / modal), and 1–3 sentences on what it does.
- "Reads from the store" means it calls `useStore()` (see [`src/store/store.tsx`](#srcstorestoretsx)).
- The AI features all live behind one seam — [`src/lib/ai.ts`](#srclibaits). Read that section first if you're here for the AI.

## Contents
1. [Entry & routing](#1-entry--routing) — `main.tsx`, `App.tsx`
2. [Domain model](#2-domain-model) — `data/types.ts`
3. [Seed data](#3-seed-data) — `data/seed.ts`
4. [Domain logic](#4-domain-logic) — `lib/domain.ts`
5. [Analytics](#5-analytics) — `lib/analytics.ts`
6. [AI engine](#6-ai-engine) — `lib/ai.ts`
7. [Store](#7-store) — `store/store.tsx`
8. [UI components](#8-ui-components) — `components/*`
9. [Pages](#9-pages) — `pages/*`

---

# 1. Entry & routing

## `src/main.tsx`
Application bootstrap / entry point.

**Kind:** entry
Mounts the app into `#root` with `ReactDOM.createRoot`, wrapping `App` in `React.StrictMode` → `HashRouter` (hash-based routing, so it runs from `file://` or any static host) → `StoreProvider` (global store context), and imports the global stylesheet. No exported component.

## `src/App.tsx`
Root application component defining the auth guard and the client-side routing table.

### `App() → JSX`
**Kind:** entry / auth guard + router
Reads `user` from the store and the current `location`. **Auth guard:** if there is no `user`, any non-`/login` path redirects to `/login` (preserving the origin in `state.from`); `/login` renders the `Login` page. When authenticated, renders a `Routes` table where every app page renders inside the shared `Layout` route: `/` Dashboard, `/staff` StaffRegister, `/staff/:id` StaffProfile, `/matrix` TrainingMatrix, `/catalogue` ModuleCatalogue, `/evidence` Evidence, `/overdue` Overdue, `/reports` Reports, `/reviews` AnnualReviews, `/incidents` Incidents, `/audit` AuditLog, `/notifications` Notifications, `/users` UserManagement, `/settings` Settings, with a catch-all `*` redirecting to `/`. `ToastHost` is mounted globally.

---

# 2. Domain model

## `src/data/types.ts`
The single source of truth for the ELMS domain model: all enums, entity interfaces, and the derived `ComputedRecord` shape used at render time. Pure type declarations, no runtime code.

### `CqcDomain`
**Kind:** type
Union of the five CQC key questions: `"Safe" | "Effective" | "Caring" | "Responsive" | "Well-Led"`. Used to map every training module to a regulatory domain.

### `RagStatus`
**Kind:** type
Red/Amber/Green traffic-light status plus two neutral states: `"green" | "amber" | "red" | "grey" | "na"`. `green`=in date, `amber`=due soon, `red`=overdue, `grey`=not applicable, `na`=awaiting data/not started.

### `RoleKey`
**Kind:** type
Union of 10 staff role identifiers (`registered_manager`, `compliance_lead`, `training_manager`, `senior_carer`, `care_worker`, `livein_carer`, `personal_assistant`, `office_admin`, `director`, `cqc_reviewer`). Keys into `ROLE_LABELS` for display.

### `AppUser`
**Kind:** interface
The logged-in user: `id`, `name`, `email`, `role: RoleKey`, `roleLabel`, `avatarColor`. Distinct from `Staff` (this is the auth/session identity).

### `ContractType` / `EmploymentStatus`
**Kind:** type
`ContractType`: `"Full-time" | "Part-time" | "Bank" | "Live-in" | "Agency"`. `EmploymentStatus`: `"Active" | "On leave" | "Onboarding" | "Left"`. `"Left"` staff are excluded from record generation and most analytics; `Bank`/`Agency`/`Onboarding` add lapse-risk weight in `ai.ts`.

### `Staff`
**Kind:** interface
A staff member record. Key fields: identity (`firstName`, `lastName`, `email`, `phone`), `role`/`roleLabel`, ISO date strings (`startDate`, `dbsCheckDate`, `dbsExpiry`, `rightToWorkExpiry`, optional `visaExpiry`), `contractType`, `employmentStatus`, `managerId` (nullable self-reference), `branch`, `avatarColor`, optional `notes`.

### `TrainingCategory`
**Kind:** type
Six grouping buckets for modules: `"Mandatory Induction" | "Mandatory Ongoing" | "Role-Specific Training" | "Specialist Care Training" | "Manager / Leadership" | "Compliance & Governance"`.

### `RefreshFrequency`
**Kind:** type
How often a module must be renewed: `"Once only" | "Annual" | "Every 2 years" | "Every 3 years" | "Every 6 months"`. Consumed by `addByFrequency` to compute expiry dates; `"Once only"` yields no expiry (always green once complete).

### `DeliveryMode`
**Kind:** type
`"eLearning" | "Classroom" | "External provider" | "Blended"`. The planner (`aiPlanTraining`) only batches the non-eLearning modes into booking suggestions.

### `TrainingModule`
**Kind:** interface
A catalogue entry. Fields: `id`, `code`, `title`, `category`, `cqcDomain`, `refresh`, `mandatory`, `delivery`, `appliesTo: RoleKey[]` (**empty array = applies to all roles**), `evidenceRequired`, optional `provider`, optional `retired`, `description`.

### `RecordStatus` / `ApprovalStatus`
**Kind:** type
`RecordStatus`: `"completed" | "due_soon" | "overdue" | "not_started" | "na"` (the lifecycle state). `ApprovalStatus`: `"approved" | "pending" | "rejected" | "returned" | "none"` (the evidence-verification workflow state).

### `TrainingRecord`
**Kind:** interface
Links a staff member to a module: `id`, `staffId`, `moduleId`, nullable `completionDate`/`expiryDate` (ISO), `approval`, nullable `evidence`, optional `notes`. This is the raw stored record before RAG is computed.

### `Evidence`
**Kind:** interface
An uploaded certificate: `id`, `fileName`, `fileType: "PDF" | "JPG" | "PNG" | "DOCX"`, `uploadedBy`, `uploadedAt`, `verified` boolean.

### `AuditEntry`
**Kind:** interface
An immutable audit-trail row: `id`, `timestamp`, `user`, `action`, `entity`, optional `field`/`previous`/`next` (for before/after diffs), and a `category` enum (`"training" | "evidence" | "staff" | "matrix" | "review" | "report" | "access"`).

### `AnnualReview`
**Kind:** interface
A matrix-review log entry: `id`, `reviewDate`, `reviewedBy`, `scope`, `changes`, `domains: CqcDomain[]`, `nextReviewDue`, and `status: "Approved" | "Draft" | "Awaiting sign-off"`.

### `NotificationItem`
**Kind:** interface
An alert: `id`, `type` (`"expiry" | "approval" | "review" | "escalation" | "booking" | "system"`), `title`, `body`, `time`, `read`, `channel` (array of `"Email" | "SMS" | "In-system"`), `priority` (`"high" | "medium" | "low"`).

### `ComputedRecord extends TrainingRecord`
**Kind:** interface
The render-time enriched record: a `TrainingRecord` plus its joined `module: TrainingModule` and `staff: Staff`, plus the derived `rag: RagStatus`, `recordStatus: RecordStatus`, and `daysToExpiry: number | null`. **This is the shape every analytics/AI function consumes.**

---

# 3. Seed data

## `src/data/seed.ts`
Generates the entire in-memory demo dataset deterministically (modules, staff, training records, reviews, audit, notifications, org) so the dashboard tells a consistent, offline-safe compliance story anchored to a fixed "today".

### `MODULES`
**Kind:** const (`TrainingModule[]`)
Hand-authored catalogue of 19 training modules (the configurable CQC matrix), e.g. `m-induction` (Care Certificate), `m-safeguard-a`, `m-medication`, `m-lead`. Each has a `code`, `cqcDomain`, `refresh`, `mandatory` flag, `delivery`, `appliesTo` role list (`[]` = all), `evidenceRequired`, and `provider`.

### `color(i)`
**Kind:** util
Returns `COLORS[i % COLORS.length]` from a 15-entry hex palette, cycling colours to assign avatars by staff index.

### `STAFF`
**Kind:** const (`Staff[]`)
The expanded staff register, `rawStaff.map((r, i) => …)`. Each row gets `id = s${i+1}`, `roleLabel` via `ROLE_LABELS`, a generated `email` (`first.last@elmshealth.co.uk`) and `phone`. `dbsCheckDate` is back-derived as `dbsExpiry` minus ~3 years. `managerId` defaults to `"s1"` unless explicitly `null` (Amara, the top manager).

### `appliesToStaff(m, s) → boolean`
**Kind:** util
True if module `m` applies to staff `s` — `m.appliesTo` empty (all) or includes `s.role`. Gates which (staff × module) pairs get a record.

### `planFor(si, mi, mandatory) → Plan`
**Kind:** util
Deterministic status spreader. Hashes indices into `h = (si*7 + mi*13 + si*mi) % 100`, then buckets: `<62` green, `<74` amber, `<84` red-if-mandatory-else-amber, `<90` pending, `<96` notstarted, else rejected. Yields a realistic, reproducible RAG distribution (~62% green).

### `recId() → string`
**Kind:** util
Increments a module-level counter and returns `r${n}`, giving each generated record a stable sequential id.

### `RECORDS`
**Kind:** const (`TrainingRecord[]`)
The generated training records. Loops every active staff × applicable non-retired module, calls `planFor` to pick an outcome, then materializes dates/approval/evidence per case (green = completed 120–200 days ago; amber = expiring within ~15–44 days; red = expired 10–49 days ago; pending/rejected/notstarted as named). Evidence attached only when `module.evidenceRequired`.

### `REVIEWS`, `AUDIT`, `NOTIFICATIONS`
**Kind:** const
Hand-written seed arrays: 3 annual reviews, 9 audit entries (covering every category), 6 notifications (mixed type/priority/read state/channels).

### `ORG`
**Kind:** const
Organisation metadata: `name`, `cqcId`, and `branches` (the four team names).

---

# 4. Domain logic

## `src/lib/domain.ts`
Core domain utilities: the fixed "today" anchor, label/colour lookup tables, date helpers, and the central RAG-status engine (`computeRag`) plus expiry math (`addByFrequency`).

### `TODAY`
**Kind:** const (`Date`)
Hard-coded `new Date("2026-06-27T09:00:00Z")`. The fixed clock that makes all data deterministic. **Change this (or replace with `new Date()`) to make the system live.**

### `DUE_SOON_DAYS`
**Kind:** const (`60`)
The amber window in days: a record expiring within 60 days (and not yet overdue) is amber.

### `ROLE_LABELS` / `CQC_DOMAINS` / `RAG_META`
**Kind:** const
Lookup tables: `RoleKey`→label; the five domains with `{ key, color, blurb }`; per-RAG `{ label, color, bg, ink }` display metadata.

### `cqcColor(d) → string`
**Kind:** util
A domain's hex colour from `CQC_DOMAINS`, falling back to slate `#94a3b8`.

### `daysBetween(a, b) → number`
**Kind:** util
Rounded whole-day difference `(b − a)`; positive when `b` is later.

### `parse(d) → Date | null`
**Kind:** util
ISO string → `Date` (null-safe). If the string is date-only (10 chars) it appends `T00:00:00Z` so values are UTC midnight (avoids timezone drift).

### `daysToExpiry(expiry) → number | null`
**Kind:** util
`daysBetween(TODAY, parse(expiry))`; `null` if no expiry. Negative = overdue.

### `computeRag(record) → { rag, recordStatus, days }`
**Kind:** engine-fn ⭐
**The core RAG engine.** Precedence: (1) `approval` pending/returned → **amber/due_soon** (awaiting verification, regardless of dates); (2) no `completionDate` → **na/not_started**; (3) else by `daysToExpiry`: `null` (once-only) → **green**; `< 0` → **red**; `<= 60` → **amber**; else **green**.

### `addByFrequency(from, freq) → Date | null`
**Kind:** util
Adds a refresh cycle to `from`: once-only → `null`; 6 months/1yr/2yr/3yr otherwise. Used to derive expiry from completion.

### `fmtDate` / `fmtDateLong` / `relativeExpiry` / `initials` / `iso`
**Kind:** util
`fmtDate` → `"02 Aug 2026"`; `fmtDateLong` → `"Sun, 2 August 2026"`; `relativeExpiry(days)` → "N days overdue"/"Due today"/"N days remaining"/"No expiry"; `initials("Amara","Okafor")` → "AO"; `iso(date)` → `YYYY-MM-DD`.

---

# 5. Analytics

## `src/lib/analytics.ts`
Pure aggregation/selector functions over `ComputedRecord[]`: RAG tallies, compliance %, filtered work-queues, and breakdowns by domain/staff/category.

### `ragCounts(records) → RagCounts`
**Kind:** util
Counts records by RAG into `{ green, amber, red, na, total }`. **`grey` records are skipped and excluded from `total`.**

### `compliancePct(records) → number`
**Kind:** util
`round(green / total * 100)`. **Returns 100 when `total` is 0** (no applicable records = compliant). Denominator excludes grey.

### `pendingApprovals(records)` / `overdue(records)` / `dueSoon(records)` / `missingEvidence(records)` → `ComputedRecord[]`
**Kind:** util
The work-queues: pending = `approval==="pending"`; overdue = `rag==="red"` (sorted most-overdue first); dueSoon = `rag==="amber"` AND `recordStatus==="due_soon"` (excludes amber-because-pending); missingEvidence = module requires evidence but none attached.

### `byDomain(records)` / `byStaff(records, staff)` / `byCategory(records)`
**Kind:** util
Breakdowns returning `pct` + `counts` per group. `byDomain` uses the fixed five-domain order; `byStaff` excludes "Left" staff and **sorts ascending by pct** (lowest first — who needs attention); `byCategory` derives categories from the data.

### `ragColor(rag) → string`
**Kind:** util
`RagStatus` → hex colour.

---

# 6. AI engine

## `src/lib/ai.ts`
**The single seam between the UI and "the model."** All AI features are implemented today as grounded, deterministic simulations over the in-memory data (offline-safe), each returning a fixed shape so the bodies can later be swapped for live Claude calls **without any UI change**.

### `think<T>(value, ms = 850) → Promise<T>`
**Kind:** util
Latency simulator: resolves `value` after `ms` via `setTimeout`, so the UI can show a realistic "thinking" state. Every AI function returns through `think(...)`.

### `callClaude(system, prompt, schema?)` *(commented-out seam)*
**Kind:** const (inactive)
The documented **live-swap seam**: a commented `async` helper that would `POST /api/ai` with `{ model: "claude-opus-4-8", system, prompt, schema }`, the server proxying to the Anthropic Messages API with tool/JSON output. To go live, replace each simulation's `think(simulated)` with `callClaude(...)` keeping the same return shape.

### `aiExtractCertificate(rec) → Promise<CertExtraction>`
**Kind:** engine-fn — **Feature 1: Certificate intelligence**
Simulates OCR/verification of a record's certificate. Derives `confidence` (78–98) and accrues `flags` from grounded checks (no document, missing expiry, name mismatch, unapproved provider). `recommendation` is `"return"` (≥2 flags or conf <82), `"review"` (1 flag or conf <90), else `"approve"`. Returns learner/course/provider/dates from the record's staff+module.

### `aiCqcNarrative(records) → Promise<DomainNarrative[]>` & `aiInspectionSummary(records, staffCount) → Promise<string>`
**Kind:** engine-fn — **Feature 2: CQC evidence narrative**
`aiCqcNarrative` writes a grounded sentence per CQC domain (compliance phrased "strong"/"broadly sound"/"area for improvement", plus overdue + due-soon counts). `aiInspectionSummary` writes a one-paragraph readiness verdict from overall compliance and overdue count.

### `aiAnswerQuery(q, records, staff) → Promise<AiAnswer>`
**Kind:** engine-fn — **Feature 3: Ask-your-data**
A grounded NL→query simulator. Narrows the record pool by detected **domain**, **team**, and **module keyword** (each pushes a citation), resolves **intent** (overdue/due-soon/missing-evidence/pending/compliant), and special-cases **DBS/right-to-work/visa** staff queries (expiring within 120 days). Returns ≤12 rows with RAG-coloured tags, a natural-language `text`, and `citations` — never invents records.

### `aiLapseRisk(records, staff) → Promise<RiskScore[]>`
**Kind:** engine-fn — **Feature 4: Predictive lapse risk**
Scores each (non-Left) staff: `overdue*22 + dueSoon*9 + notStarted*7`, +12 for Bank/Agency, +8 for Onboarding (each adds a human-readable driver); capped 99. `band` = high ≥55 / med ≥28 / low. Sorted descending.

### `aiPlanTraining(records) → Promise<BookingSuggestion[]>`
**Kind:** engine-fn — **Feature 5: Smart training planner**
Pools due-soon + overdue, keeps non-eLearning deliveries, groups by module, and emits one group-booking suggestion per module (with a rotating suggested date and a batching rationale). Sorted by staff count.

### `aiDraftReview(modules) → Promise<{changes, domains, scope}>`
**Kind:** engine-fn — **Feature 6: Annual-review co-pilot**
Drafts review `scope`, a `changes` narrative (referencing module count + recent module titles), and the affected CQC `domains`.

### `aiGenerateQuiz(m) → Promise<QuizQ[]>`
**Kind:** engine-fn — **Feature 8: AI knowledge checks**
Selects a canned MCQ set keyed on the module's `cqcDomain`, interpolating the module title into the stems. Each `QuizQ` has `q`, `options[]`, and `answer` (correct index).

### `aiIncidentAnalysis(text, modules) → Promise<IncidentAnalysis>`
**Kind:** engine-fn — **Feature 9: Incident → learning**
Keyword-matches a free-text incident to a `category` + root causes (medication / falls / safeguarding / infection / general fallback) and recommends matching modules via `pick()`. `severity` high on "hospital"/"serious"/"injury", low on "near miss", else medium. Appends three standard corrective actions and the CQC domains.

> Features 7 (new-starter extraction) and 10 (inspector Q&A) reuse the above: extraction is a local `think(sample)` in `StaffRegister`'s `NewStarterAi`; inspector Q&A is the `Assistant` running `aiAnswerQuery`/`aiInspectionSummary` in inspection mode.

The supporting interfaces — `CertExtraction`, `DomainNarrative`, `AiAnswer`, `RiskScore`, `BookingSuggestion`, `QuizQ`, `IncidentAnalysis` — define each feature's return shape, plus `SUGGESTED_QUERIES` (assistant example prompts).

---

# 7. Store

## `src/store/store.tsx`
Central application store: a React Context provider holding all ELMS domain state plus auth, derived data, and all mutating actions. **Every mutation writes an audit entry and surfaces a toast.**

### `StoreProvider({ children }) → JSX`
**Kind:** context provider
Wraps the app, instantiates all state via `useState` (seeded from `../data/seed`), defines every action with `useCallback`, and provides the assembled `StoreShape`. Module-level counters `toastSeq`/`auditSeq`/`idSeq` generate sequential IDs.

### `useStore() → StoreShape`
**Kind:** hook ⭐
Reads the store context; throws if used outside `StoreProvider`. **This is how every page/component accesses state and actions.**

### `computed` (derived selector) → `ComputedRecord[]`
**Kind:** memoized selector
`useMemo` over `records`, joining each to its `module`/`staff` and annotating `rag`/`recordStatus`/`daysToExpiry` via `computeRag`. Records with unresolved module/staff are dropped.

### Actions
**Kind:** util (action)
- `login(u, inspection=false)` / `logout()` — set/clear `user` + `inspectionMode`.
- `approveRecord(recordId)` — `approval:"approved"`, fills completion (today if absent), recomputes expiry via `addByFrequency`, marks evidence verified; audits Pending→Approved + success toast.
- `rejectRecord(recordId, reason)` — `approval:"rejected"`, stores reason in notes; audits + info toast.
- `uploadEvidence(staffId, moduleId, fileName)` — attaches a new unverified PDF and sets the record `pending` (updates existing or appends new); audits + success toast.
- `addStaff(s)` — creates a `Staff` (sequential id, `roleLabel`, cycled avatar colour); audits + toast.
- `addModule(m)` — appends a module (sequential id); audits + toast.
- `toggleModuleRetired(moduleId)` — flips `retired` (no audit/toast).
- `markAllNotificationsRead()` — marks all read.
- `signOffReview(reviewId)` — `status:"Approved"`; audits + toast.
- `pushToast(t)` / `dismissToast(id)` — add (auto-dismiss after 4.2s) / remove a toast.

`logAudit`, `moduleById`, `staffById` are internal helpers. `Toast` = `{ id, kind: "success"|"error"|"info", title, body? }`.

---

# 8. UI components

## `src/components/Icon.tsx`
A self-contained SVG icon registry.

### `Icon({ name, size = 18, className, style, strokeWidth = 2 }) → JSX`
**Kind:** component
Renders an `<svg>` (24×24, `stroke="currentColor"`) whose geometry is looked up by `name` from an internal `paths` map. `IconName` is the union of valid names. ~60 icons available (dashboard, staff, matrix, shield, bell, sparkle, brain, scan, target, etc.). **To add an icon:** add an entry to `paths`.

## `src/components/ui.tsx`
The CSS-class-driven UI primitive library.

### `Avatar`, `Badge`, `RagBadge`, `Card`, `CardHead`, `Button`, `Kpi`, `ProgressRing`, `Donut`, `Meter`, `Empty`, `Modal`, `CqcChip`, `Field`, `Tabs`
**Kind:** component
- `Avatar({first,last,color,size})` — coloured circle with initials.
- `Badge({tone,children,dot})` — pill; tones green/amber/red/grey/blue/violet/outline.
- `RagBadge({rag,label})` — dotted Badge with tone+label mapped from a `RagStatus`.
- `Card` / `CardHead({title,sub,icon,right})` — surface + header row.
- `Button({variant,size,icon,iconRight,block,...})` — variants default/primary/danger/ghost; sizes sm/lg. Passes through native button attrs.
- `Kpi({label,value,icon,tone,trend,sub})` — metric tile with tinted icon and optional trend chip.
- `ProgressRing({value,size,stroke,color,label,sublabel})` — SVG ring gauge; colour auto-thresholds (≥90 green, ≥75 amber, else red).
- `Donut({segments,size,stroke,centerTop,centerBottom})` — multi-segment SVG donut.
- `Meter({value,color})` — horizontal bar with threshold colour.
- `Empty({icon,title,hint})` — empty-state placeholder.
- `Modal({title,icon,onClose,children,footer,drawer,wide})` — centered modal or right `drawer`; Escape + backdrop close.
- `CqcChip({domain,color})` — domain dot + label.
- `Field({label,hint,children})` — labelled form-control wrapper.
- `Tabs<T>({tabs,active,onChange})` — strongly-typed segmented tab bar.

## `src/components/ai.tsx`
AI-themed helpers used by every AI surface.

### `useAiTask<T>(fn) → { loading, data, run, reset }`
**Kind:** hook ⭐
Wraps an async function with `loading`/`data` state. **Stores `fn` in a ref so `run` always invokes the latest closure** (avoids stale props — this was a real bug we fixed). `run()` sets loading, clears data, awaits, stores result; `reset()` clears `data`.

### `AiChip`, `AiPanel`, `AiThinking`, `Confidence`
**Kind:** component
- `AiChip({label})` — sparkle chip.
- `AiPanel({title,sub,children,right,icon})` — the gradient AI panel container (icon ∈ sparkle/brain/scan/target/message/stars).
- `AiThinking({label})` — animated three-dot indicator.
- `Confidence({value})` — labelled confidence bar.

## `src/components/ToastHost.tsx`
### `ToastHost() → JSX`
**Kind:** component
Reads `toasts`/`dismissToast` from the store and renders the global stacked toast list (kind-specific icon, title, body; click to dismiss).

## `src/components/Assistant.tsx`
The floating, grounded AI assistant drawer (Features 3 & 10).

### `Assistant() → JSX`
**Kind:** component
Floating "Ask AI" button (→ "Ask the evidence" in inspection mode) opening a right-side chat drawer. Auto-scrolls, Escape-closes, shows live `compliancePct`, suggested queries, chat bubbles with answer tables + citation chips. Internal `ask(q)` runs `aiAnswerQuery`; `summarise()` runs `aiInspectionSummary`.

## `src/components/Layout.tsx`
The authenticated app shell.

### `Layout() → JSX`
**Kind:** component
Sidebar (four nav groups — Administration hidden in inspection mode; Evidence/Notifications carry count badges), a top bar deriving its title from `PAGE_META[pathname]` (search, notifications, user chip, sign-out), the routed `<Outlet/>`, and the `<Assistant/>`. Internal `renderGroup(label, items)` renders a nav section. **To add a page to the nav:** add a `NavItem` to the relevant group array and an entry to `PAGE_META`.

---

# 9. Pages

## `src/pages/Login.tsx`
Login/landing split-screen (route `/` when unauthenticated) with quick demo sign-in for four `DEMO_USERS` (incl. read-only CQC inspector).

### `Login() → JSX`
**Kind:** page
Marketing panel + sign-in card. Internal `signIn(u)` calls `login(u, u.inspection)`, toasts, and navigates home; `submit(e)` matches the typed email against `DEMO_USERS`.

## `src/pages/Dashboard.tsx`
Home dashboard (route `/`) — org-wide compliance KPIs, RAG donut, CQC-domain meters, overdue action table, quick-actions/lowest-compliance/readiness cards.

### `Dashboard() → JSX`
**Kind:** page
Builds a memoised `stats` object from the `lib/analytics` helpers and renders the widgets. No AI features. Buttons/rows navigate across the app.

## `src/pages/StaffRegister.tsx`
Staff register (route `/staff`) — searchable, role/team-filterable table with compliance meters and DBS/RTW badges.

### `StaffRegister()` · `AddStaffModal` · `NewStarterAi` · `expiryBadge(dateStr, label)`
**Kind:** page / modal / sub-component (AI) / helper
`StaffRegister` filters and lists staff (rows → `/staff/:id`). `AddStaffModal` is the add drawer; `expiryBadge` renders a RAG badge for a DBS/RTW date. **`NewStarterAi`** (Feature 7) simulates scanning onboarding documents via `useAiTask` and calls `onFill` to patch the form.

## `src/pages/StaffProfile.tsx`
Individual staff profile (route `/staff/:id`) — header, compliance KPIs, Training/Documents/Activity tabs.

### `StaffProfile()` · `UploadModal({moduleTitle,onClose,onUpload})`
**Kind:** page / modal
Finds the `:id` person, shows `ProgressRing` compliance and tabbed views. The training tab's evidence button opens `UploadModal` (simulated file picker) which calls `uploadEvidence(...)`.

## `src/pages/TrainingMatrix.tsx`
Training matrix (route `/matrix`) — scrollable staff-by-module RAG grid with domain/team filters and click-through detail.

### `TrainingMatrix()` · `CellMark` · `CellDetail` · `Row` · `appliesTo(m,s)`
**Kind:** page / sub-component / modal / helper
Builds a `staffId:moduleId` lookup and renders the grid. `CellMark` renders the per-cell glyph (RAG icon / pending clock / rejected x / dash); `CellDetail` is the record modal; `Row` is a label/value line.

## `src/pages/ModuleCatalogue.tsx`
Module catalogue (route `/catalogue`) — category-filtered module cards with retire/reactivate toggles.

### `ModuleCatalogue()` · `QuizModal` · `AddModuleModal` · `usage(moduleId)`
**Kind:** page / modal (AI) / modal / helper
Renders module cards with `usage` counts. **`QuizModal`** (Feature 8) runs `aiGenerateQuiz`, tracks answer picks, and auto-marks. `AddModuleModal` is the create-module drawer (role toggle list, `appliesTo`).

## `src/pages/Evidence.tsx`
Certificate approval workflow (route `/evidence`).

### `Evidence()` · `AiTriage` · `CertAiModal` · `RejectModal` · `recBadgeTone` · `recLabel`
**Kind:** page / sub-component (AI) / modal (AI) / modal / helper
`Evidence` groups evidence-bearing records by approval status into tabs. **`AiTriage`** (Feature 1) batch-runs `aiExtractCertificate` across pending records and offers "Apply N approvals"; **`CertAiModal`** runs the same per record with a confidence bar + recommendation; `RejectModal` captures a return reason (with presets).

## `src/pages/Overdue.tsx`
Proactive renewal planning (route `/overdue`) — overdue/due-soon/missing-evidence tabs + reminder schedule.

### `Overdue()` · `LapseRiskAi` · `TrainingPlannerAi`
**Kind:** page / sub-component (AI) / sub-component (AI)
`Overdue` shows the three work-queues and the `REMINDER_STAGES` schedule. **`LapseRiskAi`** (Feature 4) runs `aiLapseRisk` and lists top-risk staff; **`TrainingPlannerAi`** (Feature 5) runs `aiPlanTraining` and lists group-booking suggestions with a "Book" action.

## `src/pages/Reports.tsx`
Reports & CQC export (route `/reports`) — readiness banner, report grid, inspector access.

### `Reports()` · `CqcNarrativeAi` · `InspectionAccessModal` · `exportAs(report,fmt)`
**Kind:** page / sub-component (AI) / modal / helper
`Reports` renders the `REPORTS` grid (PDF/Excel/CSV/Preview → `exportAs` toast). **`CqcNarrativeAi`** (Feature 2) runs `aiInspectionSummary` + `aiCqcNarrative` and offers "Add to pack". `InspectionAccessModal` creates a time-limited read-only inspector account (Feature 10's access side).

## `src/pages/AnnualReviews.tsx`
Annual-review governance log (route `/reviews`) — timeline with sign-off.

### `AnnualReviews()` · `AddReviewModal`
**Kind:** page / modal (AI)
`AnnualReviews` lists reviews and lets you `signOffReview`. **`AddReviewModal`** (Feature 6) hosts an AI draft: `aiDraftReview(modules)` populates scope/changes/domains via `useEffect`.

## `src/pages/AuditLog.tsx`
Tamper-evident audit trail (route `/audit`) with category filtering.

### `AuditLog()` · `fmtTs(ts)`
**Kind:** page / helper
Filterable table of when/user/action/entity/change (previous→next diff) with a category badge from `CAT_META`.

## `src/pages/Notifications.tsx`
Multi-channel notification feed (route `/notifications`).

### `Notifications()` · `ago(ts)`
**Kind:** page / helper
Renders each notification with type icon/tone (`TYPE_META`), priority badge, unread highlight, timestamp, and per-channel icons (`CHANNEL_ICON`). "Mark all read" calls `markAllNotificationsRead`.

## `src/pages/UserManagement.tsx`
Role-based access control (route `/users`).

### `UserManagement() → JSX`
**Kind:** page
KPIs + the `ROLE_PERMISSIONS` reference list + the active user-accounts table. "Invite user" toasts.

## `src/pages/Settings.tsx`
Settings (route `/settings`) — tabbed org / reminder timings / notification channels / compliance rules.

### `Settings()` · `Toggle({on,onClick})`
**Kind:** page / sub-component
`Settings` holds tab + `toggles` state; org/reminder fields are mostly uncontrolled `defaultValue` inputs seeded from `ORG`/`user`. `Toggle` is the pill switch. "Save changes" toasts.

## `src/pages/Incidents.tsx`
Incident reporting & learning (route `/incidents`) — Feature 9.

### `Incidents()` · `logIt()` · `sevTone(s)`
**Kind:** page (AI) / helper / helper
Reporter card (textarea + presets + "Analyse with AI") runs `aiIncidentAnalysis(text, modules)` and renders severity/category/domains/root-causes/recommended-training/corrective-actions, plus a timeline log. `logIt` prepends the analysed incident; `sevTone` maps severity to a badge tone.
