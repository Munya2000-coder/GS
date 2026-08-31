# BFR-RTM-001 — Requirements Traceability Matrix

**Realises URS §27 and requirement `BFR-NFR-010`.**
**Machine-readable matrix:** [`rtm.csv`](rtm.csv) — 1,382 rows
**Generator:** [`generate_rtm.py`](generate_rtm.py) — run `python3 generate_rtm.py --check`

---

## 1. The matrix is generated, never hand-maintained

`BR-NFR-010.1` states the reason plainly: a hand-maintained traceability matrix
drifts from reality within weeks. This one is **derived** from two controlled
sources:

| Source | Supplies |
|---|---|
| `00-urs/BFR-URS-001-baseline.md` | Requirement ID, requirement text, acceptance criteria, priority |
| `05-fds/domain-*.md` | Epic, design component, API endpoints, database entities, user story, test cases and their categories |

Once implementation starts, three further columns are populated by the CI
traceability job rather than by the generator:

| Column | Populated from |
|---|---|
| `Test Result` | Test execution reports, matched on the `@urs(...)` marker (`BFR-STD-009` §2) |
| `Defect Reference` | Defect tracker, linked by requirement ID |
| `Release Version` | Build metadata of the release that carried the passing test |

Until then every row reads `NOT_EXECUTED`, which is the honest state of a design
baseline: the design is complete, nothing has been built or proven.

## 2. Columns (URS §27)

The URS mandates eleven columns. All are present, plus five that make the matrix
usable in review:

| URS §27 column | CSV column | Status |
|---|---|---|
| URS Requirement ID | `URS Requirement ID` | Generated |
| Business Process | `Business Process` | Generated |
| Design Component | `Design Component` | Generated |
| API | `API` | Generated |
| Database Entity | `Database Entity` | Generated |
| User Story | `User Story` | Generated |
| Test Case ID | `Test Case ID` | Generated |
| Test Type | `Test Type` | Generated |
| Test Result | `Test Result` | **CI-populated** |
| Defect Reference | `Defect Reference` | **CI-populated** |
| Release Version | `Release Version` | **CI-populated** |
| *(added)* | `Priority`, `Requirement`, `Acceptance Criteria`, `Epic`, `Design Reference`, `Test Case` | Generated |

`Design Reference` is a direct file-and-anchor link, so a reviewer can go from a
matrix row to the design block in one step.

## 3. Current state of the matrix

```
requirements       : 300
design blocks      : 300
rtm rows           : 1382
test cases         : 1382
missing design     : 0
orphan design      : 0
P1 without test    : 0
without user story : 0
TRACEABILITY GATE  : PASSED
```

Every one of the 300 baseline requirements resolves to a design component, an
API position, a data entity, a user story and at least one test case. There are
no orphans in either direction.

## 4. Coverage by domain

