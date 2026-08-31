# BFR-FDS-26 — Domain 26: Administration Portal (`ADM`)

**Context:** Admin BFF over all contexts · **Epic:** `EPIC-ADM` — Staff can operate the platform, and everything they do is visible
**Wave:** W6 (built incrementally from W1) · **Depends on:** every other domain

---

### BFR-ADM-001 — Strong authentication for the admin portal `P1`

**Acceptance (URS):** MFA enforced for privileged users.

**Screens** — Admin login with mandatory second factor; MFA enrolment; session expiry warning.

**Workflow**
1. Staff authenticate with their credential plus a second factor.
2. Sensitive areas require a recent MFA assertion, not merely a valid session (`USR-006`).
3. Sessions are short and expire on inactivity.

**API** — `/api/admin/v1/**` requires an authenticated staff session with an MFA claim.

**Data** — staff credentials and MFA enrolment in `auth-svc`.

**Rules**
- `BR-ADM-001.1` MFA is mandatory for every privileged user and cannot be disabled by the user.
- `BR-ADM-001.2` Admin sessions are shorter than customer sessions, per configuration.
- `BR-ADM-001.3` Sensitive areas (AML, fraud, security, configuration) require MFA freshness within a configured window.
- `BR-ADM-001.4` Admin access is restricted by network policy where the deployment supports it.

**Exceptions**
- `EX-ADM-001.1` Missing or stale MFA → `STEP_UP_REQUIRED`; the action does not proceed.
- `EX-ADM-001.2` Repeated admin authentication failures → lockout and a security alert (URS §21).

**Events** — security events on admin authentication anomalies.
**Audit** — every admin authentication, success and failure.

**Story `US-ADM-001`** — As a security officer, I want every privileged user on multi-factor authentication, so that a stolen staff password alone cannot reach customer data.
*Given* an admin user without a valid second factor, *when* they attempt to access the portal, *then* access is refused.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ADM-001-1 | POS | MFA required and enforced for admin access |
| TC-ADM-001-2 | NEG | MFA cannot be disabled by the user |
| TC-ADM-001-3 | SEC | Stale MFA blocks sensitive areas |
| TC-ADM-001-4 | SEC | Repeated failures lock out and alert |
| TC-ADM-001-5 | AUD | All admin authentication audited |

---

### BFR-ADM-002 — Operational KPI dashboard `P2`

**Acceptance (URS):** Current transaction, failure and case indicators available.

**Screens** — Admin home: transaction volumes and success rates, failure reasons, open cases and complaints, partner health, ageing holds, SLA risk.

**Workflow**
1. The dashboard reads from reporting projections, never from operational tables.
2. Indicators refresh on a configured cadence with their as-at time shown.
3. Each indicator drills through to the underlying, role-permitted list.

**API** — `GET /api/admin/v1/dashboard` → 200.

**Data** — reporting read models.

**Rules**
- `BR-ADM-002.1` The dashboard never queries operational tables directly, so it cannot degrade transaction processing.
- `BR-ADM-002.2` Every indicator shows its as-at time.
- `BR-ADM-002.3` Drill-through respects role permissions — an indicator may be visible in aggregate while its detail is not (`USR-006`).
- `BR-ADM-002.4` Indicator definitions are documented and versioned, so a number means the same thing over time.

**Exceptions**
- `EX-ADM-002.1` Projection lag → the as-at time makes the lag visible rather than presenting stale figures as current.

**Events** — none
**Audit** — dashboard access logged at summary level.

**Story `US-ADM-002`** — As an operations manager, I want a live view of platform health, so that I can see problems before customers report them.
*Given* the dashboard, *when* I open it, *then* I see current transaction, failure and case indicators, each with its as-at time.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ADM-002-1 | POS | Indicators available with as-at times |
| TC-ADM-002-2 | PRM | Drill-through respects role permissions |
| TC-ADM-002-3 | NEG | No direct operational-table queries |
| TC-ADM-002-4 | POS | Projection lag visible, not hidden |

---

### BFR-ADM-003 — Authorised staff search customers `P1`

**Acceptance (URS):** Search is role-limited and audited.

**Screens** — Customer search with permitted criteria; results masked per role; customer detail.

**Workflow**
1. A staff member searches by permitted criteria.
2. Results are filtered by role and masked per policy (`ADM-004`).
3. Every search and every record opened is audited.

**API** — `GET /api/admin/v1/customers?q=` → 200 (masked, audited).

**Data** — search over `customer`; every access written to `audit_event`.

**Rules**
- `BR-ADM-003.1` **Searches are audited**, including those returning no results — a fishing expedition is itself a signal.
- `BR-ADM-003.2` Search criteria are restricted; broad enumeration (for example listing all customers) is not available.
- `BR-ADM-003.3` Result sets are capped and paginated; bulk extraction requires elevated authority and alerts (URS §21).
- `BR-ADM-003.4` Results are masked per role before serialisation.

