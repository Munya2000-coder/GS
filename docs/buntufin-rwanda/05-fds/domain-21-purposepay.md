# BFR-FDS-21 — Domain 21: PurposePay / BuntuGoals (`GOAL`)

**Context:** Cross-Border (`switch-svc`) · **Epic:** `EPIC-GOAL` — Remittance directed at a purpose, with the control model made honest
**Wave:** W5 · **Depends on:** `XB`, `PAY`, `LED`, `PRT` · **Blocking:** `Q-10` · **Contract-pending:** `Q-27` (biller directory)

---

### BFR-GOAL-001 — Purpose-linked remittance `P2`

**Acceptance (URS):** Transfer can reference configured purpose.

**Screens** — Send abroad ▸ "What is this for?" purpose selection; Transfer detail showing the purpose.

**Workflow**
1. The sender selects a purpose from the corridor's configured purpose catalogue.
2. The purpose is stored with the transfer and included in partner submission where required.
3. The recipient sees the purpose where the product intends it.

**API** — transfer creation accepts `purpose_code`; responses include it.

**Data** — `transfer.purpose_code`, `purpose_detail`

**Rules**
- `BR-GOAL-001.1` Purpose codes come from configuration; corridor-specific regulatory purpose codes are pending `Q-10`.
- `BR-GOAL-001.2` Where a corridor requires a declared purpose, it is mandatory and validated.
- `BR-GOAL-001.3` Purpose feeds AML monitoring context (`AML-005`).
- `BR-GOAL-001.4` Free-text detail is sanitised and length-limited.

**Exceptions**
- `EX-GOAL-001.1` Purpose required but absent → `VALIDATION_FAILED`.
- `EX-GOAL-001.2` Purpose not permitted on the corridor → refused with the permitted list.

**Events** — `transfer.quote.created` carries the purpose.
**Audit** — purpose retained on the transfer.

**Story `US-GOAL-001`** — As a diaspora sender, I want to say what my transfer is for, so that it is recorded properly and, where required, declared correctly.
*Given* a corridor requiring a purpose, *when* I omit it, *then* the transfer cannot proceed.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOAL-001-1 | POS | Purpose stored and included where required |
| TC-GOAL-001-2 | NEG | Missing mandatory purpose refused |
| TC-GOAL-001-3 | NEG | Unpermitted purpose refused |
| TC-GOAL-001-4 | SEC | Free-text detail sanitised |

---

### BFR-GOAL-002 — Split remittance across permitted destinations `P1`

**Acceptance (URS):** Allocation total equals confirmed remittance amount.

**Screens** — Allocation builder: add destinations, enter amounts or percentages, with a running remainder that must reach exactly zero.

**Workflow**
1. The sender adds allocations: recipient account, approved biller, or a goal.
2. The builder enforces that allocations sum exactly to the receive amount.
3. On confirmation, each allocation becomes a leg with its own state.

**API** — `POST /api/v1/transfers/{id}/allocations` → 201; validation on submit.

**Data** — `allocation(sequence, destination_type, destination_ref, amount_minor, control_model, leg_state)`

**Rules**
- `BR-GOAL-002.1` `SUM(allocation.amount_minor) = transfer.receive_amount_minor` **exactly** — enforced by a database constraint, not only by UI validation.
- `BR-GOAL-002.2` Percentage-based splits resolve to exact minor units, with the remainder allocated to a designated leg per a documented rule (`LED-005`).
- `BR-GOAL-002.3` Each destination must be permitted for the corridor and the product.
- `BR-GOAL-002.4` The number of allocations is capped by configuration.

**Exceptions**
- `EX-GOAL-002.1` Allocations do not sum to the total → `VALIDATION_FAILED` showing the shortfall or excess; nothing is created.
- `EX-GOAL-002.2` Disallowed destination → refused with the reason.

**Events** — `transfer.allocations.created`
**Audit** — allocation set retained with the transfer.

