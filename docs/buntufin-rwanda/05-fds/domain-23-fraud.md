# BFR-FDS-23 — Domain 23: Fraud Management (`FRD`)

**Context:** Compliance (`compliance-svc`) · **Epic:** `EPIC-FRD` — Stop fraud without deleting evidence or locking out genuine customers
**Wave:** W6 · **Depends on:** `auth-svc`, `PAY`, `LED` · **Parameterised:** `Q-18`

---

### BFR-FRD-001 — New-device risk detected `P1`

**Acceptance (URS):** New device generates configured risk signal.

**Screens** — Security ▸ My devices; "New device signed in" notification.

**Workflow**
1. Each authentication carries a device identifier and attributes.
2. A first-seen device creates a `risk_event` and a non-suppressible security notification (`NOT-005`).
3. Risk contributes to the score for subsequent actions in that session.

**API** — internal; `GET /api/v1/security/devices` → 200.

**Data** — `device`, `risk_event(type = NEW_DEVICE)`

**Rules**
- `BR-FRD-001.1` New-device detection is based on a stable device identifier plus corroborating attributes, not on IP alone.
- `BR-FRD-001.2` A new device raises a signal, not an automatic block — blocking every new device would exclude customers who change phones.
- `BR-FRD-001.3` The security notification cannot be suppressed by preference (`NOT-005`).
- `BR-FRD-001.4` The customer can see and remove their devices (`BFR-STD-005`).

**Exceptions**
- `EX-FRD-001.1` New device attempting a high-value action → step-up required (`FRD-006`).

**Events** — `fraud.risk_event.created`
**Audit** — device first-seen recorded.

**Story `US-FRD-001`** — As a customer, I want to be told when my account is used on a new device, so that I can react quickly if it was not me.
*Given* a sign-in from an unrecognised device, *when* it succeeds, *then* I receive a security notification I cannot have turned off.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FRD-001-1 | POS | New device raises a risk event and notification |
| TC-FRD-001-2 | NEG | Notification not suppressible |
| TC-FRD-001-3 | NEG | New device alone does not block access |
| TC-FRD-001-4 | POS | Customer can remove a device and revoke its tokens |

---

### BFR-FRD-002 — Abnormal login attempts detected `P1`

**Acceptance (URS):** Threshold breach can trigger step-up/block.

**Screens** — Lockout message with a recovery route; Admin ▸ authentication anomalies.

**Workflow**
1. Failed attempts are counted per account and per source.
2. Configured thresholds trigger progressive delay, step-up or temporary lockout.
3. Patterns across accounts feed credential-stuffing detection (URS §21).

**API** — enforced in `auth-svc`; responses use `RATE_LIMITED` / `STEP_UP_REQUIRED`.

**Data** — authentication attempt counters, `risk_event`

**Rules**
- `BR-FRD-002.1` Counting is per account **and** per source, so neither a targeted nor a broad attack is missed.
- `BR-FRD-002.2` Lockout is temporary and always has a recovery route — a customer is never permanently locked out by an attacker's actions.
- `BR-FRD-002.3` Responses do not reveal whether an account exists (URS §21).
- `BR-FRD-002.4` Thresholds are configuration (`Q-18`).

**Exceptions**
- `EX-FRD-002.1` Threshold breach → `RATE_LIMITED` with a neutral message and a recovery route.

**Events** — `fraud.risk_event.created`; security alert on distributed patterns.
**Audit** — failures and lockouts recorded.

**Story `US-FRD-002`** — As a customer, I want repeated failed attempts on my account stopped, so that someone guessing my PIN cannot get in — and I can still recover my own access.
*Given* repeated failures, *when* the threshold is reached, *then* attempts are blocked temporarily and I am given a recovery route.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FRD-002-1 | POS | Threshold breach triggers the configured response |
| TC-FRD-002-2 | SEC | Response does not disclose account existence |
| TC-FRD-002-3 | POS | Recovery route always available |
| TC-FRD-002-4 | SEC | Distributed pattern raises a security alert |

---

### BFR-FRD-003 — Beneficiary-risk signals monitored `P1`

**Acceptance (URS):** Newly added high-value beneficiary can increase risk score.

**Screens** — First payment to a new beneficiary shows a caution and may require step-up.

**Workflow**
1. Adding a beneficiary creates a risk event with its age tracked.
2. A first or high-value payment to a new beneficiary raises the transaction's risk score.
3. Configured thresholds trigger step-up or review.

**API** — internal scoring on payment creation.

**Data** — `beneficiary(created_at, first_payment_at)`, `risk_event`

