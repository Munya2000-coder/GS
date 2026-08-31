# BFR-FDS-12 — Domain 12: BuntuSave (`SAV`)

**Context:** Savings (`savings-svc`) · **Epic:** `EPIC-SAV` — Automated saving the customer chose and can stop
**Wave:** W3 · **Depends on:** `PAY`, `LED`, `PRT` · **Contract-pending:** `Q-26`

---

### BFR-SAV-001 — Create savings goals `P1`

**Acceptance (URS):** Goal stores target amount, target date and purpose.

**Screens** — Savings ▸ New goal (name, purpose, target amount, target date); Goal detail with progress.

**Workflow**
1. Customer creates a goal with target amount, target date and purpose.
2. The goal is linked to a savings product whose regulated provider is displayed (`SAV-009`).
3. Progress accrues only from confirmed contributions (`SAV-010`).

**API** — `POST /api/v1/savings/goals` → 201; `GET /api/v1/savings/goals` → 200.

**Data** — `savings_goal(name, purpose_code, target_amount_minor, currency, target_date, status)`

**Rules**
- `BR-SAV-001.1` Target amount is in minor units; target date must be in the future.
- `BR-SAV-001.2` A goal always displays its regulated provider before the customer commits (`GOV-002`).
- `BR-SAV-001.3` Progress is derived from confirmed contributions, never from rule configuration or intent.
- `BR-SAV-001.4` A goal can be closed; closing never deletes its contribution history.

**Exceptions**
- `EX-SAV-001.1` Target date in the past → `VALIDATION_FAILED`.
- `EX-SAV-001.2` Savings product unavailable in the customer's country or cohort → `FEATURE_DISABLED`.

**Events** — `savings.goal.created`
**Audit** — goal creation and closure audited.

**Story `US-SAV-001`** — As a customer, I want to set a savings goal with a target and a date, so that I have something concrete to save towards.
*Given* a new goal, *when* I create it, *then* it stores my target amount, date and purpose, and shows who provides the savings product.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-SAV-001-1 | POS | Goal created with target, date and purpose |
| TC-SAV-001-2 | NEG | Past target date rejected |
| TC-SAV-001-3 | POS | Provider displayed before commitment |
| TC-SAV-001-4 | POS | Closure retains contribution history |
| TC-SAV-001-5 | PRM | Only the owner sees the goal |

---

### BFR-SAV-002 — Percentage savings rules `P1`

**Acceptance (URS):** Qualifying inflow causes configured percentage transfer/instruction.

**Screens** — Rule builder ▸ "Save X% of qualifying money in"; Rule preview showing what would have been saved historically.

**Workflow**
1. Customer defines a percentage and the inflow types that qualify.
2. On a **confirmed** qualifying inflow, the rule computes the amount and executes it.
3. Execution is either an internal transfer or a provider instruction, per the product's `execution_mode`.
4. The contribution counts towards the goal only once confirmed.

**API** — `POST /api/v1/savings/rules` `{rule_type: PERCENTAGE, percentage, qualifying_types[], goal_id}` → 201.

**Data** — `savings_rule`, `savings_contribution`

**Rules**
- `BR-SAV-002.1` Rules trigger only on confirmed inflows — never on pending ones (`SAV-010`).
- `BR-SAV-002.2` Rounding is deterministic and documented; remainders are handled explicitly (`LED-005`).
- `BR-SAV-002.3` A rule never overdraws: if the computed amount exceeds available funds, it saves what is available or nothing, per the customer's configured preference, and tells them.
- `BR-SAV-002.4` Rule execution is idempotent per triggering event, so a replayed event cannot save twice (`NFR-004`).
- `BR-SAV-002.5` Percentage limits (min/max) are configuration.

**Exceptions**
- `EX-SAV-002.1` Insufficient funds → contribution skipped or reduced per preference, with a notification and a recorded reason.
- `EX-SAV-002.2` Provider instruction fails → contribution `FAILED`, goal progress unchanged, retry per policy.

**Events** — `savings.rule.created`, `savings.contribution.completed`
**Audit** — rule creation and every execution.

