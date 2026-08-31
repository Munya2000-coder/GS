# BFR-FDS-22 — Domain 22: AML / Financial Crime (`AML`)

**Context:** Compliance (`compliance-svc`) · **Epic:** `EPIC-AML` — Detect, investigate and evidence, under strict access control
**Wave:** W6 · **Depends on:** `ID`, `PAY`, `XB`, `GOV` · **Blocking:** `Q-06` (reporting obligations), `Q-07` (list sources) · **Parameterised:** `Q-17` (thresholds)

---

### BFR-AML-001 — Sanctions screening `P1`

**Acceptance (URS):** Screening result recorded with source/version.

**Screens** — Admin ▸ Screening results; Case detail showing match data; customer sees only "being checked".

**Workflow**
1. Screening runs at onboarding, on identity data change, on list refresh, and before cross-border release (`XB-008`).
2. `SanctionsScreeningAdapter` returns matches with the list source and version.
3. Clear results proceed; potential matches create a case (`AML-006`).

**API** — internal `POST /internal/compliance/screen`; `GET /api/admin/v1/screening-results?customer_id=` → 200.

**Data** — `screening_result(screening_type, list_source, list_version, outcome, match_details_ref, screened_at)`

**Rules**
- `BR-AML-001.1` `list_source` and `list_version` are **mandatory** — a screening that cannot name its list version is not evidence and is treated as a failed screen.
- `BR-AML-001.2` Screening scope, frequency and match thresholds are configuration (`Q-07`, `Q-17`).
- `BR-AML-001.3` A screening error is never treated as a pass; it holds the operation and alerts.
- `BR-AML-001.4` Match details are restricted to AML roles and never disclosed to the customer (`USR-006`).
- `BR-AML-001.5` A list refresh triggers rescreening of the affected population per policy.

**Exceptions**
- `EX-AML-001.1` Provider unavailable → operation held; never released on a failed screen.
- `EX-AML-001.2` Potential match → case created; the customer sees a neutral "being checked" message only.

**Events** — `aml.screening.completed`, `aml.alert.created`
**Audit** — every screen, its result and every access to match details.

**Story `US-AML-001`** — As a compliance officer, I want every screening evidenced with its list source and version, so that I can demonstrate exactly what was checked and against what.
*Given* a completed screen, *when* I inspect it, *then* the list source and version are recorded, and a failed screen never resulted in a release.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-AML-001-1 | POS | Screening result records source and version |
| TC-AML-001-2 | NEG | Screening error holds, never passes |
| TC-AML-001-3 | PRM | Match details restricted to AML roles |
| TC-AML-001-4 | SEC | Customer messaging discloses nothing about a match |
| TC-AML-001-5 | INT | List refresh triggers rescreening |

---

### BFR-AML-002 — PEP screening `P1`

**Acceptance (URS):** Potential match enters configured review workflow.

**Screens** — Admin ▸ PEP review queue; Case detail with match evidence and the analyst decision panel.

**Workflow**
1. PEP screening runs alongside sanctions screening.
2. A potential match creates a case routed to the configured review workflow.
3. The analyst records a decision with a reason; enhanced due diligence may be required.

**API** — internal; `GET /api/admin/v1/cases?type=AML&subtype=PEP` → 200.

**Data** — `screening_result(screening_type = PEP)`, `case`

**Rules**
- `BR-AML-002.1` A PEP match is never an automatic refusal — it enters review, since PEP status is a risk factor, not a prohibition.
- `BR-AML-002.2` The review workflow and any enhanced due diligence requirements are configuration.
- `BR-AML-002.3` PEP status is retained as an attribute after review, and drives ongoing monitoring.
- `BR-AML-002.4` Access to PEP data is restricted and every access is audited.

**Exceptions**
- `EX-AML-002.1` Match confirmed → the configured enhanced process applies; onboarding or transacting continues or stops per that decision, never by default.

**Events** — `aml.alert.created`
**Audit** — decision, reason, reviewer.

**Story `US-AML-002`** — As a compliance analyst, I want PEP matches to reach a review workflow rather than an automatic outcome, so that risk is assessed by a person as the rules require.
*Given* a potential PEP match, *when* screening completes, *then* a case is created for review rather than a decision being made automatically.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-AML-002-1 | POS | PEP match creates a review case |
| TC-AML-002-2 | NEG | No automatic refusal on a PEP match |
| TC-AML-002-3 | POS | PEP status retained and drives monitoring |
| TC-AML-002-4 | PRM | PEP data access restricted and audited |

---

### BFR-AML-003 — Configurable transaction monitoring rules `P1`

**Acceptance (URS):** Thresholds/rules can change without source-code release.

**Screens** — Admin ▸ Monitoring rules (list, edit, simulate, activate); Rule detail with recent hit rate.

