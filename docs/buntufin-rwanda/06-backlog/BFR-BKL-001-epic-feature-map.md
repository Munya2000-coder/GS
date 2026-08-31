# BFR-BKL-001 — Backlog: Epic → Feature → Story Map

**Realises URS §30 Step 6 and the §28 backlog generation rule.**

---

## 1. How this backlog is structured

URS §28 mandates this shape:

```
EPIC
  FEATURE
    USER STORY
      ACCEPTANCE CRITERIA
      API IMPACT
      DATA IMPACT
      SECURITY IMPACT
      AUDIT IMPACT
      TESTS
```

This document holds the **EPIC → FEATURE → STORY** layers. The five detail
layers beneath each story live in the FDS, one block per requirement, so there
is exactly one place where any given detail is written:

| URS §28 layer | Where it lives |
|---|---|
| EPIC, FEATURE | This document |
| USER STORY | This document (id) and the FDS block (full text with Given/When/Then) |
| ACCEPTANCE CRITERIA | FDS block — *Acceptance (URS)* plus *Business rules* |
| API IMPACT | FDS block — *API* |
| DATA IMPACT | FDS block — *Data* |
| SECURITY IMPACT | FDS block — *Business rules* and *Security & audit* |
| AUDIT IMPACT | FDS block — *Audit* |
| TESTS | FDS block — *Tests* table, and `rtm.csv` |

**Backlog totals:** 30 epics · 121 features · 300 stories · 1,382 test cases.

Story ids follow the requirement they realise: `BFR-CIR-001` → `US-CIR-001`.
This is deliberate — it makes the traceability rule self-enforcing, because a
story that cannot be named cannot exist.

---

## 2. Release sequencing

Waves are from `BFR-ANA-001` §1.3. A wave does not start until the previous
wave's gate is demonstrated.

| Wave | Epics | Stories | Gate before the next wave |
|---|---|---:|---|
| **W1 Foundation** | GOV, USR, ID, CON, LED | 50 | Ledger balances under concurrency; audit provably append-only; maker-checker enforced; consent on every data read |
| **W2 Inclusion core** | OF, CAT, FP, FPS, FH | 50 | Every Passport metric carries provenance, version and a deterministic explanation |
| **W3 Economic activity** | PAY, BIZ, SAV, CIR, CG, INV | 60 | Payment state machine and idempotency proven; Circle history immutable; verified/self-reported split intact |
| **W4 Access marketplace** | CAP, CAF, PRT | 30 | Provider named on every surface; no BuntuFin lending representation; commission out of ranking |
| **W5 Cross-border** | XB, FX, GOAL | 30 | Quote expiry enforced; rounding reproducible; screening unbypassable |
| **W6 Regulatory operations** | AML, FRD, CMP, REC, RPT, ADM, NOT | 70 | Sandbox KPI pack producible end to end |
| **Continuous** | NFR | 10 | Verified in CI from W1 onward, never as a wave |

`PRT` is listed in W4 but its foundations (partner profiles, credentials,
scoping) are needed from W1 for `GOV-002` provider attribution; it is built
incrementally.

---

## 3. Epic and feature map

### W1 — Foundation

**`EPIC-GOV` Controlled, auditable, country-aware platform configuration**
| Feature | Stories |
|---|---|
| `F-GOV-1` Configuration registry and resolution | `US-GOV-001`, `US-GOV-006`, `US-GOV-007` |
| `F-GOV-2` Product and provider catalogue | `US-GOV-002`, `US-GOV-003` |
| `F-GOV-3` Feature flags and cohorts | `US-GOV-004`, `US-GOV-005`, `US-GOV-009` |
| `F-GOV-4` Change control and audit | `US-GOV-008`, `US-GOV-010` |

**`EPIC-USR` Correct people, correct access, provable**
| Feature | Stories |
|---|---|
| `F-USR-1` Customer and business identity | `US-USR-001`, `US-USR-002`, `US-USR-007` |
| `F-USR-2` Access control | `US-USR-004`, `US-USR-005`, `US-USR-006` |
| `F-USR-3` Delegation and partner staff | `US-USR-003`, `US-USR-008`, `US-USR-009` |
| `F-USR-4` Privileged access accountability | `US-USR-010` |