**Story `US-SAV-002`** — As a customer with irregular income, I want a percentage of what I receive saved automatically, so that I save when I actually have money.
*Given* a 10% rule, *when* a qualifying inflow is confirmed, *then* 10% is saved once, and my goal progresses only after confirmation.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-SAV-002-1 | POS | Confirmed inflow triggers the correct percentage |
| TC-SAV-002-2 | NEG | Pending inflow does not trigger |
| TC-SAV-002-3 | IDM | Replayed event does not save twice |
| TC-SAV-002-4 | DEC | Rounding deterministic, remainders explicit |
| TC-SAV-002-5 | NEG | Rule never overdraws the account |
| TC-SAV-002-6 | ERR | Provider failure leaves goal progress unchanged |

---

### BFR-SAV-003 — Round-up saving `P2`

**Acceptance (URS):** Eligible payment calculates correct rounding amount.

**Screens** — Rule builder ▸ round-up with the rounding base; "You rounded up X this month".

**Workflow**
1. Customer enables round-up with a configured rounding base.
2. On each confirmed eligible payment, the round-up amount is computed and saved.
3. Round-ups may be batched per configuration to avoid many tiny movements.

**API** — `POST /api/v1/savings/rules` `{rule_type: ROUND_UP, rounding_base}` → 201.

**Data** — `savings_rule.parameters`, `savings_contribution`

**Rules**
- `BR-SAV-003.1` Round-up is computed in minor units against the configured base; an exact multiple rounds up by zero, not by a full base.
- `BR-SAV-003.2` Round-ups apply only to confirmed payments (`PAY-008`).
- `BR-SAV-003.3` A reversed payment reverses its round-up (`LED-003`).
- `BR-SAV-003.4` Batching thresholds are configuration; the customer can see the batch composition.

**Exceptions**
- `EX-SAV-003.1` Payment reversed after round-up → the round-up is reversed by a linked correction.

**Events** — `savings.contribution.completed`
**Audit** — round-up computations retained with their source payment.

**Story `US-SAV-003`** — As a customer, I want my payments rounded up into savings, so that I save small amounts without noticing.
*Given* round-up to the nearest 100, *when* I pay 1,250, *then* 50 is saved.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-SAV-003-1 | POS | Round-up computed correctly |
| TC-SAV-003-2 | DEC | Exact multiple rounds up by zero |
| TC-SAV-003-3 | NEG | Unconfirmed payment produces no round-up |
| TC-SAV-003-4 | REV | Payment reversal reverses the round-up |
| TC-SAV-003-5 | POS | Batching composition visible to the customer |

---

### BFR-SAV-004 — Scheduled saving `P1`

**Acceptance (URS):** Rule runs only according to configured schedule and authority.

**Screens** — Rule builder ▸ amount and frequency; Next run date; Upcoming schedule.

**Workflow**
1. Customer sets an amount and a frequency, and authorises recurring execution.
2. The scheduler executes on the due date, checking status, limits and authority each time.
3. Each execution is recorded with its scheduled occurrence.

**API** — `POST /api/v1/savings/rules` `{rule_type: SCHEDULED, amount_minor, frequency, start_date}` → 201.

**Data** — `savings_rule`, `savings_contribution(scheduled_for)`

**Rules**
- `BR-SAV-004.1` Execution re-checks the customer's status, tier and limits at run time — a standing authority is not a bypass.
- `BR-SAV-004.2` One execution per scheduled occurrence, enforced by a unique constraint on `(rule_id, scheduled_for)`; a scheduler restart cannot double-execute.
- `BR-SAV-004.3` A missed occurrence (system down, insufficient funds) is recorded as missed, not silently skipped or retroactively executed at the wrong time.
- `BR-SAV-004.4` The customer can always see the next scheduled run and cancel before it.

**Exceptions**
- `EX-SAV-004.1` Insufficient funds → occurrence recorded as `MISSED_INSUFFICIENT_FUNDS`, customer notified.
- `EX-SAV-004.2` Customer suspended → occurrence skipped with reason, no execution.

**Events** — `savings.contribution.completed`, `savings.contribution.missed`
**Audit** — every execution and every skip with its reason.