**Workflow**
1. Rules are defined as configuration: conditions, thresholds, windows, scope.
2. A rule can be simulated against historical data before activation.
3. Activation is a regulated change requiring approval (`GOV-008`).

**API** — `POST /api/admin/v1/monitoring-rules` → 201; `POST .../simulate` → 202; `POST .../activate` → 200.

**Data** — `monitoring_rule(definition, version, status, effective_from)`

**Rules**
- `BR-AML-003.1` Rules are data, not code — changing a threshold never requires a release.
- `BR-AML-003.2` Every alert records the rule version that raised it, so a past alert can be explained.
- `BR-AML-003.3` Simulation runs against historical data without generating live alerts.
- `BR-AML-003.4` Rule activation requires approval and is audited.
- `BR-AML-003.5` Thresholds are `PLACEHOLDER` until `Q-17` is answered, and the release gate blocks production while they are.

**Exceptions**
- `EX-AML-003.1` Rule with a malformed definition → rejected at save; it can never reach activation.

**Events** — `monitoring.rule.activated`
**Audit** — rule changes, simulations and activations audited.

**Story `US-AML-003`** — As an MLRO, I want to tune monitoring rules without a software release, so that we can respond to emerging typologies quickly.
*Given* a new threshold, *when* it is approved and activated, *then* monitoring uses it immediately and alerts record its version.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-AML-003-1 | POS | Threshold change applies without deployment |
| TC-AML-003-2 | POS | Alerts record the rule version |
| TC-AML-003-3 | POS | Simulation generates no live alerts |
| TC-AML-003-4 | PRM | Activation requires approval |
| TC-AML-003-5 | NEG | Placeholder thresholds block the release gate |

---

### BFR-AML-004 — Unusual transaction velocity detected `P1`

**Acceptance (URS):** Configured condition generates alert.

**Screens** — Admin ▸ Alerts with rule, customer, window and triggering transactions.

**Workflow**
1. Transaction events feed the monitoring engine.
2. Velocity rules evaluate counts and values over configured windows.
3. A breach raises an alert linked to the triggering transactions.

**API** — internal, event-driven; `GET /api/admin/v1/alerts?rule=VELOCITY` → 200.

**Data** — `alert(rule_id, rule_version, customer_id, window, triggering_transaction_ids[])`

**Rules**
- `BR-AML-004.1` Evaluation is event-driven and near-real-time; it never blocks the customer's transaction unless the rule is configured to hold.
- `BR-AML-004.2` The alert records the exact transactions and window that triggered it, so investigation starts with evidence.
- `BR-AML-004.3` Alert de-duplication prevents one pattern generating hundreds of alerts.
- `BR-AML-004.4` Velocity is measured across the customer's whole activity, including cross-border and merchant activity.

**Exceptions**
- `EX-AML-004.1` Monitoring backlog → alerts are delayed, never dropped; backlog depth is monitored and alerted.

**Events** — `aml.alert.created`
**Audit** — alert creation recorded.

**Story `US-AML-004`** — As a compliance analyst, I want unusual transaction velocity to raise an alert with its evidence attached, so that I can investigate without reconstructing the pattern myself.
*Given* activity breaching a velocity rule, *when* monitoring evaluates it, *then* an alert is raised naming the rule, window and transactions.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-AML-004-1 | POS | Velocity breach raises an alert with evidence |
| TC-AML-004-2 | POS | Alerts de-duplicated for one pattern |
| TC-AML-004-3 | POS | Velocity measured across all activity types |
| TC-AML-004-4 | ERR | Backlog delays but never drops alerts |

---

### BFR-AML-005 — Unusual cross-border patterns detected `P1`

**Acceptance (URS):** Configured corridor/risk scenarios generate alert.

**Screens** — Admin ▸ Alerts filtered by corridor risk; corridor risk configuration.

**Workflow**
1. Corridor risk ratings and scenario rules are configuration.
2. Cross-border activity is evaluated against structuring, unusual corridor use and counterparty concentration scenarios.
3. Breaches raise alerts, and may hold the transfer where configured (`XB-008`).

**API** — internal, event-driven on `transfer.*` events.

**Data** — corridor risk in configuration; `alert`

**Rules**
- `BR-AML-005.1` Corridor risk ratings and scenarios are configuration (`Q-10`, `Q-17`).
- `BR-AML-005.2` Purpose codes (`GOAL-001`) form part of the pattern context.
- `BR-AML-005.3` A rule may be configured to hold a transfer, in which case the hold happens before release, not after (`XB-008`).
- `BR-AML-005.4` Patterns are evaluated across corridors, not per corridor in isolation, so splitting across corridors is detectable.

**Exceptions**
- `EX-AML-005.1` Holding rule triggers → transfer moves to `ON_HOLD` with a case; the customer sees only "being checked".