**`EPIC-ID` Verified financial identity for the underserved**
| Feature | Stories |
|---|---|
| `F-ID-1` Registration and contact verification | `US-ID-001`, `US-ID-002` |
| `F-ID-2` Identity capture and verification | `US-ID-003`, `US-ID-004`, `US-ID-005`, `US-ID-009` |
| `F-ID-3` Tiering and privileges | `US-ID-006`, `US-ID-007` |
| `F-ID-4` Integrity and lifecycle | `US-ID-008`, `US-ID-010` |

**`EPIC-CON` The customer decides, and it is provable**
| Feature | Stories |
|---|---|
| `F-CON-1` Granting consent | `US-CON-001`, `US-CON-002`, `US-CON-003`, `US-CON-004` |
| `F-CON-2` Withdrawing consent | `US-CON-005`, `US-CON-006` |
| `F-CON-3` Consent visibility | `US-CON-007`, `US-CON-008`, `US-CON-009` |
| `F-CON-4` Consent versioning | `US-CON-010` |

**`EPIC-LED` A financial record that cannot be quietly altered**
| Feature | Stories |
|---|---|
| `F-LED-1` Double-entry posting | `US-LED-001`, `US-LED-006`, `US-LED-009` |
| `F-LED-2` Immutability and correction | `US-LED-002`, `US-LED-003` |
| `F-LED-3` Holds and pending state | `US-LED-004`, `US-LED-008` |
| `F-LED-4` Precision and traceability | `US-LED-005`, `US-LED-007`, `US-LED-010` |

### W2 — Financial inclusion core

**`EPIC-OF` One trustworthy view of a customer's financial life**
| Feature | Stories |
|---|---|
| `F-OF-1` Account connection | `US-OF-001`, `US-OF-010` |
| `F-OF-2` Provider adapters | `US-OF-002`, `US-OF-003`, `US-OF-004` |
| `F-OF-3` Ingestion and normalisation | `US-OF-005`, `US-OF-006`, `US-OF-009` |
| `F-OF-4` Sync resilience and visibility | `US-OF-007`, `US-OF-008` |

**`EPIC-CAT` Understandable, correctable, versioned classification**
| Feature | Stories |
|---|---|
| `F-CAT-1` Classification engine | `US-CAT-001`, `US-CAT-002`, `US-CAT-010` |
| `F-CAT-2` Customer correction | `US-CAT-003` |
| `F-CAT-3` Semantic classification | `US-CAT-004`, `US-CAT-005`, `US-CAT-006`, `US-CAT-007` |
| `F-CAT-4` Model governance | `US-CAT-008`, `US-CAT-009` |

**`EPIC-FP` A defensible financial identity for people without a credit file**
| Feature | Stories |
|---|---|
| `F-FP-1` Passport generation and eligibility | `US-FP-001`, `US-FP-002`, `US-FP-003` |
| `F-FP-2` Metric engine | `US-FP-004`, `US-FP-005`, `US-FP-006`, `US-FP-007` |
| `F-FP-3` Explainability | `US-FP-008` |
| `F-FP-4` Versioning and honest framing | `US-FP-009`, `US-FP-010` |

**`EPIC-FPS` The customer controls who sees their financial evidence**
| Feature | Stories |
|---|---|
| `F-FPS-1` Creating a share | `US-FPS-001`, `US-FPS-002`, `US-FPS-005` |
| `F-FPS-2` Limiting a share | `US-FPS-003`, `US-FPS-004`, `US-FPS-007` |
| `F-FPS-3` Visibility of access | `US-FPS-006` |
| `F-FPS-4` Export and freshness | `US-FPS-008`, `US-FPS-009`, `US-FPS-010` |

**`EPIC-FH` Guidance, never a hidden credit decision**
| Feature | Stories |
|---|---|
| `F-FH-1` Health dimensions | `US-FH-001`, `US-FH-003`, `US-FH-004`, `US-FH-005` |
| `F-FH-2` Explainability and provenance | `US-FH-002`, `US-FH-008` |
| `F-FH-3` Honest guidance and separation from underwriting | `US-FH-006`, `US-FH-007` |
| `F-FH-4` Challenge and methodology governance | `US-FH-009`, `US-FH-010` |

### W3 — Economic activity

**`EPIC-PAY` Payments that are correct and honest about their state**
| Feature | Stories |
|---|---|
| `F-PAY-1` Position and initiation | `US-PAY-001`, `US-PAY-002`, `US-PAY-003` |
| `F-PAY-2` QR acceptance | `US-PAY-004` |
| `F-PAY-3` Confirmation and disclosure | `US-PAY-005`, `US-PAY-006` |
| `F-PAY-4` State, integrity and evidence | `US-PAY-007`, `US-PAY-008`, `US-PAY-009`, `US-PAY-010` |