**Rules**
- `BR-FRD-003.1` Beneficiary age is a risk input; a cooling-off period may be configured for high-value first payments.
- `BR-FRD-003.2` Beneficiary changes (name or account) reset the risk age — a classic redirection-fraud pattern.
- `BR-FRD-003.3` The customer is shown a proportionate caution, not an accusation.
- `BR-FRD-003.4` Beneficiary risk combines with device and behaviour risk rather than being evaluated alone.

**Exceptions**
- `EX-FRD-003.1` High-value payment to a beneficiary added minutes ago → step-up required, and manual review where configured.

**Events** — `fraud.risk_event.created`
**Audit** — beneficiary additions and changes audited.

**Story `US-FRD-003`** — As a customer, I want extra checks on a large first payment to a brand-new payee, so that I am protected if someone has taken over my account or tricked me.
*Given* a newly added beneficiary and a high-value payment, *when* I authorise it, *then* a step-up challenge is required.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FRD-003-1 | POS | New high-value beneficiary raises the risk score |
| TC-FRD-003-2 | POS | Beneficiary detail change resets risk age |
| TC-FRD-003-3 | POS | Step-up triggered at the configured threshold |
| TC-FRD-003-4 | POS | Caution wording is proportionate, not accusatory |

---

### BFR-FRD-004 — Account-takeover indicators detected `P1`

**Acceptance (URS):** Configured signals create risk event.

**Screens** — Security alert notification; Admin ▸ ATO signals queue.

**Workflow**
1. ATO indicators are evaluated: credential change followed by a beneficiary addition and a large payment; recovery followed by immediate activity; device change with contact-detail change.
2. Matching patterns create risk events and may restrict activity for a configured window.

**API** — internal.

**Data** — `risk_event(type = ATO_INDICATOR)`

**Rules**
- `BR-FRD-004.1` ATO detection is pattern-based across events, not single-signal.
- `BR-FRD-004.2` A post-recovery restriction window limits high-risk actions (`BFR-STD-005` §4).
- `BR-FRD-004.3` Notifications go to the **previous** contact point as well as the current one, so a takeover cannot silence the alert.
- `BR-FRD-004.4` A confirmed ATO creates a case and may restrict the account (`ADM-007`).

**Exceptions**
- `EX-FRD-004.1` Strong ATO pattern → high-risk actions blocked pending verification, with the customer given a route to prove identity.

**Events** — `fraud.alert.created`
**Audit** — signals, restrictions and their resolution.

**Story `US-FRD-004`** — As a customer, I want takeover patterns detected and the alert sent to my old contact details too, so that an attacker cannot both take over my account and hide it from me.
*Given* a credential change followed immediately by a new beneficiary and a large payment, *when* the pattern is evaluated, *then* a risk event is created and high-risk actions are restricted.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FRD-004-1 | POS | ATO pattern creates a risk event |
| TC-FRD-004-2 | POS | Notification also sent to the previous contact point |
| TC-FRD-004-3 | POS | Post-recovery window restricts high-risk actions |
| TC-FRD-004-4 | POS | Genuine customer has a verification route |

---

### BFR-FRD-005 — Risk level assigned `P1`

**Acceptance (URS):** LOW/MEDIUM/HIGH/CRITICAL or equivalent stored.

**Screens** — Admin ▸ transaction risk panel showing band, score and contributing signals.

**Workflow**
1. Signals are combined by the rule set into a numeric score.
2. The score maps to a band by configured boundaries.
3. Score, band, rule-set version and contributing signals are stored.

**API** — internal; `GET /api/admin/v1/transactions/{id}/risk` → 200.

**Data** — `risk_assessment(score, band, ruleset_version, signals[])`

**Rules**
- `BR-FRD-005.1` Score, band, rule-set version and signals are all persisted — a band without its basis is not reviewable.
- `BR-FRD-005.2` Band boundaries are configuration (`Q-18`).
- `BR-FRD-005.3` The assessment is reproducible from its stored signals and version.
- `BR-FRD-005.4` Risk data is restricted to fraud roles and never shown to the customer as a score (`USR-006`).

**Exceptions**
- `EX-FRD-005.1` Scoring engine unavailable → the configured fail-safe applies (typically step-up for money movement), never a silent pass.

**Events** — `fraud.risk.assessed`
**Audit** — assessments retained.

**Story `US-FRD-005`** — As a fraud analyst, I want each transaction's risk band recorded with its contributing signals, so that I can review why an action was challenged or held.
*Given* an assessed transaction, *when* I inspect it, *then* I see the band, the score, the signals and the rule-set version.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FRD-005-1 | POS | Band and score persisted with signals and version |
| TC-FRD-005-2 | POS | Assessment reproducible from stored data |
| TC-FRD-005-3 | PRM | Risk data restricted to fraud roles |
| TC-FRD-005-4 | ERR | Engine outage applies the fail-safe, never a silent pass |

---