**Events** — `aml.alert.created`, `transfer.held`
**Audit** — alerts and holds recorded.

**Story `US-AML-005`** — As an MLRO, I want cross-border patterns detected across corridors, so that structuring across routes does not go unnoticed.
*Given* activity matching a configured scenario, *when* monitoring evaluates it, *then* an alert is raised and, where configured, the transfer is held before release.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-AML-005-1 | POS | Corridor scenario raises an alert |
| TC-AML-005-2 | POS | Holding rule holds before release |
| TC-AML-005-3 | POS | Patterns detected across corridors |
| TC-AML-005-4 | SEC | Customer messaging reveals no detection detail |

---

### BFR-AML-006 — Alerts create or link to a compliance case `P1`

**Acceptance (URS):** Case contains customer, transaction and alert evidence.

**Screens** — Case detail: customer summary, alerts, transactions, screening results, notes, actions.

**Workflow**
1. An alert either opens a new case or attaches to an existing open case for the same customer.
2. The case aggregates all relevant evidence in one place.
3. Cases are assigned and worked (`AML-007`).

**API** — `GET /api/admin/v1/cases/{id}` → 200; `POST /api/admin/v1/cases/{id}/alerts` → 201.

**Data** — `case`, `alert.case_id`

**Rules**
- `BR-AML-006.1` No alert exists without a case — an unlinked alert would be an unworked signal.
- `BR-AML-006.2` Alerts for the same customer within a configured window attach to the open case rather than creating duplicates.
- `BR-AML-006.3` The case links to evidence by reference; it never copies financial records (which would create a second, divergent version).
- `BR-AML-006.4` Case data is restricted to AML roles (`AML-010`).

**Exceptions**
- `EX-AML-006.1` Alert for a customer with a closed case → a new case is opened, linked to the closed one for continuity.

**Events** — `case.created`
**Audit** — case creation and linkage.

**Story `US-AML-006`** — As a compliance analyst, I want each alert to sit in a case with its evidence, so that I can investigate from one place rather than assembling context by hand.
*Given* an alert, *when* it is raised, *then* a case exists containing the customer, the transactions and the alert evidence.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-AML-006-1 | POS | Alert creates or attaches to a case with evidence |
| TC-AML-006-2 | POS | Duplicate alerts attach rather than multiply cases |
| TC-AML-006-3 | POS | Evidence linked by reference, not copied |
| TC-AML-006-4 | PRM | Case restricted to AML roles |

---

### BFR-AML-007 — Analyst documents investigation `P1`

**Acceptance (URS):** Notes, actions and outcome persist.

**Screens** — Case ▸ Notes timeline; Add note; Record action.

**Workflow**
1. The analyst records notes and actions as the investigation proceeds.
2. Every entry is timestamped and attributed.
3. The record supports both internal review and any external reporting.

**API** — `POST /api/admin/v1/cases/{id}/notes` → 201; `GET .../notes` → 200.

**Data** — `case_note(author_id, body, created_at, note_type)` append-only

**Rules**
- `BR-AML-007.1` Notes are append-only; a correction is a new note referencing the earlier one.
- `BR-AML-007.2` Every note is attributed and timestamped.
- `BR-AML-007.3` Notes may contain sensitive detail and are restricted to AML roles; they are excluded from customer-facing data exports.
- `BR-AML-007.4` Attachments follow the same encryption and access rules as other evidence (`CAF-002`).

**Exceptions**
- `EX-AML-007.1` Attempt to edit or delete a note → `PERMISSION_DENIED`, audited.

**Events** — none
**Audit** — note creation and every case-data access.

**Story `US-AML-007`** — As a compliance analyst, I want my investigation recorded permanently, so that the reasoning behind a decision is available to reviewers and regulators.
*Given* an investigation, *when* I add notes and actions, *then* they persist unaltered with my name and the time.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-AML-007-1 | POS | Notes and actions persist with attribution |
| TC-AML-007-2 | SEC | Notes cannot be edited or deleted |
| TC-AML-007-3 | PRM | Notes restricted to AML roles |
| TC-AML-007-4 | SEC | Notes excluded from customer data exports |

---

### BFR-AML-008 — Case escalation `P1`

**Acceptance (URS):** Analyst can route case to authorised senior reviewer.

**Screens** — Case ▸ Escalate (reason, target role); Escalation queue for senior reviewers.

**Workflow**
1. The analyst escalates with a reason.
2. The case is routed to the configured senior role; ownership transfers.
3. The escalation and its outcome are recorded.

**API** — `POST /api/admin/v1/cases/{id}/escalate` `{reason, target_role}` → 200.

**Data** — `case_escalation(from_user, to_role, reason, escalated_at, resolved_at)`