**Story `US-GOAL-002`** — As a diaspora sender, I want to split one transfer between my family's living costs and my sibling's school fees, so that one send covers several needs precisely.
*Given* a 100,000 transfer, *when* I allocate 60,000 and 40,000, *then* it is accepted; *when* the allocations do not sum exactly, *then* it is refused.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOAL-002-1 | POS | Allocations summing exactly accepted |
| TC-GOAL-002-2 | NEG | Allocations not summing exactly refused |
| TC-GOAL-002-3 | DEC | Percentage split resolves exactly with a documented remainder rule |
| TC-GOAL-002-4 | SEC | Database constraint enforces the sum |
| TC-GOAL-002-5 | NEG | Disallowed destination refused |

---

### BFR-GOAL-003 — Family financial goals `P2`

**Acceptance (URS):** Goal can accept permitted contributions from multiple contributors.

**Screens** — Goal detail with contributors, contributions and progress; Invite a contributor.

**Workflow**
1. A goal owner creates a shared goal and invites contributors.
2. Contributors send money to the goal, including from abroad as a remittance allocation.
3. Progress reflects confirmed contributions only.

**API** — `POST /api/v1/goals` → 201; `POST /api/v1/goals/{id}/contributors` → 201; contributions arrive as payments or allocations.

**Data** — `goal`, `goal_contribution(contributor_id, amount_minor, status)`

**Rules**
- `BR-GOAL-003.1` Only invited contributors may contribute; a goal is not an open collection point.
- `BR-GOAL-003.2` Contributors see their own contributions and the goal's aggregate progress, not other contributors' personal details.
- `BR-GOAL-003.3` The goal owner's control over the funds is stated explicitly (`GOAL-009`).
- `BR-GOAL-003.4` Only confirmed contributions count (`SAV-010` principle).

**Exceptions**
- `EX-GOAL-003.1` Contribution from a non-invited party → refused.

**Events** — `goal.contribution.completed`
**Audit** — contributor invitations and contributions audited.

**Story `US-GOAL-003`** — As a family, we want several of us to contribute to one goal, so that we can fund something together and see the progress.
*Given* a shared goal, *when* two contributors send money, *then* progress reflects both, once confirmed.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOAL-003-1 | POS | Multiple contributors fund one goal |
| TC-GOAL-003-2 | NEG | Non-invited contributor refused |
| TC-GOAL-003-3 | PRM | Contributors cannot see each other's personal details |
| TC-GOAL-003-4 | NEG | Unconfirmed contribution does not count |

---

### BFR-GOAL-004 — Goal target and progress displayed `P2`

**Acceptance (URS):** Confirmed contributions update percentage accurately.

**Screens** — Goal progress bar with confirmed and pending shown separately; contribution list.

**Workflow**
1. Progress is derived from confirmed contributions against the target.
2. Pending contributions are shown separately.

**API** — `GET /api/v1/goals/{id}` → 200 `{target_minor, confirmed_minor, pending_minor, progress_pct}`.

**Data** — derived from `goal_contribution`

**Rules**
- `BR-GOAL-004.1` Progress is derived, never an incremented counter (`SAV-010`).
- `BR-GOAL-004.2` Confirmed and pending are always shown separately.
- `BR-GOAL-004.3` A reversed contribution reduces progress by linked correction.
- `BR-GOAL-004.4` Percentage is computed in minor units and rounded for display only.

**Exceptions**
- `EX-GOAL-004.1` Contributions exceeding the target → shown as over-target, not capped at 100%, so the real position is visible.

**Events** — `goal.progress.updated`
**Audit** — none additional.

**Story `US-GOAL-004`** — As a goal contributor, I want to see accurate progress, so that we know how much more is needed.
*Given* confirmed and pending contributions, *when* I view the goal, *then* they are shown separately and the percentage reflects confirmed money only.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOAL-004-1 | POS | Progress reflects confirmed contributions |
| TC-GOAL-004-2 | NEG | Pending does not inflate progress |
| TC-GOAL-004-3 | REV | Reversal reduces progress by correction |
| TC-GOAL-004-4 | DEC | Percentage computed from minor units |