**Story `US-SAV-004`** — As a customer, I want to save a set amount regularly, so that saving happens without me remembering.
*Given* a weekly rule, *when* the scheduler restarts on the due date, *then* exactly one contribution occurs.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-SAV-004-1 | POS | Rule runs on schedule |
| TC-SAV-004-2 | IDM | Scheduler restart does not double-execute |
| TC-SAV-004-3 | CON | Concurrent scheduler instances execute once |
| TC-SAV-004-4 | NEG | Suspended customer's occurrence skipped with reason |
| TC-SAV-004-5 | POS | Missed occurrence recorded, not silently dropped |

---

### BFR-SAV-005 — Pause savings rules `P2`

**Acceptance (URS):** Paused rule stops future automated saving actions.

**Screens** — Rule detail ▸ Pause / Resume with the effect stated.

**Workflow**
1. Customer pauses a rule.
2. Status becomes `PAUSED`; the scheduler and event handlers check status at execution time and skip.
3. Resuming restarts future executions without back-filling missed ones.

**API** — `POST /api/v1/savings/rules/{id}/pause` → 200; `.../resume` → 200.

**Data** — `savings_rule.status`, `savings_rule_status_history`

**Rules**
- `BR-SAV-005.1` Status is checked at execution time, so a queued job cannot run after a pause.
- `BR-SAV-005.2` Pausing never back-fills on resume — missed occurrences stay missed.
- `BR-SAV-005.3` Pause takes effect immediately and is confirmed to the customer.
- `BR-SAV-005.4` A rule paused by the platform (e.g. customer restricted) is distinguishable from one the customer paused.

**Exceptions**
- `EX-SAV-005.1` In-flight execution at the moment of pause → completes if already authorised; the customer is told.

**Events** — `savings.rule.paused`, `savings.rule.resumed`
**Audit** — pause and resume with actor.

**Story `US-SAV-005`** — As a customer, I want to pause automatic saving when money is tight, so that saving never pushes me into difficulty.
*Given* a paused rule, *when* a qualifying event occurs, *then* nothing is saved.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-SAV-005-1 | POS | Paused rule does not execute |
| TC-SAV-005-2 | CON | Queued job checks status at execution and skips |
| TC-SAV-005-3 | NEG | Resume does not back-fill |
| TC-SAV-005-4 | POS | Platform-paused distinguishable from customer-paused |

---

### BFR-SAV-006 — Cancel savings rules `P2`

**Acceptance (URS):** Cancelled rule does not create further transfers.

**Screens** — Rule detail ▸ Cancel, stating that saved money is unaffected.

**Workflow**
1. Customer cancels a rule; status becomes `CANCELLED` (terminal).
2. No further executions occur; existing contributions and goal progress are untouched.
3. A new rule can be created; the cancelled one is retained as history.

**API** — `DELETE /api/v1/savings/rules/{id}` → 204 (soft, status change).

**Data** — `savings_rule.status = CANCELLED`

**Rules**
- `BR-SAV-006.1` Cancellation is terminal; a cancelled rule cannot be resumed.
- `BR-SAV-006.2` Cancellation never reverses past contributions or reduces goal progress.
- `BR-SAV-006.3` The rule record is retained for history and reporting (`RPT-005`).
- `BR-SAV-006.4` The customer is told clearly that cancelling the rule does not withdraw their savings.

**Exceptions**
- `EX-SAV-006.1` Resuming a cancelled rule → `STATE_TRANSITION_INVALID`.

**Events** — `savings.rule.cancelled`
**Audit** — cancellation with actor and time.

**Story `US-SAV-006`** — As a customer, I want to stop a savings rule permanently, so that it never runs again — without losing what I already saved.
*Given* a cancelled rule, *when* qualifying events occur, *then* nothing further is saved and my existing balance is unchanged.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-SAV-006-1 | POS | Cancelled rule creates no further transfers |
| TC-SAV-006-2 | NEG | Cancellation does not reverse past contributions |
| TC-SAV-006-3 | NEG | Cancelled rule cannot be resumed |
| TC-SAV-006-4 | POS | Rule retained for reporting |