**`EPIC-BIZ` Make an informal business visible, honestly**
| Feature | Stories |
|---|---|
| `F-BIZ-1` Business identity | `US-BIZ-001`, `US-BIZ-002`, `US-BIZ-003` |
| `F-BIZ-2` Accepting payment | `US-BIZ-004`, `US-BIZ-005` |
| `F-BIZ-3` Recording trade | `US-BIZ-006`, `US-BIZ-007` |
| `F-BIZ-4` Business insight | `US-BIZ-008`, `US-BIZ-009`, `US-BIZ-010` |

**`EPIC-SAV` Automated saving the customer chose and can stop**
| Feature | Stories |
|---|---|
| `F-SAV-1` Goals | `US-SAV-001`, `US-SAV-010` |
| `F-SAV-2` Saving rules | `US-SAV-002`, `US-SAV-003`, `US-SAV-004`, `US-SAV-007` |
| `F-SAV-3` Customer control | `US-SAV-005`, `US-SAV-006`, `US-SAV-008` |
| `F-SAV-4` Provider transparency | `US-SAV-009` |

**`EPIC-CIR` Digitised group savings that members can trust**
| Feature | Stories |
|---|---|
| `F-CIR-1` Circle setup and models | `US-CIR-001`, `US-CIR-002`, `US-CIR-003` |
| `F-CIR-2` Membership and rules | `US-CIR-004`, `US-CIR-005`, `US-CIR-009`, `US-CIR-010` |
| `F-CIR-3` Contributions | `US-CIR-006` |
| `F-CIR-4` Transparency and integrity | `US-CIR-007`, `US-CIR-008` |

**`EPIC-CG` Group decisions that cannot be quietly overridden**
| Feature | Stories |
|---|---|
| `F-CG-1` Voting and approvals | `US-CG-001`, `US-CG-002`, `US-CG-003` |
| `F-CG-2` Payout governance | `US-CG-004`, `US-CG-005`, `US-CG-010` |
| `F-CG-3` Member communication | `US-CG-006`, `US-CG-007` |
| `F-CG-4` Passport contribution and disputes | `US-CG-008`, `US-CG-009` |

**`EPIC-INV` Light stock tools that never block a payment**
| Feature | Stories |
|---|---|
| `F-INV-1` Catalogue and stock | `US-INV-001`, `US-INV-002`, `US-INV-009` |
| `F-INV-2` Sale integration | `US-INV-003`, `US-INV-004`, `US-INV-010` |
| `F-INV-3` Reordering | `US-INV-005`, `US-INV-006` |
| `F-INV-4` Suppliers | `US-INV-007`, `US-INV-008` |

### W4 — Access marketplace

**`EPIC-CAP` A marketplace honest about who lends and why offers are ordered**
| Feature | Stories |
|---|---|
| `F-CAP-1` Funding request | `US-CAP-001`, `US-CAP-003`, `US-CAP-004` |
| `F-CAP-2` Provider transparency | `US-CAP-002`, `US-CAP-008` |
| `F-CAP-3` Prequalification and submission | `US-CAP-005`, `US-CAP-006` |
| `F-CAP-4` Offers and fair comparison | `US-CAP-007`, `US-CAP-009`, `US-CAP-010` |

**`EPIC-CAF` The provider decides; the platform records faithfully**
| Feature | Stories |
|---|---|
| `F-CAF-1` Information exchange | `US-CAF-001`, `US-CAF-002` |
| `F-CAF-2` Decision recording | `US-CAF-003`, `US-CAF-004` |
| `F-CAF-3` Offer and disbursement | `US-CAF-005`, `US-CAF-006`, `US-CAF-009` |
| `F-CAF-4` Post-disbursement | `US-CAF-007`, `US-CAF-008`, `US-CAF-010` |

**`EPIC-PRT` Controlled, scoped, revocable partner access**
| Feature | Stories |
|---|---|
| `F-PRT-1` Partner onboarding | `US-PRT-001`, `US-PRT-002`, `US-PRT-009` |
| `F-PRT-2` Partner access | `US-PRT-004`, `US-PRT-005`, `US-PRT-007` |
| `F-PRT-3` Lifecycle and health | `US-PRT-003`, `US-PRT-006`, `US-PRT-010` |
| `F-PRT-4` Commercial versioning | `US-PRT-008` |

