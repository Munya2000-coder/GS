# BFR-FDS-14 — Domain 14: Circle Governance and Payouts (`CG`)

**Context:** Circles (`circle-svc`) · **Epic:** `EPIC-CG` — Group decisions that cannot be quietly overridden
**Wave:** W3 · **Depends on:** `CIR`, `LED`, `NOT`

---

### BFR-CG-001 — Configurable voting `P1`

**Acceptance (URS):** Proposal can define threshold and voting period.

**Screens** — Proposals list; New proposal (type, detail, threshold, closing date); Proposal detail with live tally.

**Workflow**
1. An authorised member raises a proposal (rule change, payout-order change, distribution, member exit, closure).
2. The threshold and voting period come from the current rule version, or from the proposal within permitted bounds.
3. Members vote; the tally is visible; the proposal closes at its deadline or when the outcome is mathematically settled.

**API** — `POST /api/v1/circles/{id}/proposals` → 201; `POST .../proposals/{pid}/votes` → 201; `GET .../proposals/{pid}` → 200.

**Data** — `proposal(type, threshold_type, threshold_value, opens_at, closes_at, status)`, `vote`

**Rules**
- `BR-CG-001.1` The threshold is fixed at proposal creation and cannot change while the proposal is open.
- `BR-CG-001.2` Only accepted members eligible under the rule version may vote (`CIR-004`).
- `BR-CG-001.3` One vote per member per proposal; changing a vote before close is permitted only if the rule version allows, and both are recorded.
- `BR-CG-001.4` The eligible-voter set is frozen at proposal creation, so membership changes during voting cannot alter the denominator.
- `BR-CG-001.5` A proposal that fails to reach its threshold by its deadline is `REJECTED`, never silently extended.

**Exceptions**
- `EX-CG-001.1` Vote after close → `STATE_TRANSITION_INVALID`.
- `EX-CG-001.2` Vote by an ineligible member → `PERMISSION_DENIED`.

**Events** — `circle.vote.created`, `circle.vote.closed`
**Audit** — proposal, every vote and the outcome.

**Story `US-CG-001`** — As a Circle member, I want group decisions made by a vote with a clear threshold and deadline, so that no one can decide alone.
*Given* an open proposal, *when* the deadline passes without the threshold being met, *then* it is rejected and recorded.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CG-001-1 | POS | Proposal with threshold and period reaches an outcome |
| TC-CG-001-2 | NEG | Vote after close refused |
| TC-CG-001-3 | PRM | Ineligible member cannot vote |
| TC-CG-001-4 | NEG | Threshold cannot change while open |
| TC-CG-001-5 | POS | Voter set frozen at creation |
| TC-CG-001-6 | AUD | Every vote audited |

---

### BFR-CG-002 — Multiple approval thresholds `P1`

**Acceptance (URS):** Payment can require N-of-M approvals.

**Screens** — Payout request ▸ approvals progress ("2 of 3 approved"); Approver action panel.

**Workflow**
1. A payout or distribution creates an approval request with N-of-M from the rule version.
2. M is the count of eligible signatories at creation, frozen for that request.
3. On reaching N approvals, execution proceeds; on rejection or expiry it does not.

**API** — `POST /api/v1/circles/{id}/payouts` → 201; `POST .../payouts/{pid}/approve` → 200; `.../reject` → 200.

**Data** — `approval(request_id, approver_id, decision, decided_at)`, `payout.required_approvals`

**Rules**
- `BR-CG-002.1` No money moves before the Nth approval — approval is a precondition of the ledger posting, not a parallel record.
- `BR-CG-002.2` M is frozen at request creation; adding signatories mid-request cannot change the requirement.
- `BR-CG-002.3` The requester may approve only if the rule version permits; by default they may not.
- `BR-CG-002.4` Approvals expire with the request; an expired request must be re-raised.

**Exceptions**
- `EX-CG-002.1` Execution attempted below threshold → refused, audited.
- `EX-CG-002.2` Signatory removed mid-request → their approval stands or is voided per the rule version, and the effect on the tally is shown.

**Events** — `circle.payout.approved`, `circle.payout.completed`
**Audit** — every approval and rejection with actor and time.

**Story `US-CG-002`** — As a Circle member, I want group payments to need several signatories, so that one person cannot move the group's money alone.
*Given* a 2-of-3 requirement, *when* only one approval exists, *then* no funds move.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CG-002-1 | POS | Payout executes at the Nth approval |
| TC-CG-002-2 | NEG | Execution below threshold refused |
| TC-CG-002-3 | CON | Concurrent approvals cannot over-count |
| TC-CG-002-4 | NEG | M frozen at creation |
| TC-CG-002-5 | AUD | Every approval audited |

---

### BFR-CG-003 — Approver cannot approve the same request twice `P1`