| Epic | Business process | Code | Reqs | P1 | P2 | P3 | Test cases |
|---|---|---|---:|---:|---:|---:|---:|
| EPIC-GOV | Platform governance | GOV | 10 | 10 | 0 | 0 | 54 |
| EPIC-USR | User and role management | USR | 10 | 7 | 3 | 0 | 47 |
| EPIC-ID | Identity and KYC | ID | 10 | 9 | 1 | 0 | 52 |
| EPIC-CON | Consent and privacy | CON | 10 | 9 | 1 | 0 | 44 |
| EPIC-OF | Open finance | OF | 10 | 8 | 2 | 0 | 48 |
| EPIC-CAT | Transaction categorisation | CAT | 10 | 4 | 5 | 1 | 44 |
| EPIC-FP | Financial Passport | FP | 10 | 10 | 0 | 0 | 51 |
| EPIC-FPS | Passport sharing | FPS | 10 | 9 | 1 | 0 | 49 |
| EPIC-FH | Financial health | FH | 10 | 6 | 4 | 0 | 42 |
| EPIC-PAY | Customer payments | PAY | 10 | 8 | 2 | 0 | 53 |
| EPIC-LED | Double-entry ledger | LED | 10 | 10 | 0 | 0 | 46 |
| EPIC-SAV | BuntuSave | SAV | 10 | 6 | 4 | 0 | 49 |
| EPIC-CIR | BuntuCircle | CIR | 10 | 8 | 2 | 0 | 48 |
| EPIC-CG | Circle governance and payouts | CG | 10 | 7 | 3 | 0 | 46 |
| EPIC-BIZ | BuntuBusiness | BIZ | 10 | 8 | 2 | 0 | 43 |
| EPIC-INV | Inventory-lite | INV | 10 | 0 | 1 | 9 | 40 |
| EPIC-CAP | Capital marketplace | CAP | 10 | 10 | 0 | 0 | 45 |
| EPIC-CAF | Capital application lifecycle | CAF | 10 | 6 | 4 | 0 | 49 |
| EPIC-XB | Cross-border payments | XB | 10 | 10 | 0 | 0 | 47 |
| EPIC-FX | FX and routing | FX | 10 | 9 | 1 | 0 | 42 |
| EPIC-GOAL | PurposePay and goals | GOAL | 10 | 5 | 5 | 0 | 43 |
| EPIC-AML | AML and financial crime | AML | 10 | 10 | 0 | 0 | 44 |
| EPIC-FRD | Fraud management | FRD | 10 | 9 | 1 | 0 | 43 |
| EPIC-CMP | Complaints and disputes | CMP | 10 | 7 | 3 | 0 | 45 |
| EPIC-PRT | Partner management | PRT | 10 | 9 | 1 | 0 | 45 |
| EPIC-ADM | Administration portal | ADM | 10 | 9 | 1 | 0 | 48 |
| EPIC-NOT | Notifications | NOT | 10 | 5 | 4 | 1 | 43 |
| EPIC-RPT | Reporting and sandbox KPI | RPT | 10 | 9 | 1 | 0 | 42 |
| EPIC-REC | Reconciliation and settlement | REC | 10 | 9 | 1 | 0 | 45 |
| EPIC-NFR | Cross-cutting non-functional | NFR | 10 | 8 | 2 | 0 | 45 |
| **Total** | | **30 domains** | **300** | **234** | **55** | **11** | **1382** |

## 5. Coverage by test category

The URS §26 categories, and the additional five required for financial
functions, are all represented:

| Category | Cases | Category | Cases |
|---|---:|---|---:|
| Positive functional | 607 | Concurrency | 24 |
| Negative functional | 310 | Decimal and rounding | 23 |
| Security | 172 | Reversal | 12 |
| Audit verification | 72 | Idempotency | 11 |
| Permissions | 69 | API contract | 6 |
| Integration | 39 | Reconciliation | 4 |
| Error handling | 33 | | |

The distribution is deliberate rather than uniform. Negative, security,
permissions and audit cases together outnumber positive cases in the domains
that carry regulatory weight (`LED`, `AML`, `FRD`, `ADM`, `NFR`), because in
those domains the requirement is usually that something **cannot** happen.

The financial-only categories (concurrency, idempotency, reversal,
reconciliation, decimal) cluster in `LED`, `PAY`, `SAV`, `CIR`, `XB`, `FX`,
`GOAL` and `REC`, exactly as URS §26 requires.

## 6. The CI traceability gate

`generate_rtm.py --check` is the gate described in `BFR-STD-008` §5. It fails
the build when:

1. a baseline requirement has no design block;
2. a design block references a requirement that is not in the baseline;
3. a **P1** requirement has no test case;
4. a requirement has no user story.

Once code exists, the same job additionally fails when a P1 requirement has no
*passing* test, or when an API route carries no `x-urs-requirements` declaration
(`BR-NFR-010.2`).

## 7. Exceptions register

URS §27: *"No P1 requirement may enter production without successful
traceability or documented authorised exception."*

| Requirement | Exception | Reason | Approved by | Review date |
|---|---|---|---|---|
| — | — | *No exceptions raised at baseline* | — | — |

Any future entry must name the requirement, the specific traceability element
missing, the reason, the approver and a review date. An exception is never
open-ended.

## 8. Relationship to the open questions

The matrix shows design and test coverage, **not** readiness. 28 requirements
are additionally gated on the decisions in
[`BFR-ANA-002`](../01-analysis/BFR-ANA-002-open-questions.md): 11 BLOCKING,
7 PARAMETERISED and 10 CONTRACT-PENDING. A row can be fully traced and still be
unbuildable, and the release gate (`BFR-REL-001`) checks both.