### W5 — Cross-border

**`EPIC-XB` Send money with a known landed amount and a known outcome**
| Feature | Stories |
|---|---|
| `F-XB-1` Corridors | `US-XB-001` |
| `F-XB-2` Quoting and disclosure | `US-XB-002`, `US-XB-003`, `US-XB-004`, `US-XB-005`, `US-XB-006`, `US-XB-007` |
| `F-XB-3` Compliance gating | `US-XB-008` |
| `F-XB-4` Execution and recovery | `US-XB-009`, `US-XB-010` |

**`EPIC-FX` Route selection that is explainable and not margin-driven**
| Feature | Stories |
|---|---|
| `F-FX-1` Rate sourcing | `US-FX-001`, `US-FX-007`, `US-FX-008` |
| `F-FX-2` Route evaluation | `US-FX-002`, `US-FX-003`, `US-FX-004` |
| `F-FX-3` Decision evidence | `US-FX-005`, `US-FX-010` |
| `F-FX-4` Operational control | `US-FX-006`, `US-FX-009` |

**`EPIC-GOAL` Remittance directed at a purpose, with an honest control model**
| Feature | Stories |
|---|---|
| `F-GOAL-1` Purpose and allocation | `US-GOAL-001`, `US-GOAL-002`, `US-GOAL-007` |
| `F-GOAL-2` Shared goals | `US-GOAL-003`, `US-GOAL-004` |
| `F-GOAL-3` Direct institution payment | `US-GOAL-005`, `US-GOAL-006` |
| `F-GOAL-4` Leg integrity and evidence | `US-GOAL-008`, `US-GOAL-009`, `US-GOAL-010` |

### W6 — Regulatory operations

**`EPIC-AML` Detect, investigate and evidence, under strict access control**
| Feature | Stories |
|---|---|
| `F-AML-1` Screening | `US-AML-001`, `US-AML-002` |
| `F-AML-2` Transaction monitoring | `US-AML-003`, `US-AML-004`, `US-AML-005` |
| `F-AML-3` Case management | `US-AML-006`, `US-AML-007`, `US-AML-008`, `US-AML-009` |
| `F-AML-4` Access control | `US-AML-010` |

**`EPIC-FRD` Stop fraud without deleting evidence or locking out customers**
| Feature | Stories |
|---|---|
| `F-FRD-1` Risk signals | `US-FRD-001`, `US-FRD-002`, `US-FRD-003`, `US-FRD-004` |
| `F-FRD-2` Scoring and intervention | `US-FRD-005`, `US-FRD-006`, `US-FRD-007` |
| `F-FRD-3` Disposition and tuning | `US-FRD-008`, `US-FRD-009` |
| `F-FRD-4` Evidence preservation | `US-FRD-010` |

**`EPIC-CMP` Every customer can be heard, on the clock, with a recorded outcome**
| Feature | Stories |
|---|---|
| `F-CMP-1` Raising a complaint | `US-CMP-001`, `US-CMP-002`, `US-CMP-003`, `US-CMP-004` |
| `F-CMP-2` SLA and visibility | `US-CMP-005`, `US-CMP-006` |
| `F-CMP-3` Investigation and resolution | `US-CMP-007`, `US-CMP-008`, `US-CMP-009` |
| `F-CMP-4` Regulatory reporting | `US-CMP-010` |

**`EPIC-REC` Prove that what we recorded is what actually happened**
| Feature | Stories |
|---|---|
| `F-REC-1` Ingestion and matching | `US-REC-001`, `US-REC-002`, `US-REC-009` |
| `F-REC-2` Exception detection | `US-REC-003`, `US-REC-004`, `US-REC-005`, `US-REC-006` |
| `F-REC-3` Exception workflow | `US-REC-007`, `US-REC-008` |
| `F-REC-4` Reporting | `US-REC-010` |

**`EPIC-RPT` The evidence pack the sandbox is judged on**
| Feature | Stories |
|---|---|
| `F-RPT-1` Participation and adoption | `US-RPT-001`, `US-RPT-002`, `US-RPT-003` |
| `F-RPT-2` Product outcomes | `US-RPT-004`, `US-RPT-005`, `US-RPT-006` |
| `F-RPT-3` Movement and access outcomes | `US-RPT-007`, `US-RPT-008` |
| `F-RPT-4` Conduct metrics and export | `US-RPT-009`, `US-RPT-010` |

