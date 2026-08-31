# BFR-FDS-30 — Domain 30: Security, Data, API, Performance and Validation (`NFR`)

**Context:** Platform-wide (no bounded context) · **Epic:** `EPIC-NFR` — The properties every feature must hold
**Wave:** Continuous from W1 · **Verified in:** CI, security testing and the release gate

> These are not features to be built once. They are **properties verified
> continuously** against everything else that is built. Each is realised by the
> standards in `04-standards/` and enforced by a specific CI gate.

---

### BFR-NFR-001 — Data encrypted in transit `P1`

**Acceptance (URS):** Supported production endpoints enforce approved TLS configuration.

**Realised by** — `BFR-STD-004` §3, `BFR-STD-008`.

**Workflow**
1. Every external and internal endpoint is served over TLS with the approved configuration.
2. Plaintext HTTP is not served; HSTS is set on customer surfaces.
3. Configuration is verified continuously by scanning.

**Rules**
- `BR-NFR-001.1` TLS applies to internal service-to-service traffic as well as external traffic — the internal network is not treated as trusted.
- `BR-NFR-001.2` The approved cipher and protocol configuration is defined centrally and enforced at the ingress and the service mesh.
- `BR-NFR-001.3` Certificates are managed and rotated automatically; expiry is alerted well in advance.
- `BR-NFR-001.4` Adapter calls to partners verify the partner's certificate; verification is never disabled to work around an integration problem.

**Exceptions**
- `EX-NFR-001.1` Partner endpoint not supporting the approved configuration → escalated as an integration risk with a documented, time-boxed and approved exception; never a silent downgrade.

**Story `US-NFR-001`** — As a security officer, I want all traffic encrypted in transit, so that customer data cannot be read in transit anywhere in the platform.
*Given* any production endpoint, *when* it is scanned, *then* it enforces the approved TLS configuration and serves no plaintext.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NFR-001-1 | SEC | All production endpoints enforce approved TLS |
| TC-NFR-001-2 | SEC | Plaintext HTTP not served |
| TC-NFR-001-3 | SEC | Internal traffic encrypted |
| TC-NFR-001-4 | SEC | Certificate verification never disabled in adapters |

---

### BFR-NFR-002 — Sensitive data encrypted at rest `P1`

**Acceptance (URS):** Database/storage encryption enabled for production data stores.

**Realised by** — `BFR-STD-006` §3, `BFR-DAT-002`.

**Workflow**
1. Storage-level encryption is enabled on every production data store, including backups.
2. Column-level encryption additionally protects identity fields, document numbers and contact details.
3. Keys are managed in a KMS and rotated on schedule.

**Rules**
- `BR-NFR-002.1` Storage encryption is the baseline; column encryption protects the highest-sensitivity fields against a database-level compromise.
- `BR-NFR-002.2` Keys are never stored with the data, never in source, and never in configuration files (`NFR-003`).
- `BR-NFR-002.3` Backups and object storage are encrypted with the same rigour (`BFR-STD-008` §3).
- `BR-NFR-002.4` Non-production environments never hold unprotected production data (URS §24).

**Exceptions**
- `EX-NFR-002.1` A field required to be searchable → a keyed hash is used for matching rather than storing plaintext (`ID-008`).

**Story `US-NFR-002`** — As a data protection officer, I want sensitive data encrypted at rest, so that a storage compromise does not expose customer identities.
*Given* the production data stores, *when* they are inspected, *then* encryption is enabled and identity fields are additionally column-encrypted.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NFR-002-1 | SEC | Storage encryption enabled on all production stores |
| TC-NFR-002-2 | SEC | Identity fields column-encrypted |
| TC-NFR-002-3 | SEC | Backups and object storage encrypted |
| TC-NFR-002-4 | SEC | Searchable fields use keyed hashes, not plaintext |

---

### BFR-NFR-003 — No secrets in source code `P1`

**Acceptance (URS):** Repository scan finds no production credentials/secrets.

**Realised by** — `BFR-STD-008` §5.

**Workflow**
1. Secret scanning runs on every commit and blocks the build on a detection.
2. All secrets resolve from the secret manager at runtime.
3. Historical commits are scanned; any finding triggers rotation, not merely removal.

**Rules**
- `BR-NFR-003.1` A secret detection **fails the build** — it is not a warning.
- `BR-NFR-003.2` A leaked secret is rotated, not just deleted from the code, because history persists.
- `BR-NFR-003.3` Configuration files hold references and handles, never secret values.
- `BR-NFR-003.4` Test fixtures use clearly-marked synthetic values that cannot be mistaken for real credentials.
- `BR-NFR-003.5` Logs, error responses and events never contain secrets (`NFR-005`).

