# BuntuFin Rwanda — Controlled Programme Documentation

**Programme:** BuntuFin Financial Inclusion Platform (Rwanda)
**Controlling baseline:** `BFR-URS-001 v1.0 Draft` (300 requirements)
**Lifecycle:** Regulatory Sandbox → Controlled Production → National/Regional Scale

---

## 1. The traceability rule

> **No functionality may be created — in code, database, API, UI or test — without
> referencing its originating `BFR-xxx-nnn` requirement ID.**

This rule is binding on every contributor, human or automated. Concretely:

| Artefact | Mandatory reference |
|---|---|
| Git branch | `feat/BFR-<DOMAIN>-<NNN>-<slug>` |
| Commit message | first line contains at least one `BFR-` ID |
| Pull request | `Implements: BFR-xxx-nnn[, ...]` in the body |
| Source module / class | docstring or header comment lists the IDs it realises |
| Database migration | migration docstring lists the IDs it realises |
| API route | OpenAPI `x-urs-requirements: [BFR-...]` extension |
| Automated test | test name or marker carries the test case ID `TC-<DOMAIN>-<NNN>-<n>` |

Anything that cannot cite a requirement ID is **scope drift** and must either be
raised as a URS change request (with impact assessment, per URS §1) or removed.

---

## 2. Document set

| Ref | Document | Purpose | URS step |
|---|---|---|---|
| `BFR-URS-001` | [00-urs/BFR-URS-001-baseline.md](00-urs/BFR-URS-001-baseline.md) | Controlled requirement baseline — all 300 IDs | — |
| `BFR-ANA-001` | [01-analysis/BFR-ANA-001-urs-analysis.md](01-analysis/BFR-ANA-001-urs-analysis.md) | Dependency analysis, ambiguities, regulatory assumptions | Step 1 |
| `BFR-ANA-002` | [01-analysis/BFR-ANA-002-open-questions.md](01-analysis/BFR-ANA-002-open-questions.md) | **Stop-list** — requirements that cannot be built without a decision | Step 1 / §30 |
| `BFR-ARC-001` | [02-architecture/BFR-ARC-001-c4-context.md](02-architecture/BFR-ARC-001-c4-context.md) | C4 Level 1 — system context | Step 2 |
| `BFR-ARC-002` | [02-architecture/BFR-ARC-002-c4-container.md](02-architecture/BFR-ARC-002-c4-container.md) | C4 Level 2 — containers | Step 2 |
| `BFR-ARC-003` | [02-architecture/BFR-ARC-003-c4-component.md](02-architecture/BFR-ARC-003-c4-component.md) | C4 Level 3 — components of critical containers | Step 2 |
| `BFR-ARC-004` | [02-architecture/BFR-ARC-004-bounded-contexts.md](02-architecture/BFR-ARC-004-bounded-contexts.md) | Service / module boundaries and ownership | Step 4 |
| `BFR-DAT-001` | [03-data-model/BFR-DAT-001-erd.md](03-data-model/BFR-DAT-001-erd.md) | Entity relationship model | Step 3 |
| `BFR-DAT-002` | [03-data-model/BFR-DAT-002-entity-dictionary.md](03-data-model/BFR-DAT-002-entity-dictionary.md) | Field-level data dictionary | Step 3 |
| `BFR-STD-001` | [04-standards/BFR-STD-001-state-machines.md](04-standards/BFR-STD-001-state-machines.md) | Financial state machines (URS §5) | — |
| `BFR-STD-002` | [04-standards/BFR-STD-002-event-catalogue.md](04-standards/BFR-STD-002-event-catalogue.md) | Domain event catalogue (URS §12) | — |
| `BFR-STD-003` | [04-standards/BFR-STD-003-adapter-interfaces.md](04-standards/BFR-STD-003-adapter-interfaces.md) | External service adapter contracts (URS §13) | — |
| `BFR-STD-004` | [04-standards/BFR-STD-004-api-standards.md](04-standards/BFR-STD-004-api-standards.md) | API versioning, security, idempotency, errors (URS §14–15) | — |
| `BFR-STD-005` | [04-standards/BFR-STD-005-authentication-policy.md](04-standards/BFR-STD-005-authentication-policy.md) | Authentication and session policy (URS §4) | — |
| `BFR-STD-006` | [04-standards/BFR-STD-006-data-retention-and-rights.md](04-standards/BFR-STD-006-data-retention-and-rights.md) | Retention schedule and data-subject rights (URS §16–17) | — |
| `BFR-STD-007` | [04-standards/BFR-STD-007-localisation-ussd-accessibility.md](04-standards/BFR-STD-007-localisation-ussd-accessibility.md) | Localisation, USSD, accessibility (URS §18–20) | — |
| `BFR-STD-008` | [04-standards/BFR-STD-008-security-monitoring-bcp.md](04-standards/BFR-STD-008-security-monitoring-bcp.md) | Security monitoring, BCP, backup, environments, CI/CD (URS §21–25) | — |
| `BFR-STD-009` | [04-standards/BFR-STD-009-test-strategy.md](04-standards/BFR-STD-009-test-strategy.md) | Test categories and evidence standard (URS §26) | Step 13 |
| `BFR-FDS-nn` | [05-fds/](05-fds/) | **Functional Design Specification** — 30 domain files, one design block per requirement | Steps 2–6 |
| `BFR-BKL-001` | [06-backlog/BFR-BKL-001-epic-feature-map.md](06-backlog/BFR-BKL-001-epic-feature-map.md) | Epic → feature → story rollup and release sequencing | Step 6 |
| `BFR-RTM-001` | [07-traceability/BFR-RTM-001-traceability-matrix.md](07-traceability/BFR-RTM-001-traceability-matrix.md) | Requirements traceability matrix (URS §27) | Step 5 / 14 |
| — | [07-traceability/rtm.csv](07-traceability/rtm.csv) | Machine-readable RTM, one row per requirement | Step 5 / 14 |
| `BFR-REL-001` | [08-release/BFR-REL-001-sandbox-release-gates.md](08-release/BFR-REL-001-sandbox-release-gates.md) | Sandbox release gate evidence pack (URS §29) | Step 15 |