**Acceptance (URS):** Duplicate approval is rejected.

**Screens** — Approve button disabled after use, with "You approved this on …".

**Workflow**
1. An approval is recorded against `(request_id, approver_id)`.
2. A second approval from the same approver is rejected by a unique constraint.

**API** — `POST .../approve` returns `409 DUPLICATE_RESOURCE` on a second attempt.

**Data** — `approval` UNIQUE `(request_id, approver_id)`

**Rules**
- `BR-CG-003.1` Uniqueness is enforced by a database constraint, so it holds under concurrency.
- `BR-CG-003.2` A duplicate attempt does not increment the tally and is audited.
- `BR-CG-003.3` Changing an approval to a rejection, where the rule version permits, replaces rather than adds — the tally never counts one person twice.
- `BR-CG-003.4` The same natural person holding two Circle roles still counts once.

**Exceptions**
- `EX-CG-003.1` Duplicate approval → `DUPLICATE_RESOURCE`, tally unchanged.

**Events** — none additional
**Audit** — duplicate attempts recorded (a signal of confusion or manipulation).

**Story `US-CG-003`** — As a Circle member, I want one approver to count once, so that the approval threshold means what it says.
*Given* an approver who has already approved, *when* they approve again, *then* it is rejected and the tally is unchanged.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CG-003-1 | NEG | Second approval rejected |
| TC-CG-003-2 | CON | Concurrent duplicate approvals counted once |
| TC-CG-003-3 | SEC | Database constraint enforces uniqueness |
| TC-CG-003-4 | NEG | Dual-role member counts once |

---

### BFR-CG-004 — Payout sequence visible to members `P1`

**Acceptance (URS):** Current and future planned recipients are displayed.

**Screens** — Circle ▸ Payout order: past (with dates and amounts), current, and future positions.

**Workflow**
1. The payout order is published to all members at activation.
2. Completed, current and upcoming positions are all shown.
3. Any change is visible with its governance record (`CG-005`).

**API** — `GET /api/v1/circles/{id}/payout-order` → 200 with status per position.

**Data** — `payout_order`, `circle_payout`

**Rules**
- `BR-CG-004.1` Every member sees the whole sequence, not only their own position.
- `BR-CG-004.2` Changes are shown with who proposed and approved them, and when.
- `BR-CG-004.3` Expected dates are shown, with the caveat that they depend on collection.
- `BR-CG-004.4` Completed payouts show the actual amount and date.

**Exceptions**
- `EX-CG-004.1` Sequence disrupted by a missed collection → the recalculated expectation is shown with the reason, never silently reordered.

**Events** — `circle.payout.completed`
**Audit** — order publication and changes.

**Story `US-CG-004`** — As a Circle member, I want to see the whole payout order, so that everyone can see the arrangement is being followed.
*Given* an active rotating Circle, *when* I view the payout order, *then* I see past, current and future recipients.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CG-004-1 | POS | Full sequence visible to every member |
| TC-CG-004-2 | POS | Changes shown with their governance record |
| TC-CG-004-3 | POS | Completed payouts show actual amount and date |
| TC-CG-004-4 | POS | Disruption shown with a reason |

---

### BFR-CG-005 — Payout-order changes follow rules `P1`

**Acceptance (URS):** Unauthorised administrator cannot silently reorder recipients.

**Screens** — Reorder is available only as a proposal, never as a direct edit.

**Workflow**
1. A reorder is raised as a proposal (`CG-001`) with a reason.
2. It requires the rule version's threshold.
3. On approval the new order takes effect and every member is notified.

**API** — reorder is only available as `POST .../proposals` with `type = PAYOUT_ORDER_CHANGE`; no direct update endpoint exists.

**Data** — `payout_order` versioned by proposal.

**Rules**
- `BR-CG-005.1` **No direct reorder endpoint exists** — the only route is governance.
- `BR-CG-005.2` Every change records proposer, approvers, reason and timestamp.
- `BR-CG-005.3` All members are notified of an approved change.
- `BR-CG-005.4` A change cannot retroactively alter a completed payout.

**Exceptions**
- `EX-CG-005.1` Direct reorder attempt → `PERMISSION_DENIED`, audited as a control-breach attempt.

**Events** — `circle.payout_order.changed`
**Audit** — full governance record retained.

**Story `US-CG-005`** — As a Circle member, I want the payout order changeable only by group decision, so that an administrator cannot move themselves up the queue.
*Given* an administrator attempting a direct reorder, *when* they try, *then* it is refused and only a group proposal can change the order.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CG-005-1 | SEC | No direct reorder endpoint exists |
| TC-CG-005-2 | POS | Reorder via approved proposal works |
| TC-CG-005-3 | NEG | Administrator cannot reorder unilaterally |
| TC-CG-005-4 | POS | All members notified of an approved change |
| TC-CG-005-5 | NEG | Completed payouts unaffected |