**Exceptions**
- `EX-NFR-003.1` False positive → suppressed with a documented, reviewed justification, never by disabling the scanner.

**Story `US-NFR-003`** — As a security officer, I want the build to fail on any committed secret, so that credentials never reach the repository.
*Given* a commit containing a credential, *when* CI runs, *then* the build fails and the secret is rotated.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NFR-003-1 | SEC | Secret scanning fails the build on detection |
| TC-NFR-003-2 | SEC | No production secret in the repository or its history |
| TC-NFR-003-3 | SEC | Secrets resolve from the secret manager at runtime |
| TC-NFR-003-4 | SEC | Secrets absent from logs, errors and events |

---

### BFR-NFR-004 — Idempotency for money-moving API calls `P1`

**Acceptance (URS):** Repeated same idempotent request does not duplicate monetary action.

**Realised by** — `BFR-STD-004` §4; enforced per endpoint.

**Workflow**
1. Money-moving endpoints require an `Idempotency-Key`.
2. Middleware records the key and request hash before execution.
3. Replays return the original response; conflicting reuse is refused.

**Rules**
- `BR-NFR-004.1` Idempotency is middleware, applied uniformly — not implemented per endpoint, where it would eventually be forgotten.
- `BR-NFR-004.2` Uniqueness is a database constraint, so the guarantee holds under concurrency.
- `BR-NFR-004.3` Coverage includes payments, transfers, savings instructions, Circle contributions and payouts, offer acceptance and refunds.
- `BR-NFR-004.4` Event consumers are idempotent on `event_id`, so a redelivered event cannot repeat a monetary effect (`BFR-STD-002`).
- `BR-NFR-004.5` Where a partner rail lacks idempotency, BuntuFin adds a pre-flight duplicate check and reconciles every `UNKNOWN` outcome (`Q-23`).

**Exceptions**
- `EX-NFR-004.1` Missing key on a money-moving endpoint → `VALIDATION_FAILED`; the call does not execute.

**Story `US-NFR-004`** — As a customer on an unreliable network, I want retries never to duplicate a payment, so that a lost response cannot cost me money.
*Given* the same idempotent request sent twice, *when* both are processed, *then* exactly one monetary action occurs.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NFR-004-1 | IDM | Repeat request produces one monetary action |
| TC-NFR-004-2 | CON | Concurrent identical requests produce one action |
| TC-NFR-004-3 | NEG | Missing key on a money-moving endpoint refused |
| TC-NFR-004-4 | IDM | Redelivered event does not repeat its effect |
| TC-NFR-004-5 | SEC | Every money-moving route covered (route inventory test) |

---

### BFR-NFR-005 — Structured error responses `P1`

**Acceptance (URS):** Error response includes stable code and correlation ID.

**Realised by** — `BFR-STD-004` §5.

**Workflow**
1. All errors are serialised through one error handler.
2. Every response carries a stable code, a message key and a correlation id.
3. A schema conformance test runs against every endpoint.

**Rules**
- `BR-NFR-005.1` Error codes are stable across API versions; a code's meaning never changes.
- `BR-NFR-005.2` The correlation id appears in the response, the logs and the audit trail, so one identifier traces an incident end to end.
- `BR-NFR-005.3` No internal detail leaks: no stack traces, SQL, provider payloads or internal hostnames.
- `BR-NFR-005.4` Every error carries a `message_key` so clients can localise (URS §18).
- `BR-NFR-005.5` Authorisation errors avoid disclosing existence where enumeration is a risk (`PRT-004`, `AML-010`).

**Exceptions**
- `EX-NFR-005.1` Unhandled exception → generic `INTERNAL_ERROR` with a correlation id; the detail goes to logs, never to the client.

**Story `US-NFR-005`** — As a partner developer, I want stable error codes and a correlation id, so that I can handle errors programmatically and report incidents precisely.
*Given* any error response, *when* I inspect it, *then* it has a stable code, a message key and a correlation id, and no internal detail.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NFR-005-1 | API | Every endpoint conforms to the error schema |
| TC-NFR-005-2 | POS | Correlation id present and traceable to logs and audit |
| TC-NFR-005-3 | SEC | No internal detail in any error response |
| TC-NFR-005-4 | SEC | Enumeration-sensitive errors do not disclose existence |
| TC-NFR-005-5 | ERR | Unhandled exception returns a generic error with a correlation id |