---

## 3. How the FDS is structured

Each of the 30 domain files in `05-fds/` contains one design block per URS
requirement, using an identical template so the documents are diffable,
reviewable and machine-parsable:

```
#### BFR-XXX-NNN — <requirement title>            (Priority)
URS requirement / URS acceptance criteria   (verbatim from baseline)
Screens & journeys                          (customer app, USSD, admin, partner)
Workflow                                    (numbered functional steps)
API impact                                  (versioned endpoints, verbs, codes)
Data impact                                 (entities and fields touched)
Business rules                              (BR-XXX-NNN.n, individually testable)
Exceptions                                  (EX-XXX-NNN.n → error code → behaviour)
Events                                      (domain events emitted/consumed)
Security & audit impact                     (roles, masking, audit records)
User story                                  (backlog-ready, with Given/When/Then)
Test cases                                  (TC-XXX-NNN-n with test type)
```

Every ID in this document set resolves in exactly one place, so a reviewer can
walk `requirement → design → API → entity → story → test case → result` without
leaving the repository.

---

## 4. Status and what is deliberately *not* here

This baseline covers **Steps 1–6 and the standing standards** of URS §30
(analyse, architecture, data model, bounded domains, traceability, backlog).
Steps 7–15 are implementation and are explicitly gated on the resolution of
[`BFR-ANA-002` open questions](01-analysis/BFR-ANA-002-open-questions.md).

Per URS §30, implementation has **not** been started for any requirement whose
construction would require guessing a regulatory rule, financial threshold,
legal assumption or external partner API behaviour. Those requirements are
listed, with the specific decision needed and the decision owner, in
`BFR-ANA-002`.