---

### BFR-CG-006 — Contribution deadline notifications `P2`

**Acceptance (URS):** Reminder issued according to configured schedule.

**Screens** — Notification settings for Circle reminders; in-app upcoming contribution card.

**Workflow**
1. The reminder schedule is configured per Circle (e.g. 3 days before, on the day, on overdue).
2. The scheduler issues reminders through `notification-svc`.
3. Reminders stop when the contribution is confirmed.

**API** — internal scheduling; `GET /api/v1/circles/{id}/upcoming` → 200.

**Data** — `contribution_schedule`, notification records.

**Rules**
- `BR-CG-006.1` Reminders are service messages, not marketing; a marketing opt-out does not stop them (`NOT-006`).
- `BR-CG-006.2` Reminders stop immediately once the contribution is confirmed.
- `BR-CG-006.3` Reminder frequency is capped so the platform is not a nagging channel.
- `BR-CG-006.4` Reminders never disclose another member's status to a third party.

**Exceptions**
- `EX-CG-006.1` Notification delivery failure → recorded (`NOT-010`); the contribution status is unaffected.

**Events** — `circle.contribution.due`
**Audit** — reminder dispatch recorded.

**Story `US-CG-006`** — As a Circle member, I want reminders before my contribution is due, so that I do not fall behind by forgetting.
*Given* a due date, *when* the configured reminder window is reached, *then* I am reminded, and reminders stop once I have paid.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CG-006-1 | POS | Reminder issued per schedule |
| TC-CG-006-2 | POS | Reminders stop after confirmation |
| TC-CG-006-3 | NEG | Marketing opt-out does not suppress them |
| TC-CG-006-4 | SEC | No third-party disclosure of another member's status |

---

### BFR-CG-007 — Late contribution status visible `P2`

**Acceptance (URS):** Member and authorised group users see overdue state.

**Screens** — Contributions grid with late/overdue chips (icon + text); My status card.

**Workflow**
1. A contribution unpaid past its grace period becomes `LATE`, then `MISSED` per the rule version.
2. The status is visible to the member and to the group, per the Circle's transparency model.

**API** — `GET /api/v1/circles/{id}/contributions?status=LATE` → 200.

**Data** — `circle_contribution.status`

**Rules**
- `BR-CG-007.1` Late status derives from the schedule and confirmed payments; it is never set manually.
- `BR-CG-007.2` Status uses icon and text, not colour alone (URS §20).
- `BR-CG-007.3` The affected member always sees their own status at least as prominently as others see it.
- `BR-CG-007.4` Late status carries no automatic penalty unless the rule version defines one, and any penalty is shown with its basis.

**Exceptions**
- `EX-CG-007.1` Late payment subsequently confirmed → status updates to paid-late, retaining the lateness record.

**Events** — `circle.contribution.late`
**Audit** — status transitions recorded.

**Story `US-CG-007`** — As a Circle member, I want overdue contributions visible, so that the group can address problems early rather than at payout time.
*Given* an unpaid contribution past its grace period, *when* the group views the grid, *then* it shows as overdue.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CG-007-1 | POS | Overdue status derived and displayed |
| TC-CG-007-2 | NEG | Status cannot be set manually |
| TC-CG-007-3 | POS | Icon and text used, not colour alone |
| TC-CG-007-4 | POS | Late payment records paid-late |

---

### BFR-CG-008 — Circle behaviour may feed Financial Passport with consent `P1`

**Acceptance (URS):** Contribution summary included only after appropriate consent.

**Screens** — Circle ▸ "Use my Circle record in my Passport" with a clear explanation of what would be included and shared.

**Workflow**
1. The member grants a specific consent for Circle data to contribute to their Passport.
2. Only a **summary** (contribution consistency, participation duration) is used — not other members' data.
3. The Passport source list shows the Circle as a source with its quality label.

**API** — `POST /api/v1/consents` with `consent_type = CIRCLE_TO_PASSPORT`; Passport metrics then include Circle-derived contributions.

**Data** — `passport_metric_source` with `data_source = CIRCLE` and a consent reference.

**Rules**
- `BR-CG-008.1` Circle data contributes **only** with this specific consent — a general data consent is not sufficient.
- `BR-CG-008.2` Only the member's own summary is used; no other member's data ever enters an individual's Passport.
- `BR-CG-008.3` Revoking this consent removes Circle contributions from future calculations and marks existing metrics for recalculation.
- `BR-CG-008.4` The Passport explanation names the Circle as a source (`FP-008`).

**Exceptions**
- `EX-CG-008.1` Consent absent → Circle data excluded silently from calculation but the Passport states that Circle activity is not included, so the omission is visible.