---

### BFR-SAV-007 — Merchant reserve rules `P2`

**Acceptance (URS):** Configurable percentage of merchant receipts can be allocated to reserve.

**Screens** — Merchant ▸ Reserve settings (percentage, target); Reserve balance and history.

**Workflow**
1. Merchant configures a percentage of receipts to allocate to a business reserve.
2. On each confirmed merchant receipt, the reserve amount is computed and allocated.
3. Reserve activity contributes to the merchant's Passport savings indicators where consented.

**API** — `POST /api/v1/merchants/{id}/reserve-rule` → 201; `GET /api/v1/merchants/{id}/reserve` → 200.

**Data** — `savings_rule(rule_type = MERCHANT_RESERVE)`, `savings_goal` of type reserve

**Rules**
- `BR-SAV-007.1` Only confirmed merchant receipts trigger a reserve allocation (`BIZ-004/005`).
- `BR-SAV-007.2` Self-reported cash sales do **not** trigger reserve allocation — there is no digital money to allocate (`BIZ-006`).
- `BR-SAV-007.3` The merchant can withdraw from reserve subject to configured rules; reserve is not a lock-up unless the product says so.
- `BR-SAV-007.4` Reserve allocation is visible on the merchant's daily settlement view so it is never a surprise deduction.

**Exceptions**
- `EX-SAV-007.1` Receipt reversed → reserve allocation reversed by linked correction.

**Events** — `savings.contribution.completed` referencing the merchant receipt.
**Audit** — reserve rule changes and allocations.

**Story `US-SAV-007`** — As a merchant, I want a share of my takings set aside automatically, so that I build a buffer without having to be disciplined every day.
*Given* a 5% reserve rule, *when* a digital sale is confirmed, *then* 5% is allocated to reserve and shown on my settlement view.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-SAV-007-1 | POS | Confirmed receipt allocates the configured percentage |
| TC-SAV-007-2 | NEG | Self-reported cash sale triggers no allocation |
| TC-SAV-007-3 | REV | Reversed receipt reverses the allocation |
| TC-SAV-007-4 | POS | Allocation visible on settlement view |
| TC-SAV-007-5 | DEC | Percentage arithmetic exact in minor units |

---

### BFR-SAV-008 — Recommendations require opt-in before activation `P1`

**Acceptance (URS):** Recommendation alone cannot move funds.

**Screens** — Suggestion card ("Based on your income you could save X") with an explicit "Set this up" action — never an auto-enable toggle.

**Workflow**
1. The platform may suggest a savings rule based on observed patterns.
2. The suggestion is inert: it creates nothing until the customer explicitly accepts.
3. On acceptance a normal rule is created, with `opt_in_at` recorded.

**API** — `GET /api/v1/savings/recommendations` → 200 (inert); `POST /api/v1/savings/rules` from a recommendation → 201.

**Data** — `savings_rule.opt_in_at` NOT NULL where the rule originated from a recommendation; `recommendation_id` retained.

**Rules**
- `BR-SAV-008.1` A recommendation has **no** execution path — it is data, not a rule. There is no code that executes a recommendation.
- `BR-SAV-008.2` The opt-in action and its timestamp are recorded and auditable.
- `BR-SAV-008.3` Recommendations are framed as guidance, not promises (`FH-006`).
- `BR-SAV-008.4` Dismissed recommendations are not re-shown within the configured cool-off.

**Exceptions**
- `EX-SAV-008.1` Any attempt to execute a recommendation directly → rejected; there is no such endpoint.

**Events** — `savings.rule.created` on acceptance only.
**Audit** — opt-in recorded with the originating recommendation.

**Story `US-SAV-008`** — As a customer, I want suggestions to stay suggestions until I accept them, so that money never moves because an algorithm thought it should.
*Given* a savings recommendation, *when* I take no action, *then* no funds move and no rule exists.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-SAV-008-1 | NEG | Recommendation alone moves no funds |
| TC-SAV-008-2 | SEC | No endpoint executes a recommendation directly |
| TC-SAV-008-3 | POS | Acceptance creates a rule with opt-in recorded |
| TC-SAV-008-4 | AUD | Opt-in auditable with the originating recommendation |