**Exceptions**
- `EX-ADM-003.1` Excessive search volume by one user → alerted as a security event and may be rate-limited.

**Events** — security events on abnormal search patterns.
**Audit** — every search: actor, criteria, result count, records opened.

**Story `US-ADM-003`** — As a support agent, I want to find a customer to help them, while the platform records that I looked, so that access to customer data is accountable.
*Given* a search, *when* I run it, *then* results are masked to my role and both the search and any record I open are recorded.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ADM-003-1 | POS | Authorised search returns masked results |
| TC-ADM-003-2 | AUD | Searches audited, including empty ones |
| TC-ADM-003-3 | NEG | Broad enumeration unavailable |
| TC-ADM-003-4 | SEC | Excessive search volume alerts |
| TC-ADM-003-5 | PRM | Unauthorised role cannot search |

---

### BFR-ADM-004 — Role-based masking of sensitive data `P1`

**Acceptance (URS):** Lower privilege role cannot view full protected values.

**Screens** — Masked values with an explicit "reveal" action where the role permits, which is itself audited.

**Workflow**
1. A field-level masking policy maps roles to what they may see.
2. Masking is applied server-side before serialisation.
3. A permitted reveal is a separate, audited action with a reason.

**API** — all admin responses are masked per role; `POST /api/admin/v1/customers/{id}/reveal` `{field, reason}` → 200 (audited).

**Data** — masking policy in configuration; `audit_event` for reveals.

**Rules**
- `BR-ADM-004.1` Masking is server-side; an unmasked value never crosses the service boundary to an unauthorised role.
- `BR-ADM-004.2` Masked values are also masked in logs, events, exports and error messages.
- `BR-ADM-004.3` A reveal requires a reason and is audited individually.
- `BR-ADM-004.4` The masking policy is versioned configuration and its changes are approved.

**Exceptions**
- `EX-ADM-004.1` Reveal by an unauthorised role → `PERMISSION_DENIED`, audited.

**Events** — `admin.data.revealed`
**Audit** — every reveal with field, reason and actor.

**Story `US-ADM-004`** — As a data protection officer, I want sensitive fields masked by role, so that staff see only what their job requires.
*Given* a support agent, *when* they view a customer, *then* protected values are masked, and any permitted reveal is recorded with a reason.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ADM-004-1 | PRM | Lower-privilege role sees masked values only |
| TC-ADM-004-2 | SEC | Unmasked value never leaves the service for that role |
| TC-ADM-004-3 | SEC | Masked in logs, events, exports and errors |
| TC-ADM-004-4 | AUD | Reveal audited with reason |
| TC-ADM-004-5 | NEG | Reveal without a reason refused |

---

### BFR-ADM-005 — Admin views transaction lifecycle `P1`

**Acceptance (URS):** Status history and references displayed.

**Screens** — Transaction detail: state timeline, ledger journals, partner references, risk assessments, related cases and complaints.

**Workflow**
1. An agent opens a transaction and sees its full lifecycle in one view.
2. References link through to journals, partner records, cases and complaints.
3. The view is read-only.

**API** — `GET /api/admin/v1/transactions/{id}` → 200 with `history[]`, `journals[]`, `references{}`.

**Data** — joins across `payment`/`transfer`, status history, `journal`, `case`, `complaint`.

**Rules**
- `BR-ADM-005.1` The lifecycle view is strictly read-only; no state can be changed from it (`ADM-006`).
- `BR-ADM-005.2` It shows the authoritative state, the same one the customer sees (`PAY-008`).
- `BR-ADM-005.3` Sensitive elements are masked per role (`ADM-004`); risk detail is visible only to fraud roles.
- `BR-ADM-005.4` Every view is audited.

**Exceptions**
- `EX-ADM-005.1` Related record the role may not see → its existence is indicated only where doing so discloses nothing sensitive; otherwise it is omitted entirely.

**Events** — none
**Audit** — transaction views audited.

**Story `US-ADM-005`** — As a support agent, I want the whole story of a transaction in one place, so that I can answer a customer without escalating.
*Given* a customer query, *when* I open the transaction, *then* I see its state history, its ledger entries and its partner references.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ADM-005-1 | POS | Full lifecycle with references displayed |
| TC-ADM-005-2 | SEC | View is read-only |
| TC-ADM-005-3 | PRM | Risk detail hidden from non-fraud roles |
| TC-ADM-005-4 | POS | State matches what the customer sees |
| TC-ADM-005-5 | AUD | Views audited |

---

### BFR-ADM-006 — Admin cannot directly alter posted ledger records `P1`

**Acceptance (URS):** No normal UI operation edits posted ledger entry.

**Screens** — Ledger views offer no edit or delete control anywhere; corrections are raised as reversal requests.