---

### BFR-GOAL-005 — Approved direct institution payment `P2`

**Acceptance (URS):** Valid service-provider reference is included in transaction.

**Screens** — Allocation ▸ "Pay an institution" ▸ select biller ▸ enter and validate the account reference ▸ confirmation showing the validated account name (masked).

**Workflow**
1. The sender selects an approved biller (`GOAL-006`).
2. The account reference is validated with the biller through `BillerAdapter` before confirmation.
3. On execution the payment carries the validated reference.

**API** — `POST /api/v1/billers/{id}/validate` → 200 `{valid, account_name_masked}`; allocation created with `destination_type = BILLER`.

**Data** — `allocation.destination_ref`, biller validation result retained.

**Rules**
- `BR-GOAL-005.1` The account reference is validated with the biller **before** confirmation, so money is not sent into an unknown account.
- `BR-GOAL-005.2` The validated account name is shown masked, so the sender can confirm without exposing full third-party data.
- `BR-GOAL-005.3` The reference is included in the payment instruction exactly as validated.
- `BR-GOAL-005.4` Where a biller cannot validate, the product either does not offer direct payment to it or clearly states that validation is unavailable.

**Exceptions**
- `EX-GOAL-005.1` Validation fails → allocation refused; no payment is attempted.
- `EX-GOAL-005.2` Biller unavailable for validation → the allocation cannot be confirmed at that time.

**Events** — `transfer.allocation.executed`
**Audit** — validation result and reference retained.

**Story `US-GOAL-005`** — As a diaspora sender, I want to pay my sibling's school directly, so that the money reaches the fees and is credited to the right student account.
*Given* an approved school and a student reference, *when* I confirm, *then* the reference was validated with the school before any money moved.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOAL-005-1 | POS | Validated reference included in the payment |
| TC-GOAL-005-2 | NEG | Failed validation blocks the allocation |
| TC-GOAL-005-3 | SEC | Account name shown masked |
| TC-GOAL-005-4 | ERR | Biller unavailable prevents confirmation, no blind send |

---

### BFR-GOAL-006 — Direct-payment recipient must be verified/configured partner `P1`

**Acceptance (URS):** Unvalidated institution cannot masquerade as approved biller.

**Screens** — Biller selection lists only approved institutions; no free-text institution entry.

**Workflow**
1. Billers are onboarded through partner management with approval (`PRT-009`).
2. Only approved, active billers appear and are accepted.
3. Suspended billers disappear from selection and are rejected server-side.

**API** — `GET /api/v1/billers?corridor=` → 200 approved billers only; allocation validates the biller server-side.

**Data** — `biller` linked to an approved `partner`

**Rules**
- `BR-GOAL-006.1` There is **no** free-text institution field — a biller must exist as an approved record.
- `BR-GOAL-006.2` Biller onboarding requires approval and verification of the institution's identity and account details (`PRT-009`).
- `BR-GOAL-006.3` Biller status is checked server-side at allocation and again at execution.
- `BR-GOAL-006.4` A biller's payment details can only be changed through the approved partner change process, since this is a classic redirection-fraud vector.

**Exceptions**
- `EX-GOAL-006.1` Allocation to a non-approved biller → `VALIDATION_FAILED`.
- `EX-GOAL-006.2` Biller suspended between allocation and execution → allocation halted, sender informed, funds not sent.

**Events** — `biller.status.changed`
**Audit** — biller onboarding, changes and suspensions audited; bank-detail changes alert security.

**Story `US-GOAL-006`** — As a sender, I want to be sure the institution I am paying is genuinely the one I think, so that I cannot be tricked into paying an impostor.
*Given* an institution that is not an approved biller, *when* I try to pay it directly, *then* it is not offered and cannot be entered.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOAL-006-1 | NEG | No free-text institution entry exists |
| TC-GOAL-006-2 | NEG | Non-approved biller refused server-side |
| TC-GOAL-006-3 | SEC | Biller bank-detail change requires the approval process and alerts security |
| TC-GOAL-006-4 | INT | Suspension between allocation and execution halts the payment |