---

### BFR-SAV-009 — Regulated savings provider identifiable `P1`

**Acceptance (URS):** Customer can see who legally holds/provides savings product.

**Screens** — Goal detail ▸ "Your savings are held by …" with the provider and its regulatory reference; shown before the first contribution.

**Workflow**
1. Every savings product declares its legal provider (`GOV-002`).
2. The provider is displayed at goal creation, on the goal detail and on statements and receipts.

**API** — savings responses include `legal_provider {partner_id, display_name, regulatory_reference}`.

**Data** — `product_version.legal_provider_partner_id`

**Rules**
- `BR-SAV-009.1` A savings goal cannot be created against a product without a legal provider.
- `BR-SAV-009.2` The provider is shown **before** the first contribution, not buried in terms.
- `BR-SAV-009.3` A change of provider requires customer notification and, where the terms change materially, renewed acceptance (`CON-010`).
- `BR-SAV-009.4` Where BuntuFin is not the provider, the platform never implies that it is (`Q-01`).

**Exceptions**
- `EX-SAV-009.1` Provider suspended → no new contributions; existing balances remain with the provider and the customer is informed (`PRT-003`).

**Events** — `savings.provider.changed`
**Audit** — provider binding and changes audited.

**Story `US-SAV-009`** — As a customer, I want to know which licensed institution actually holds my savings, so that I know who is accountable for my money.
*Given* a savings goal, *when* I view it, *then* the legal provider is stated plainly before I contribute.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-SAV-009-1 | POS | Provider displayed before first contribution |
| TC-SAV-009-2 | NEG | Goal cannot be created without a provider |
| TC-SAV-009-3 | POS | Provider change notifies the customer |
| TC-SAV-009-4 | INT | Suspended provider blocks new contributions |
| TC-SAV-009-5 | POS | Provider shown on statements and receipts |

---

### BFR-SAV-010 — Goal progress updates after confirmed movements `P1`

**Acceptance (URS):** Failed or pending transfers do not inflate achieved savings.

**Screens** — Goal progress bar reflecting confirmed contributions only; pending contributions shown separately.

**Workflow**
1. A contribution is created in `PENDING`.
2. Only on authoritative confirmation does it become `CONFIRMED` and count towards progress.
3. Failed contributions are recorded, visible, and excluded from progress.

**API** — `GET /api/v1/savings/goals/{id}` → 200 `{confirmed_minor, pending_minor, target_minor, progress_pct}`.

**Data** — `savings_contribution.status`, goal progress derived from confirmed rows only.

**Rules**
- `BR-SAV-010.1` Progress is **derived**, never stored as an incrementable counter that could drift.
- `BR-SAV-010.2` Pending and confirmed amounts are displayed separately; they are never summed into one progress figure.
- `BR-SAV-010.3` A reversed contribution reduces progress via a linked correction (`LED-003`).
- `BR-SAV-010.4` Passport savings metrics use confirmed contributions only (`FP-006`).

**Exceptions**
- `EX-SAV-010.1` Contribution fails after being displayed as pending → progress unchanged; the failure is shown and notified (`NOT-008`).

**Events** — `savings.contribution.completed` only on confirmation.
**Audit** — contribution state transitions recorded.

**Story `US-SAV-010`** — As a customer, I want my goal progress to reflect only money that actually arrived, so that I am never misled about how much I have saved.
*Given* a pending contribution, *when* I view my goal, *then* it is shown as pending and my confirmed progress is unchanged until it settles.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-SAV-010-1 | POS | Confirmed contribution advances progress |
| TC-SAV-010-2 | NEG | Pending contribution does not advance progress |
| TC-SAV-010-3 | NEG | Failed contribution does not advance progress |
| TC-SAV-010-4 | REV | Reversal reduces progress via a linked correction |
| TC-SAV-010-5 | POS | Progress derived, not stored as a counter |
| TC-SAV-010-6 | INT | Passport savings metrics use confirmed only |