---

### BFR-NFR-006 — Audit logs protected from ordinary modification `P1`

**Acceptance (URS):** Standard users/admins cannot delete audit events.

**Realised by** — `BFR-DAT-002` §11, `BFR-FDS-26` (`ADM-010`).

**Workflow**
1. `audit_event` is append-only and hash-chained.
2. The application database role has no `UPDATE` or `DELETE` grant on it.
3. A scheduled integrity job verifies the chain.

**Rules**
- `BR-NFR-006.1` Protection is a database grant, not an application convention.
- `BR-NFR-006.2` The hash chain makes tampering detectable even by someone with elevated database access.
- `BR-NFR-006.3` Disposal under the retention schedule requires dual approval and is itself audited (`BFR-STD-006`).
- `BR-NFR-006.4` Audit writes share the transaction of the action they record, so an action cannot succeed unaudited (`ADM-010`).
- `BR-NFR-006.5` The same protections apply to other append-only evidence: `journal`, `disclosure_log`, `share_access_log`, status histories.

**Exceptions**
- `EX-NFR-006.1` Chain break detected → severity-one incident; the break is preserved as evidence, never repaired silently.

**Story `US-NFR-006`** — As an auditor, I want the audit trail technically protected from modification, so that it remains evidence rather than merely a record.
*Given* an audit event, *when* modification is attempted by any application route or role, *then* it is refused, and any tampering at the storage level is detectable.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NFR-006-1 | SEC | UPDATE and DELETE denied to the application role |
| TC-NFR-006-2 | SEC | Hash chain detects tampering |
| TC-NFR-006-3 | ERR | Audit write failure rolls back the action |
| TC-NFR-006-4 | PRM | Retention disposal requires dual approval and is audited |
| TC-NFR-006-5 | SEC | Same protections verified on all append-only evidence tables |

---

### BFR-NFR-007 — Low-bandwidth operation `P2`

**Acceptance (URS):** Critical customer screens remain usable on constrained connection test profile.

**Realised by** — `BFR-STD-007` §3.

**Workflow**
1. Critical journeys are built to a small payload and asset budget.
2. A constrained-connection profile is part of the CI end-to-end suite.
3. Regressions in payload size fail the build.

**Rules**
- `BR-NFR-007.1` Critical journeys — authentication, position, send money, transfer status — have defined payload and asset budgets enforced in CI.
- `BR-NFR-007.2` Default page sizes are small; field selection is available on heavy resources.
- `BR-NFR-007.3` No decorative media on critical journeys.
- `BR-NFR-007.4` Requests are retry-safe (`NFR-004`), so a dropped connection is recoverable without risk of duplication.
- `BR-NFR-007.5` Cached read-only views display their age; no financial action is queued offline for later automatic submission.

**Exceptions**
- `EX-NFR-007.1` Budget exceeded by a change → the build fails; an exception requires documented approval.

**Story `US-NFR-007`** — As a customer on a weak connection, I want the critical screens to work, so that poor connectivity does not exclude me from using my money.
*Given* the constrained-connection profile, *when* the critical journeys run, *then* they complete within the defined budgets.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NFR-007-1 | POS | Critical journeys complete on the constrained profile |
| TC-NFR-007-2 | POS | Payload and asset budgets enforced in CI |
| TC-NFR-007-3 | POS | Dropped connection recoverable without duplication |
| TC-NFR-007-4 | POS | Cached views display their age |

---

### BFR-NFR-008 — Availability target of at least 99.9% `P2`

**Acceptance (URS):** Availability monitoring reports against defined target.

**Realised by** — `BFR-STD-008` §6.

**Workflow**
1. Synthetic probes exercise the critical journey set from outside the platform.
2. Availability is computed against the target, excluding approved maintenance.
3. A monthly report itemises incidents and maintenance windows.

**Rules**
- `BR-NFR-008.1` Availability is measured on customer-facing critical journeys, not on infrastructure uptime — a running server serving errors is not available.
- `BR-NFR-008.2` Maintenance windows must be approved and announced in advance to be excluded.
- `BR-NFR-008.3` Partial degradation (one corridor down) is reported distinctly from full unavailability.
- `BR-NFR-008.4` The measurement method is documented and stable, so figures are comparable across periods.

**Exceptions**
- `EX-NFR-008.1` Third-party provider outage → reported separately from platform availability, and both figures are published; the customer's experience is not excused by the cause.