---

### BFR-GOAL-007 — Allocation breakdown before confirmation `P1`

**Acceptance (URS):** Each destination and amount displayed.

**Screens** — Confirmation screen listing every allocation: destination, amount, currency, control model and any per-leg fee.

**Workflow**
1. Before authorising, the sender sees the full allocation breakdown.
2. The breakdown is persisted with the transfer, so what was shown is provable.

**API** — `POST /api/v1/transfers/{id}/preview` → 200 with the full allocation set.

**Data** — allocation snapshot persisted with the transfer.

**Rules**
- `BR-GOAL-007.1` Every destination and amount is shown before authorisation — no summarised or truncated list.
- `BR-GOAL-007.2` Each allocation shows its control model in plain language (`GOAL-009`).
- `BR-GOAL-007.3` Per-leg fees, where they exist, are shown per leg as well as in total (`XB-005`).
- `BR-GOAL-007.4` The confirmed breakdown is persisted and appears on the receipt.

**Exceptions**
- `EX-GOAL-007.1` Allocation set changes between preview and confirmation → re-preview required; the old breakdown cannot execute.

**Events** — none
**Audit** — the confirmed breakdown retained.

**Story `US-GOAL-007`** — As a sender, I want to see exactly where each part of my money is going before I confirm, so that a split transfer holds no surprises.
*Given* a three-way split, *when* I reach confirmation, *then* all three destinations and amounts are listed.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOAL-007-1 | POS | Full breakdown displayed before confirmation |
| TC-GOAL-007-2 | POS | Control model shown per allocation |
| TC-GOAL-007-3 | NEG | Changed allocation set forces re-preview |
| TC-GOAL-007-4 | AUD | Confirmed breakdown persisted and on the receipt |

---

### BFR-GOAL-008 — Failed sub-allocation traceable `P1`

**Acceptance (URS):** Partial completion state identifies successful and failed legs.

**Screens** — Transfer detail listing each leg with its own status; a clear summary such as "2 of 3 delivered".

**Workflow**
1. Each allocation leg has its own state.
2. The parent transfer reports `PARTIALLY_DELIVERED` where legs differ.
3. Failed legs enter recovery independently (`XB-010`).

**API** — `GET /api/v1/transfers/{id}` → 200 with `allocations[].leg_state`.

**Data** — `allocation.leg_state`, per-leg status history.

**Rules**
- `BR-GOAL-008.1` A transfer is `DELIVERED` only when **every** leg is delivered; otherwise it is `PARTIALLY_DELIVERED` (`BFR-STD-001` §3).
- `BR-GOAL-008.2` Each leg's failure is independently traceable, with its own reason and recovery action.
- `BR-GOAL-008.3` A failed leg's funds are recovered independently — a partial failure never forces reversing the successful legs.
- `BR-GOAL-008.4` The sender is told exactly which legs succeeded and which did not (`NOT-008`).

**Exceptions**
- `EX-GOAL-008.1` All legs fail → the transfer fails wholly and a full refund path is created.
- `EX-GOAL-008.2` Leg fails after another leg is delivered → recovery applies to the failed leg only.

**Events** — `transfer.allocation.failed`, `transfer.delivered`
**Audit** — per-leg outcomes recorded.

**Story `US-GOAL-008`** — As a sender whose split transfer partly failed, I want to see exactly which part failed, so that I know what my family received and what needs fixing.
*Given* three legs where one fails, *when* I view the transfer, *then* two show delivered, one shows failed with its recovery path.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOAL-008-1 | POS | Per-leg states visible |
| TC-GOAL-008-2 | POS | Parent reports PARTIALLY_DELIVERED |
| TC-GOAL-008-3 | POS | Failed leg recovered independently |
| TC-GOAL-008-4 | NEG | Successful legs never reversed for another leg's failure |
| TC-GOAL-008-5 | INT | Sender notified with per-leg detail |