### BFR-FRD-006 — Risk rules may trigger step-up authentication `P1`

**Acceptance (URS):** Transaction cannot proceed until required challenge passes.

**Screens** — Step-up challenge inline in the payment flow, with an explanation of why.

**Workflow**
1. A risk band or rule demands step-up.
2. The transaction's state machine is blocked at `AUTHORISATION_PENDING` until the challenge passes.
3. A passed challenge is recorded; a failed one fails the transaction.

**API** — payment authorisation returns `STEP_UP_REQUIRED` with the challenge; `POST /api/v1/auth/step-up/verify` → 200.

**Data** — `step_up_challenge(risk_event_id, type, status, attempts)`

**Rules**
- `BR-FRD-006.1` The state machine cannot advance past `AUTHORISATION_PENDING` without a passed challenge — enforced by a transition guard, not by UI flow.
- `BR-FRD-006.2` Challenges expire and are attempt-limited.
- `BR-FRD-006.3` The customer is told a check is needed, without being told which rule fired (`SEC`).
- `BR-FRD-006.4` A passed challenge is bound to that specific transaction; it cannot be reused for another.

**Exceptions**
- `EX-FRD-006.1` Challenge failed or expired → transaction `FAILED`; no funds move.
- `EX-FRD-006.2` `CRITICAL` band → not challengeable; routed to manual review (`FRD-007`).

**Events** — `fraud.step_up.required`, `fraud.step_up.passed`
**Audit** — challenges and outcomes recorded.

**Story `US-FRD-006`** — As a customer, I want an extra check on a risky transaction, so that a fraudster with my phone cannot simply push a payment through.
*Given* a transaction requiring step-up, *when* the challenge is not passed, *then* the payment does not proceed by any route.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FRD-006-1 | POS | Passed challenge allows the transaction |
| TC-FRD-006-2 | NEG | Unpassed challenge blocks it at the state machine |
| TC-FRD-006-3 | SEC | Challenge cannot be reused for another transaction |
| TC-FRD-006-4 | SEC | Rule detail not disclosed to the customer |
| TC-FRD-006-5 | NEG | CRITICAL band is not challengeable |

---

### BFR-FRD-007 — High-risk transaction may enter manual review `P1`

**Acceptance (URS):** Transaction state clearly indicates hold/review.

**Screens** — Customer sees "This is being checked" with an expectation; Admin ▸ review queue with evidence.

**Workflow**
1. A high-risk transaction moves to a hold state and creates a case.
2. An analyst reviews and releases or blocks with a reason.
3. The customer is kept informed at each step.

**API** — `GET /api/admin/v1/transactions?state=HELD` → 200; `POST .../release` and `.../block` → 200 (reason required).

**Data** — transaction hold state, `case`, `ledger.hold` retained meanwhile (`LED-004`)

**Rules**
- `BR-FRD-007.1` A held transaction shows honestly as held; it is never presented as completed or failed while under review (`PAY-008`).
- `BR-FRD-007.2` Funds remain held, not posted, while under review (`LED-004`).
- `BR-FRD-007.3` Holds have a target review time; ageing holds are escalated so customers are not left indefinitely.
- `BR-FRD-007.4` Release or block requires an authorised analyst and a reason.

**Exceptions**
- `EX-FRD-007.1` Review not completed within the target → escalated automatically; the customer receives an update rather than silence.

**Events** — `fraud.alert.created`, `transaction.held`
**Audit** — hold, review, decision and reason.

**Story `US-FRD-007`** — As a customer, I want to be told plainly when my payment is being checked, so that I am not left thinking it failed or succeeded.
*Given* a held transaction, *when* I view it, *then* it shows as under review with an expectation of when I will hear.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FRD-007-1 | POS | Held state shown honestly to the customer |
| TC-FRD-007-2 | POS | Funds held, not posted, during review |
| TC-FRD-007-3 | PRM | Only an authorised analyst releases or blocks |
| TC-FRD-007-4 | NEG | Decision without a reason refused |
| TC-FRD-007-5 | INT | Ageing hold escalates and the customer is updated |

---

### BFR-FRD-008 — Analyst creates disposition `P1`

**Acceptance (URS):** Alert closes only with authorised outcome.

**Screens** — Alert ▸ Close with disposition (controlled list) and narrative.

**Workflow**
1. The analyst selects a disposition from the controlled list and adds a narrative.
2. Closure is permitted only with an authorised outcome and role.
3. The disposition drives downstream action (release, block, restrict, refer).

**API** — `POST /api/admin/v1/alerts/{id}/disposition` → 200.

**Data** — `disposition(type, narrative, decided_by, decided_at)`