**Workflow**
1. The admin portal exposes no write path to posted journals.
2. A correction is a reversal request, which follows the approval process and posts a linked correcting entry (`LED-003`).

**API** — no admin endpoint updates or deletes a journal; reversal is `POST /api/admin/v1/ledger/reversal-requests` with approval.

**Data** — ledger grants exclude `UPDATE`/`DELETE` for the application role (`LED-002`).

**Rules**
- `BR-ADM-006.1` The absence of an edit path is enforced at the database level, so an application bug cannot create one.
- `BR-ADM-006.2` A route-inventory test asserts that no admin route maps to a ledger mutation other than insert.
- `BR-ADM-006.3` Corrections require dual approval where configured (`ADM-009`).
- `BR-ADM-006.4` Any attempted direct alteration is a security event.

**Exceptions**
- `EX-ADM-006.1` Attempted alteration → `PERMISSION_DENIED` and denied by the database; security event raised.

**Events** — security event on attempts.
**Audit** — attempts and all reversal requests audited.

**Story `US-ADM-006`** — As an auditor, I want it to be impossible for an administrator to edit a posted ledger entry, so that the financial record cannot be adjusted by anyone inside the organisation.
*Given* a posted entry, *when* any admin path attempts to change it, *then* it is refused at both the application and the database.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ADM-006-1 | SEC | No admin route mutates a posted journal (route inventory test) |
| TC-ADM-006-2 | SEC | Database denies the attempt |
| TC-ADM-006-3 | POS | Correction only via approved reversal |
| TC-ADM-006-4 | AUD | Attempt raises a security event |

---

### BFR-ADM-007 — Controlled customer restriction `P1`

**Acceptance (URS):** Authorised role can restrict account with reason.

**Screens** — Customer ▸ Restrict (restriction type, reason, review date); Restriction banner; customer-facing explanation.

**Workflow**
1. An authorised role applies a restriction with a type and a mandatory reason.
2. The restriction takes effect immediately and is explained to the customer in plain language (`USR-007`).
3. Restrictions have a review date so they are not left indefinitely.

**API** — `POST /api/admin/v1/customers/{id}/restrict` `{type, reason, review_at}` → 200; `.../unrestrict` → 200.

**Data** — `customer.status`, `customer_status_history`

**Rules**
- `BR-ADM-007.1` A reason is mandatory; restriction without one is impossible.
- `BR-ADM-007.2` Restrictions are proportionate and typed — a restriction blocks specific capabilities, not everything by default.
- `BR-ADM-007.3` Every restriction has a review date and appears in a review queue; indefinite restrictions require senior re-authorisation.
- `BR-ADM-007.4` The customer can always still raise a complaint and access their own records (`CMP-001`).
- `BR-ADM-007.5` Removing a restriction requires the same or higher authority as applying it.

**Exceptions**
- `EX-ADM-007.1` Restriction without a reason → `VALIDATION_FAILED`.
- `EX-ADM-007.2` Restriction past its review date → escalated for decision, not silently continued.

**Events** — `customer.restricted`
**Audit** — restriction, reason, actor, review date, removal.

**Story `US-ADM-007`** — As a compliance officer, I want to restrict an account with a recorded reason and a review date, so that protective action is proportionate and does not become permanent by neglect.
*Given* a restricted customer, *when* the review date passes, *then* it is escalated for a decision rather than continuing unexamined.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ADM-007-1 | POS | Restriction applied with type and reason |
| TC-ADM-007-2 | NEG | Restriction without reason refused |
| TC-ADM-007-3 | POS | Customer can still complain and see their records |
| TC-ADM-007-4 | POS | Overdue review escalates |
| TC-ADM-007-5 | PRM | Removal requires equal or higher authority |

---

### BFR-ADM-008 — Manual overrides require a reason `P1`

**Acceptance (URS):** Override cannot complete without documented justification.

**Screens** — Every override action requires a reason before the confirm button enables.

**Workflow**
1. An override (release a held transaction, waive a check, force a state, manual retry) requires a reason.
2. The reason is stored with the override and appears in reporting.
3. Override rates are monitored (URS §21).

**API** — every override endpoint requires a non-empty `reason`; the field is validated server-side.

**Data** — `audit_event.reason` non-null for override actions.

**Rules**
- `BR-ADM-008.1` A reason is mandatory and validated server-side — not merely a required UI field.
- `BR-ADM-008.2` Reasons must be substantive; a configured minimum length and a rejection of placeholder text apply.
- `BR-ADM-008.3` Override rates per user and per type are monitored and alerted on spikes (URS §21).
- `BR-ADM-008.4` Overrides are reported to compliance periodically.

**Exceptions**
- `EX-ADM-008.1` Override without a reason → `VALIDATION_FAILED`.
- `EX-ADM-008.2` Override spike by one user → security alert and review.