**`EPIC-ADM` Staff can operate the platform, and everything they do is visible**
| Feature | Stories |
|---|---|
| `F-ADM-1` Secure access | `US-ADM-001`, `US-ADM-003`, `US-ADM-004` |
| `F-ADM-2` Operational visibility | `US-ADM-002`, `US-ADM-005` |
| `F-ADM-3` Controlled intervention | `US-ADM-006`, `US-ADM-007`, `US-ADM-008`, `US-ADM-009` |
| `F-ADM-4` Accountability | `US-ADM-010` |

**`EPIC-NOT` Tell people what matters, in their language, unsuppressibly**
| Feature | Stories |
|---|---|
| `F-NOT-1` Channels | `US-NOT-001`, `US-NOT-002`, `US-NOT-003` |
| `F-NOT-2` Content management | `US-NOT-004` |
| `F-NOT-3` Preferences and classification | `US-NOT-005`, `US-NOT-006` |
| `F-NOT-4` Event-driven notices and delivery evidence | `US-NOT-007`, `US-NOT-008`, `US-NOT-009`, `US-NOT-010` |

### Continuous

**`EPIC-NFR` The properties every feature must hold**
| Feature | Stories |
|---|---|
| `F-NFR-1` Data protection | `US-NFR-001`, `US-NFR-002`, `US-NFR-003` |
| `F-NFR-2` API integrity | `US-NFR-004`, `US-NFR-005` |
| `F-NFR-3` Evidence integrity | `US-NFR-006` |
| `F-NFR-4` Performance and availability | `US-NFR-007`, `US-NFR-008` |
| `F-NFR-5` Verification and traceability | `US-NFR-009`, `US-NFR-010` |

---

## 4. Stories blocked by an open question

These stories are designed and in the backlog but **must not be started** until
their question in [`BFR-ANA-002`](../01-analysis/BFR-ANA-002-open-questions.md)
is answered. They are flagged in the backlog tool with the question id.

| Question | Blocked stories |
|---|---|
| `Q-01` / `Q-02` regulatory status and fund holding | `US-GOV-002`, `US-PAY-001`, `US-SAV-009`, `US-CAP-002`, all of `F-LED-*` legal semantics, all of `EPIC-REC` |
| `Q-09` Passport as regulated credit information | all of `EPIC-FP`, `EPIC-FPS` |
| `Q-08` credit reference obligations | `US-CAP-005`, `US-CAF-003`, `US-CAF-007`, `US-CAF-008` |
| `Q-10` corridor rules | all of `EPIC-XB`, `EPIC-FX`, `EPIC-GOAL` |
| `Q-06` / `Q-07` AML reporting and list sources | `US-AML-001`, `US-AML-002`, `US-RPT-009` |
| `Q-12` / `Q-13` fee model and FX margin disclosure | `US-PAY-006`, `US-XB-004`, `US-XB-005` |
| `Q-11` currency scale | `F-LED-4` currency reference seed |
| `Q-14` expiry after funding | `US-XB-007` recovery path |

Stories gated only on a **PARAMETERISED** value (`Q-04`, `Q-05`, `Q-15`, `Q-16`,
`Q-17`, `Q-18`) are **not** blocked: they are built with the value held as a
`PLACEHOLDER` configuration entry that fails the pre-production gate.

Stories gated on a **CONTRACT-PENDING** partner API (`Q-19`–`Q-28`) are built
against the adapter interface and its simulator; only the production adapter
waits.

---

## 5. Definition of done (every story)

A story is done when all of the following hold. This is the same list the
release gate checks, so "done" and "releasable" do not diverge.

1. Acceptance criteria from the FDS block are met.
2. All test cases for the requirement pass, in every mandated category.
3. Financial stories additionally pass concurrency, idempotency, reversal, reconciliation and decimal tests (URS §26).
4. The API route declares `x-urs-requirements`; the test declares `@urs(...)`.
5. Audit events are emitted and verified by the audit test.
6. Permissions are enforced server-side and verified by the permissions test.
7. No user-facing string is embedded in business logic; all three languages resolve (URS §18).
8. No monetary value uses a floating-point type (`LED-005`, static analysis).
9. The RTM regenerates with the requirement traced and its tests passing.
10. No configuration key the story depends on is still `PLACEHOLDER`, or the story is explicitly flagged as gated.