**Rules**
- `BR-FRD-008.1` An alert cannot close without a disposition — same constraint pattern as `AML-009`.
- `BR-FRD-008.2` Dispositions come from a controlled list, so outcomes are analysable.
- `BR-FRD-008.3` Certain dispositions (confirmed fraud) require a senior role.
- `BR-FRD-008.4` A disposition may trigger a customer restriction, which is separately audited (`ADM-007`).

**Exceptions**
- `EX-FRD-008.1` Closure without disposition → refused by application and database.
- `EX-FRD-008.2` Disposition beyond the analyst's authority → `PERMISSION_DENIED`.

**Events** — `fraud.alert.closed`
**Audit** — disposition, narrative, actor.

**Story `US-FRD-008`** — As a fraud manager, I want alerts closed only with a recorded outcome, so that our decisions are analysable and defensible.
*Given* an open alert, *when* closure is attempted without a disposition, *then* it is refused.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FRD-008-1 | NEG | Closure without disposition refused |
| TC-FRD-008-2 | SEC | Database constraint enforces it |
| TC-FRD-008-3 | PRM | Senior-only dispositions restricted |
| TC-FRD-008-4 | AUD | Disposition audited with narrative |

---

### BFR-FRD-009 — False-positive outcomes retained `P2`

**Acceptance (URS):** Historical disposition is queryable.

**Screens** — Admin ▸ Rule performance: hit rate, false-positive rate, customer-impact metrics per rule.

**Workflow**
1. Every disposition is retained, including false positives.
2. Rule performance is computed from dispositions.
3. Analysts use the data to tune rules (`FRD-005` rule set versioning).

**API** — `GET /api/admin/v1/fraud/rule-performance?from=&to=` → 200.

**Data** — `disposition` retained per the retention schedule.

**Rules**
- `BR-FRD-009.1` False positives are retained deliberately, because rule tuning without them is guesswork.
- `BR-FRD-009.2` Performance is reported per rule version, so the effect of a change is measurable.
- `BR-FRD-009.3` Customer friction (step-ups, holds) is reported alongside detection, so tuning weighs both sides.
- `BR-FRD-009.4` The data informs rule changes but never automatically retrains a live model (URS §9).

**Exceptions**
- `EX-FRD-009.1` Retention limit reached → aggregate statistics retained after individual records are disposed of.

**Events** — none
**Audit** — none additional.

**Story `US-FRD-009`** — As a fraud manager, I want false positives retained and measurable, so that I can reduce customer friction without weakening detection.
*Given* dispositions over a period, *when* I review rule performance, *then* I see hit rate, false-positive rate and customer impact per rule version.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FRD-009-1 | POS | False positives retained and queryable |
| TC-FRD-009-2 | POS | Performance reported per rule version |
| TC-FRD-009-3 | POS | Customer friction reported alongside detection |
| TC-FRD-009-4 | NEG | No automatic live retraining |

---

### BFR-FRD-010 — Fraud decisions do not silently delete financial events `P1`

**Acceptance (URS):** Held/blocked/reversed transactions remain auditable.

**Screens** — Blocked or reversed transactions remain visible in history, marked with their outcome.

**Workflow**
1. Blocking prevents progression; it does not remove the transaction.
2. Reversing posts a linked correction (`LED-003`).
3. All states remain in history and in the audit trail.

**API** — no delete endpoint exists for transactions or risk events.

**Data** — transaction and journal records immutable (`LED-002`); `risk_event` append-only.

**Rules**
- `BR-FRD-010.1` No fraud action deletes a financial record — the capability does not exist for any role.
- `BR-FRD-010.2` A blocked transaction remains visible to the customer with an honest status.
- `BR-FRD-010.3` A reversal is a linked correction, never a removal (`LED-003`).
- `BR-FRD-010.4` Risk events and dispositions are retained even where the transaction was ultimately released.
- `BR-FRD-010.5` The customer can complain about a fraud decision (`CMP-001`), which requires the evidence to still exist.

**Exceptions**
- `EX-FRD-010.1` Delete attempt → `PERMISSION_DENIED`, audited as a control-breach attempt.

**Events** — `payment.reversed`, `transaction.blocked`
**Audit** — all fraud actions audited with actor and reason.

**Story `US-FRD-010`** — As an auditor, I want fraud actions to leave the financial record intact, so that a customer challenging a block can be shown exactly what happened.
*Given* a blocked transaction, *when* the customer disputes it, *then* the transaction, the risk events and the decision are all still available.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FRD-010-1 | SEC | No delete path exists for financial records |
| TC-FRD-010-2 | POS | Blocked transaction remains visible with an honest status |
| TC-FRD-010-3 | REV | Reversal is a linked correction |
| TC-FRD-010-4 | POS | Risk events retained after release |
| TC-FRD-010-5 | AUD | Delete attempt audited |
