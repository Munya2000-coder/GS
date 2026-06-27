# ELMS — Architecture at a Glance

A one-page mental model. For setup and editing see
[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md); for every function see
[FUNCTION-REFERENCE.md](./FUNCTION-REFERENCE.md).

---

## The big picture

```
                          ┌─────────────────────────────┐
                          │        data/seed.ts         │
                          │  MODULES · STAFF · RECORDS   │  deterministic, fixed
                          │  REVIEWS · AUDIT · NOTIFS    │  to TODAY (2026-06-27)
                          └──────────────┬──────────────┘
                                         │ initial state
                                         ▼
                          ┌─────────────────────────────┐
                          │      store/store.tsx        │
                          │  useState: staff, modules,  │
                          │  records, reviews, audit,   │◀── actions mutate state,
                          │  notifications, user, …     │    write AUDIT + toast
                          │                             │
                          │  computed = useMemo(        │
                          │    records.map(computeRag)  │──┐ joins module+staff,
                          │  )                          │  │ derives rag/status/days
                          └──────────────┬──────────────┘  │
                                         │ useStore()       │ uses lib/domain.ts
                                         ▼                  ▼
   ┌──────────────┐   reads    ┌──────────────────┐   ┌──────────────────┐
   │   pages/*    │◀───────────│   computed[]     │   │   lib/domain.ts  │
   │  (screens)   │            │ ComputedRecord[] │   │  computeRag()    │
   │              │──┐         └──────────────────┘   │  addByFrequency  │
   └──────────────┘  │  calls                          │  date helpers    │
          │          ▼                                 └──────────────────┘
          │   ┌──────────────────┐   ┌──────────────────┐
          │   │ lib/analytics.ts │   │    lib/ai.ts     │  ★ AI seam
          │   │ compliancePct    │   │ aiExtractCert…   │  simulated today,
          │   │ overdue/dueSoon  │   │ aiAnswerQuery…   │  callClaude() to go live
          │   │ byDomain/byStaff │   │ (returns fixed   │
          │   └──────────────────┘   │  shapes)         │
          │                          └──────────────────┘
          ▼ renders with
   ┌──────────────────────────────────────────────────────┐
   │ components/ui.tsx · ai.tsx · Icon.tsx · Layout ·      │
   │ Assistant · ToastHost   (presentational, class-based) │
   └──────────────────────────────────────────────────────┘
                         styled by styles/global.css
```

## Key ideas

1. **One source of truth for state** — the Context store. Pages never hold domain
   data of their own; they read `useStore()` and call actions. This keeps the
   audit trail and toasts consistent for every change.

2. **`computed` is the join + RAG layer.** Raw `TrainingRecord`s are joined to
   their `module`/`staff` and run through `computeRag` once, in a `useMemo`.
   Everything downstream (pages, analytics, AI) consumes the enriched
   `ComputedRecord[]`. Change `computeRag` and the whole app updates.

3. **Pure logic is separated from UI.** `lib/domain.ts` (status + dates),
   `lib/analytics.ts` (aggregations), and `lib/ai.ts` (AI) are framework-free
   functions — easy to reason about and unit-test. Pages are thin.

4. **The AI seam.** Every AI feature has a fixed return shape and currently
   resolves a grounded simulation through `think()`. Swapping in `callClaude()`
   (a server proxy to the Anthropic Messages API) makes them live with **zero UI
   changes**. The grounded query assistant is designed to cite real records and
   never invent data.

5. **Determinism.** A fixed `TODAY` and hash-based seed (`planFor`) make the demo
   reproducible and offline-safe — the same compliance story every load.

## Request lifecycle of a typical action

`Manager clicks "Approve"` → `Evidence.tsx` calls `approveRecord(id)` →
store updates the record (`approval: approved`, recompute expiry via
`addByFrequency`, verify evidence) → writes an `AuditEntry` → pushes a success
`Toast` → `computed` re-memoizes → the matrix cell, dashboard %, and audit log
all re-render from the new state.