**Story `US-NFR-008`** — As an operations manager, I want availability measured on real customer journeys, so that our reported figure reflects what customers actually experienced.
*Given* a reporting month, *when* availability is computed, *then* it is measured on critical journeys against the target, with maintenance itemised.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NFR-008-1 | POS | Availability computed from synthetic critical-journey probes |
| TC-NFR-008-2 | POS | Only approved maintenance excluded |
| TC-NFR-008-3 | POS | Partial degradation reported distinctly |
| TC-NFR-008-4 | POS | Provider outages reported separately, not netted off |

---

### BFR-NFR-009 — Automated tests for critical functionality `P1`

**Acceptance (URS):** CI pipeline executes unit/integration/E2E suites for defined critical flows.

**Realised by** — `BFR-STD-009`.

**Workflow**
1. Unit, integration, contract and end-to-end suites run in CI on every change.
2. The critical flow suites (`BFR-STD-009` §4) must pass before any promotion.
3. Coverage floors apply to financial modules.

**Rules**
- `BR-NFR-009.1` The critical flow suites are mandatory gates; they cannot be skipped to unblock a release.
- `BR-NFR-009.2` Financial functions additionally carry concurrency, idempotency, reversal, reconciliation and decimal tests (URS §26).
- `BR-NFR-009.3` A flaky test is fixed or quarantined with an owner and a deadline; it is never simply re-run until it passes.
- `BR-NFR-009.4` Test data is synthetic; production data is never used in test (URS §24).
- `BR-NFR-009.5` Every test declares the requirement it verifies, feeding the RTM (`NFR-010`).

**Exceptions**
- `EX-NFR-009.1` A suite cannot run (infrastructure failure) → the pipeline fails; it does not pass by default.

**Story `US-NFR-009`** — As a release manager, I want critical flows automatically tested on every change, so that no release reaches production without evidence that the essentials still work.
*Given* a change, *when* CI runs, *then* the critical flow suites execute and must pass before promotion.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NFR-009-1 | POS | All critical flow suites execute in CI |
| TC-NFR-009-2 | NEG | A failing critical suite blocks promotion |
| TC-NFR-009-3 | POS | Financial modules carry the five additional test categories |
| TC-NFR-009-4 | SEC | No production data in test |
| TC-NFR-009-5 | ERR | Infrastructure failure fails the pipeline, not passes it |

---

### BFR-NFR-010 — Every requirement traceable to design and test evidence `P1`

**Acceptance (URS):** Traceability matrix shows requirement → design → build → test → result.

**Realised by** — `BFR-RTM-001`, `BFR-STD-008` §5, `BFR-STD-009` §2.

**Workflow**
1. Every API route declares `x-urs-requirements`; every test declares its requirement and category.
2. CI extracts these declarations and regenerates the RTM.
3. The traceability gate fails if any P1 requirement lacks a passing test, or any route lacks a declaration.

**Rules**
- `BR-NFR-010.1` The RTM is **generated**, not maintained by hand — a hand-maintained matrix drifts from reality within weeks.
- `BR-NFR-010.2` The gate fails the build when a P1 requirement has no passing test or an undeclared route exists.
- `BR-NFR-010.3` Exceptions require a documented, approved entry naming the requirement, the reason and the review date (URS §27).
- `BR-NFR-010.4` The RTM records requirement, business process, design component, API, database entity, user story, test case, test type, result, defect reference and release version (URS §27).
- `BR-NFR-010.5` **No P1 requirement enters production without successful traceability or a documented authorised exception** (URS §27).

**Exceptions**
- `EX-NFR-010.1` Requirement satisfied as a property of another feature (`BFR-ANA-001` §5) → still requires its own test case; it is simply attached to the feature that realises it.

**Story `US-NFR-010`** — As a regulator, I want every requirement traceable from specification through design and build to a test result, so that I can verify what was actually implemented and proven.
*Given* the requirement baseline, *when* the RTM is generated, *then* every P1 requirement resolves to a design component, an API, an entity, a story and a passing test — or to an approved exception.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NFR-010-1 | POS | RTM generated from route and test declarations |
| TC-NFR-010-2 | NEG | P1 requirement without a passing test fails the gate |
| TC-NFR-010-3 | NEG | Undeclared route fails the gate |
| TC-NFR-010-4 | POS | RTM contains every URS §27 column |
| TC-NFR-010-5 | AUD | Exceptions documented, approved and dated |