**Events** — `admin.override.performed`
**Audit** — every override with actor, target, reason and before/after.

**Story `US-ADM-008`** — As a compliance officer, I want every manual override justified in writing, so that exceptional actions can be reviewed rather than assumed reasonable.
*Given* an override action, *when* it is attempted without a reason, *then* it does not complete.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ADM-008-1 | NEG | Override without a reason refused server-side |
| TC-ADM-008-2 | NEG | Placeholder reason text rejected |
| TC-ADM-008-3 | AUD | Override audited with before/after |
| TC-ADM-008-4 | SEC | Override spike alerts |

---

### BFR-ADM-009 — Dual approval for high-risk overrides `P1`

**Acceptance (URS):** Configured action requires independent second approver.

**Screens** — High-risk action ▸ "Requires second approval"; approval queue for authorised approvers.

**Workflow**
1. Actions configured as high-risk create an approval request rather than executing.
2. A second, different authorised user approves or rejects with a reason.
3. Only on approval does the action execute.

**API** — high-risk endpoints return `202` with an approval request id; `POST /api/admin/v1/approvals/{id}/approve` → 200.

**Data** — `approval_request(action, payload, requester_id, approver_id, status)`; **CHECK `approver_id <> requester_id`**

**Rules**
- `BR-ADM-009.1` Self-approval is prevented by a database constraint, not only by application logic (`GOV-008` pattern).
- `BR-ADM-009.2` Which actions require dual approval is configuration — typically large reversals, bulk operations, credential issuance, restriction removal and configuration changes.
- `BR-ADM-009.3` The approval request captures the exact payload, so the approver approves precisely what will execute.
- `BR-ADM-009.4` Requests expire unapproved; an expired request must be re-raised.

**Exceptions**
- `EX-ADM-009.1` Self-approval attempt → `PERMISSION_DENIED`, audited as a control-breach attempt.
- `EX-ADM-009.2` Payload changed after approval → execution refused; re-approval required.

**Events** — `admin.approval.requested`, `admin.approval.granted`
**Audit** — requester, approver, payload, decision, reason.

**Story `US-ADM-009`** — As a compliance officer, I want high-risk administrative actions to need two people, so that no single member of staff can act alone on something material.
*Given* a high-risk action, *when* the requester tries to approve it themselves, *then* it is refused and audited.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ADM-009-1 | POS | Second approver executes the action |
| TC-ADM-009-2 | NEG | Self-approval refused at application and database |
| TC-ADM-009-3 | NEG | Payload change after approval blocks execution |
| TC-ADM-009-4 | POS | Unapproved request expires |
| TC-ADM-009-5 | AUD | Full approval trail audited |

---

### BFR-ADM-010 — All admin actions audited `P1`

**Acceptance (URS):** Actor, action, target, before/after and timestamp available where relevant.

**Screens** — Admin ▸ Audit trail with filters; per-record "history" panels.

**Workflow**
1. Every admin action writes an audit event inside its own transaction.
2. The event records actor, action, target, before and after values, reason, correlation id and timestamp.
3. Auditors query and export; nobody can alter the trail.

**API** — `GET /api/admin/v1/audit?actor=&target=&from=&to=` → 200; `POST /api/admin/v1/audit/export` → 202.

**Data** — `audit_event`, append-only and hash-chained.

**Rules**
- `BR-ADM-010.1` If the audit write fails, the action fails — they share a transaction.
- `BR-ADM-010.2` Reads of sensitive data are audited, not only writes (`AML-010`, `ADM-003`).
- `BR-ADM-010.3` Before and after values are masked per policy where the value itself is sensitive, but actor, action and target are never masked.
- `BR-ADM-010.4` The hash chain is verified by a scheduled integrity job; a break raises a severity-one incident.
- `BR-ADM-010.5` Audit export is itself audited and alerts on volume (URS §21).

**Exceptions**
- `EX-ADM-010.1` Attempt to modify or delete an audit record → refused at application and database; security event raised.

**Events** — none (audit is the record)
**Audit** — self-evidencing.

**Story `US-ADM-010`** — As an auditor, I want a complete, tamper-evident record of everything staff do, so that the platform's internal actions can be reviewed with confidence.
*Given* any admin action, *when* I query the audit trail, *then* I find the actor, the action, the target, the before and after values and the time — and I cannot change any of it.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ADM-010-1 | AUD | Every admin action produces a complete audit record |
| TC-ADM-010-2 | AUD | Sensitive reads audited too |
| TC-ADM-010-3 | SEC | Audit records cannot be modified or deleted |
| TC-ADM-010-4 | SEC | Hash chain detects tampering |
| TC-ADM-010-5 | ERR | Audit write failure rolls back the action |
| TC-ADM-010-6 | SEC | Export audited and volume-alerted |