**Rules**
- `BR-AML-008.1` Escalation targets a **role**, not a named individual, so escalation never depends on one person's availability.
- `BR-AML-008.2` A reason is mandatory.
- `BR-AML-008.3` Certain case types escalate automatically per configuration (for example a confirmed sanctions match).
- `BR-AML-008.4` The escalation chain is preserved on the case.

**Exceptions**
- `EX-AML-008.1` Escalation to a role with no active holders → alerts operations; the case is not silently stranded.

**Events** — `case.escalated`
**Audit** — escalations recorded.

**Story `US-AML-008`** — As a compliance analyst, I want to escalate a case to a senior reviewer, so that serious matters are decided at the right level.
*Given* a serious case, *when* I escalate it with a reason, *then* it is routed to the authorised senior role and the chain is recorded.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-AML-008-1 | POS | Escalation routes to the target role |
| TC-AML-008-2 | NEG | Escalation without a reason refused |
| TC-AML-008-3 | POS | Configured case types escalate automatically |
| TC-AML-008-4 | ERR | Empty target role alerts operations |

---

### BFR-AML-009 — Case closure requires outcome and reason `P1`

**Acceptance (URS):** Case cannot close with blank disposition.

**Screens** — Close case ▸ disposition (controlled list) and mandatory narrative.

**Workflow**
1. Closure requires a disposition from a controlled list plus a narrative.
2. The database enforces that a closed case has a disposition.
3. Closure may trigger downstream obligations per configuration (`Q-06`).

**API** — `POST /api/admin/v1/cases/{id}/close` `{disposition_id, narrative}` → 200.

**Data** — `case.disposition_id`; **CHECK: `status = CLOSED` requires `disposition_id NOT NULL`**

**Rules**
- `BR-AML-009.1` The constraint is enforced at the database level, not only in the application.
- `BR-AML-009.2` Dispositions come from a controlled list; free text supplements, never replaces, the disposition.
- `BR-AML-009.3` Closure authority depends on case severity — some closures require a senior role.
- `BR-AML-009.4` A closed case can be reopened, which is itself recorded; closure is never a way to erase a case.

**Exceptions**
- `EX-AML-009.1` Closure without a disposition → `VALIDATION_FAILED`, and refused by the database if attempted directly.
- `EX-AML-009.2` Closure by an insufficiently authorised role → `PERMISSION_DENIED`.

**Events** — `case.closed`
**Audit** — closure with disposition, narrative and actor.

**Story `US-AML-009`** — As an MLRO, I want cases to be closable only with a documented outcome, so that no investigation disappears without a recorded conclusion.
*Given* an open case, *when* closure is attempted without a disposition, *then* it is refused by both the application and the database.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-AML-009-1 | NEG | Closure without disposition refused |
| TC-AML-009-2 | SEC | Database constraint refuses it too |
| TC-AML-009-3 | PRM | Severity-based closure authority enforced |
| TC-AML-009-4 | POS | Reopening recorded |
| TC-AML-009-5 | AUD | Closure fully audited |

---

### BFR-AML-010 — AML actions restricted and auditable `P1`

**Acceptance (URS):** Only authorised roles can access/modify case; actions logged.

**Screens** — AML area visible only to AML roles; access attempts by others produce nothing.

**Workflow**
1. Every AML endpoint requires an AML permission and a fresh MFA assertion (`USR-006`, `ADM-001`).
2. Every access — read as well as write — is audited.
3. Unusual access patterns raise security alerts (URS §21).

**API** — all `/api/admin/v1/cases/**` and screening endpoints are AML-scoped.

**Data** — `audit_event` for every AML read and write.

**Rules**
- `BR-AML-010.1` **Reads are audited, not only writes** — knowing who looked at a case matters as much as who changed it.
- `BR-AML-010.2` Non-AML roles receive `404`, so case existence is not disclosed (`USR-006`).
- `BR-AML-010.3` Bulk export of case data requires elevated authority and raises a security alert.
- `BR-AML-010.4` AML role holders are subject to periodic recertification (`USR-010`).

**Exceptions**
- `EX-AML-010.1` Unauthorised access attempt → `404`, security event raised, pattern monitored.

**Events** — security events on unauthorised attempts.
**Audit** — complete, including reads.

**Story `US-AML-010`** — As an MLRO, I want every access to AML data restricted and recorded, so that the investigation function itself is controlled and reviewable.
*Given* a non-AML staff user, *when* they attempt to open a case, *then* they receive a not-found response and the attempt is recorded as a security event.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-AML-010-1 | PRM | Only AML roles reach AML endpoints |
| TC-AML-010-2 | SEC | Non-AML access returns 404 and raises a security event |
| TC-AML-010-3 | AUD | Reads audited as well as writes |
| TC-AML-010-4 | SEC | Bulk export requires elevated authority and alerts |
| TC-AML-010-5 | SEC | Stale MFA blocks AML access |