---

### BFR-GOAL-009 — Distinguish recipient-owned funds from sender-directed payments `P1`

**Acceptance (URS):** UX correctly identifies legal/control model.

**Screens** — Allocation shows plainly: "Your sister receives this and can use it as she wishes" versus "This is paid directly to the school and cannot be redirected".

**Workflow**
1. Each allocation carries a `control_model`.
2. `RECIPIENT_OWNED` credits the recipient's account: they control it.
3. `SENDER_DIRECTED` pays an approved biller: the recipient never controls it.
4. The distinction is shown to the sender before confirmation and to the recipient on notification.

**API** — allocations carry `control_model`; UI copy is driven by it.

**Data** — `allocation.control_model`, distinct ledger treatments per model.

**Rules**
- `BR-GOAL-009.1` The two models post to different account types — the distinction is structural in the ledger, not just a label.
- `BR-GOAL-009.2` The sender is told plainly, before confirmation, what each model means in practice.
- `BR-GOAL-009.3` The recipient is told which funds are theirs and which were paid on their behalf.
- `BR-GOAL-009.4` A sender-directed payment cannot be converted to recipient-owned after the fact, or vice versa, without a new transaction.
- `BR-GOAL-009.5` The product never implies that a sender can control money already delivered to a recipient's own account.

**Exceptions**
- `EX-GOAL-009.1` Sender attempts to recall a delivered recipient-owned allocation → refused, with an honest explanation that the funds are the recipient's.

**Events** — `transfer.delivered` carries the control model per leg.
**Audit** — control model retained per allocation.

**Story `US-GOAL-009`** — As a sender, I want to understand clearly which money my family controls and which is paid directly on their behalf, so that I am not misled about what my transfer actually does.
*Given* a split with both models, *when* I review it, *then* each allocation states plainly who controls the funds.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOAL-009-1 | POS | Control model displayed per allocation in plain language |
| TC-GOAL-009-2 | POS | Different ledger treatment per model |
| TC-GOAL-009-3 | NEG | Model cannot be changed after execution |
| TC-GOAL-009-4 | NEG | Recall of recipient-owned funds refused with an honest explanation |
| TC-GOAL-009-5 | POS | Recipient told which funds are theirs |

---

### BFR-GOAL-010 — Goal contributors receive receipts `P2`

**Acceptance (URS):** Receipt records contribution and destination.

**Screens** — Contribution receipt with amount, destination, control model, date and reference.

**Workflow**
1. On confirmed contribution or delivered allocation, a receipt is generated for the contributor.
2. The receipt names the destination and the control model.

**API** — `GET /api/v1/goals/{id}/contributions/{cid}/receipt` → 200; `GET /api/v1/transfers/{id}/receipt` includes per-leg detail.

**Data** — `receipt` per contribution/allocation.

**Rules**
- `BR-GOAL-010.1` Receipts are issued only on confirmed movements (`PAY-010`).
- `BR-GOAL-010.2` A split transfer's receipt itemises every leg with its destination and outcome.
- `BR-GOAL-010.3` Receipts name the biller for sender-directed payments, since that is what the sender is evidencing.
- `BR-GOAL-010.4` Receipts are available in the contributor's language.

**Exceptions**
- `EX-GOAL-010.1` Partially delivered transfer → the receipt shows delivered legs as delivered and failed legs as failed; it never presents the whole as complete.

**Events** — none
**Audit** — receipt generation recorded.

**Story `US-GOAL-010`** — As a contributor, I want a receipt showing where my money went, so that I have proof that the school fees were paid.
*Given* a delivered sender-directed allocation, *when* I open the receipt, *then* it names the institution, the amount, the reference and the date.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOAL-010-1 | POS | Receipt records contribution and destination |
| TC-GOAL-010-2 | POS | Split receipt itemises every leg |
| TC-GOAL-010-3 | NEG | Partially delivered transfer not shown as complete |
| TC-GOAL-010-4 | POS | Receipt available in the contributor's language |