**Events** — `consent.granted`, `passport.updated`
**Audit** — consent and inclusion recorded.

**Story `US-CG-008`** — As a Circle member, I want my group saving record to count towards my Passport if I choose, so that discipline no bank has seen still helps me.
*Given* the specific consent, *when* my Passport calculates, *then* my Circle contribution summary contributes and is named as a source.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CG-008-1 | POS | With consent, Circle summary contributes |
| TC-CG-008-2 | NEG | Without the specific consent, it does not |
| TC-CG-008-3 | SEC | No other member's data enters an individual Passport |
| TC-CG-008-4 | POS | Revocation removes future contribution |
| TC-CG-008-5 | POS | Circle named as a source in the explanation |

---

### BFR-CG-009 — Circle disputes create a case record `P2`

**Acceptance (URS):** Complaint/dispute is linked to Circle and relevant transaction.

**Screens** — Circle ▸ Raise an issue; Dispute detail with linked Circle, period and transaction.

**Workflow**
1. A member raises a dispute about a contribution, payout or decision.
2. A complaint case is created (`CMP-001`) linked to the Circle and the relevant records.
3. Support investigates; the outcome is recorded and visible to the parties.

**API** — `POST /api/v1/complaints` with `circle_id` and optional `transaction_ref` → 201.

**Data** — `complaint` with Circle and transaction references.

**Rules**
- `BR-CG-009.1` A dispute never blocks the Circle's other activity unless the rule version or an investigation requires it.
- `BR-CG-009.2` The dispute is linked to the specific Circle records in question, so investigation does not start from a blank page.
- `BR-CG-009.3` Disputes follow the standard complaint SLA and outcome rules (`CMP-005`, `CMP-008`).
- `BR-CG-009.4` The platform mediates on the record, not on the group's internal social arrangements — a dispute outcome addresses what the platform recorded and did.

**Exceptions**
- `EX-CG-009.1` Dispute alleging fraud → escalated to the fraud process as well as the complaint process (`FRD-007`).

**Events** — `complaint.created`
**Audit** — dispute lifecycle audited.

**Story `US-CG-009`** — As a Circle member, I want to raise a dispute linked to the exact transaction, so that it can be investigated on evidence rather than on recollection.
*Given* a disputed contribution, *when* I raise an issue, *then* a case is created linked to that Circle and record.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CG-009-1 | POS | Dispute created with Circle and transaction links |
| TC-CG-009-2 | POS | SLA applies as for any complaint |
| TC-CG-009-3 | POS | Fraud allegation escalates additionally |
| TC-CG-009-4 | PRM | Only members of that Circle can raise its disputes |

---

### BFR-CG-010 — Circle closure requires appropriate settlement `P1`

**Acceptance (URS):** Closure cannot complete while unresolved balance rules remain.

**Screens** — Close Circle ▸ pre-closure checklist (outstanding contributions, pool balance, pending payouts, open disputes); Closure proposal; Final statement.

**Workflow**
1. Closure is raised as a proposal requiring the rule version's threshold.
2. A pre-closure check enumerates every unresolved item.
3. Closure completes only when the balance is fully allocated and no blocking item remains.
4. A final statement is produced for every member; history is retained.

**API** — `POST .../proposals` with `type = CLOSURE`; `GET /api/v1/circles/{id}/closure-readiness` → 200.

**Data** — `circle.status = SETTLEMENT_PENDING → CLOSED`, final statement records.

**Rules**
- `BR-CG-010.1` A Circle cannot close with a non-zero pool balance — remaining funds must be allocated to members per the rules.
- `BR-CG-010.2` Open disputes block closure unless the rule version and the dispute process permit otherwise.
- `BR-CG-010.3` Closure requires approval; no single member can close a Circle holding others' money.
- `BR-CG-010.4` Closure retains all history and produces a final statement per member (`CIR-008`, `PRT-010` principle).

**Exceptions**
- `EX-CG-010.1` Closure with an outstanding balance → refused, with the unresolved items listed.
- `EX-CG-010.2` Closure with an open dispute → blocked with the dispute referenced.

**Events** — `circle.closed`
**Audit** — closure proposal, approvals, settlement postings and final statements.

**Story `US-CG-010`** — As a Circle member, I want closure to be impossible until everyone's money is settled, so that a Circle cannot be wound up leaving members short.
*Given* an outstanding pool balance, *when* closure is attempted, *then* it is refused and the unresolved items are listed.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CG-010-1 | NEG | Closure refused with a non-zero pool balance |
| TC-CG-010-2 | NEG | Open dispute blocks closure |
| TC-CG-010-3 | PRM | Closure requires approval, not a single member |
| TC-CG-010-4 | POS | Final statements produced for every member |
| TC-CG-010-5 | POS | History retained after closure |
