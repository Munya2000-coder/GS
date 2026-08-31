# BFR-FDS-19 — Domain 19: Cross-Border Payments / BuntuSwitch (`XB`)

**Context:** Cross-Border (`switch-svc`) · **Epic:** `EPIC-XB` — Send money with a known landed amount and a known outcome
**Wave:** W5 · **Depends on:** `PAY`, `LED`, `FX`, `AML`, `PRT`
**Blocking:** `Q-10` (corridor rules — corridors ship disabled), `Q-13` (FX margin disclosure), `Q-14` (post-funding expiry) · **Contract-pending:** `Q-24`
**State machine:** `BFR-STD-001` §3

---

### BFR-XB-001 — Configurable cross-border corridors `P1`

**Acceptance (URS):** Corridor can be enabled/disabled without code changes.

**Screens** — Send abroad ▸ destination list (enabled corridors only); Admin ▸ Corridors matrix.

**Workflow**
1. Corridors are configuration: origin, destination, permitted currencies, quote directions, limits, screening requirement, permitted providers.
2. Enabled corridors appear to eligible customers; disabled ones do not exist for them.
3. Enabling or disabling is a regulated configuration change (`GOV-008`).

**API** — `GET /api/v1/corridors` → 200 enabled corridors; `POST /api/admin/v1/corridors` → 201 (approval required).

**Data** — corridor definitions in `config_version`

**Rules**
- `BR-XB-001.1` A corridor is entirely configuration — no corridor-specific code exists.
- `BR-XB-001.2` **All corridors ship disabled** pending `Q-10`; a corridor cannot be enabled while its regulatory rules are unconfirmed.
- `BR-XB-001.3` Corridor configuration declares whether compliance screening is required before release (`XB-008`).
- `BR-XB-001.4` Disabling a corridor stops new transfers immediately; in-flight transfers follow their recovery path (`GOV-009`, `XB-010`).

**Exceptions**
- `EX-XB-001.1` Transfer on a disabled corridor → `FEATURE_DISABLED`.
- `EX-XB-001.2` Corridor enabled with `PLACEHOLDER` regulatory values → blocked by the release gate.

**Events** — `corridor.enabled`, `corridor.disabled`
**Audit** — corridor changes audited with approver.

**Story `US-XB-001`** — As a compliance officer, I want corridors turned on and off by configuration, so that we can respond to a regulatory change without a release.
*Given* a corridor whose rules are unconfirmed, *when* someone attempts to enable it, *then* the release gate prevents it reaching production.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-XB-001-1 | POS | Corridor enabled by configuration, no deployment |
| TC-XB-001-2 | NEG | Transfer on a disabled corridor refused |
| TC-XB-001-3 | NEG | Placeholder regulatory values block the release gate |
| TC-XB-001-4 | INT | Disabling stops new transfers; in-flight follow recovery |
| TC-XB-001-5 | AUD | Corridor changes approved and audited |

---

### BFR-XB-002 — Sender specifies send or receive amount `P1`

**Acceptance (URS):** Quote calculation supports configured quote direction.

**Screens** — Amount entry with a toggle: "They receive exactly" / "I send exactly", limited to what the corridor permits.

**Workflow**
1. The corridor declares permitted quote directions.
2. The sender chooses a direction and enters an amount.
3. The quote engine computes the other side, including fees and rate (`FX-001`).

**API** — `POST /api/v1/transfers/quotes` `{corridor, quote_direction, amount_minor, currency}` → 201.

**Data** — `fx_quote.quote_direction`, `send_amount_minor`, `receive_amount_minor`

**Rules**
- `BR-XB-002.1` Only corridor-permitted directions are offered and accepted.
- `BR-XB-002.2` In `RECEIVE_FIXED`, the recipient amount is exact and the send amount absorbs rounding; in `SEND_FIXED`, the reverse. Which side absorbs rounding is stated (`FX-008`).
- `BR-XB-002.3` Both amounts are in minor units with explicit currencies (`LED-005`, `LED-006`).
- `BR-XB-002.4` Limits are checked against the send amount in the customer's currency (`GOV-006`).

**Exceptions**
- `EX-XB-002.1` Direction not permitted on the corridor → `VALIDATION_FAILED` stating what is available.
- `EX-XB-002.2` Amount outside corridor limits → `LIMIT_EXCEEDED`.

**Events** — `transfer.quote.created`
**Audit** — quote parameters retained.

**Story `US-XB-002`** — As a sender, I want to fix either what I send or what they receive, so that I can meet a specific need at the other end.
*Given* `RECEIVE_FIXED`, *when* I ask for exactly 50,000 to be received, *then* the quote tells me precisely what I must send.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-XB-002-1 | POS | Both directions quote correctly where permitted |
| TC-XB-002-2 | NEG | Unpermitted direction refused |
| TC-XB-002-3 | DEC | Rounding side is explicit and deterministic |
| TC-XB-002-4 | NEG | Amount outside corridor limits refused |

---

### BFR-XB-003 — Recipient currency explicit `P1`

**Acceptance (URS):** Final quote identifies send/receive currencies.

**Screens** — Quote shows both currencies prominently, never a bare number.

**Workflow**
1. The corridor determines available receive currencies.
2. The quote states both currencies explicitly, in the customer's language and formatting.

**API** — quote responses always include `send_currency` and `receive_currency`.

**Data** — `fx_quote.send_currency`, `receive_currency`

**Rules**
- `BR-XB-003.1` No monetary value is ever displayed or transmitted without its currency.
- `BR-XB-003.2` Currency formatting follows the customer's locale while the stored value remains canonical (URS §18).
- `BR-XB-003.3` Where a corridor supports several receive currencies, the sender chooses explicitly; there is no default.
- `BR-XB-003.4` The recipient's currency appears on the confirmation and the receipt.

**Exceptions**
- `EX-XB-003.1` Unsupported receive currency for the corridor → `VALIDATION_FAILED` listing supported currencies.

**Events** — none
**Audit** — currencies retained on the quote and transfer.

**Story `US-XB-003`** — As a sender, I want to see exactly which currency my recipient will receive, so that there is no ambiguity about what arrives.
*Given* a corridor with two possible receive currencies, *when* I quote, *then* I choose explicitly and both currencies are shown.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-XB-003-1 | POS | Both currencies shown on the quote |
| TC-XB-003-2 | NEG | No amount displayed without its currency |
| TC-XB-003-3 | NEG | Unsupported receive currency refused |
| TC-XB-003-4 | POS | Locale formatting applied without altering stored values |

---

### BFR-XB-004 — FX rate displayed before confirmation `P1`

**Acceptance (URS):** Customer sees rate applicable to quote.

**Screens** — Quote shows the rate as "1 RWF = X" with its validity countdown.

**Workflow**
1. The quote engine obtains a provider rate (`FX-001`) and composes the customer rate per policy.
2. The rate is displayed with the quote and persisted on it.

**API** — quote responses include `rate`, `rate_scale`, `expires_at`.

**Data** — `fx_quote.rate`, `rate_scale`, `margin_bps`

**Rules**
- `BR-XB-004.1` The displayed rate is the rate that will be applied, for as long as the quote is valid.
- `BR-XB-004.2` Whether the margin is disclosed separately from the rate is determined by `Q-13`; the data model records `margin_bps` either way, so disclosure is a presentation decision, not a data-availability problem.
- `BR-XB-004.3` The rate is persisted on the quote, so a past transfer's rate is provable.
- `BR-XB-004.4` The rate is shown before the customer commits, not on the receipt only.

**Exceptions**
- `EX-XB-004.1` Rate unavailable → no quote is issued; the customer is told the corridor is temporarily unavailable rather than being shown a stale rate.

**Events** — `transfer.quote.created`
**Audit** — rate composition inputs retained with the quote.

**Story `US-XB-004`** — As a sender, I want to see the exchange rate before I commit, so that I can judge whether the transfer is worth making.
*Given* a quote, *when* I review it, *then* the applicable rate and its validity period are shown.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-XB-004-1 | POS | Rate displayed with the quote and applied on execution |
| TC-XB-004-2 | POS | Rate persisted and provable afterwards |
| TC-XB-004-3 | NEG | No stale rate shown when the provider is unavailable |
| TC-XB-004-4 | DEC | Rate scale explicit; arithmetic reproducible |

---

### BFR-XB-005 — All customer-facing fees displayed `P1`

**Acceptance (URS):** Transfer fee and applicable partner charges are visible.

**Screens** — Quote ▸ fee breakdown listing each charge and who levies it, including any known recipient-side deduction.

**Workflow**
1. The fee engine assembles all customer-facing charges: BuntuFin's fee, the partner's fee, and any known payout-side deduction.
2. The total cost and the resulting recipient amount are shown.

**API** — quote responses include `fees {total_minor, components[{type, amount_minor, charged_by, deducted_from}]}`.

**Data** — `fx_quote.fee_breakdown`

**Rules**
- `BR-XB-005.1` Every charge the customer or recipient bears, and that BuntuFin knows about, is displayed with who levies it.
- `BR-XB-005.2` Where a payout-side deduction exists but its amount is unknown to BuntuFin, that is stated explicitly rather than omitted — the customer must know a deduction may occur.
- `BR-XB-005.3` The quote's fees are final for its validity period.
- `BR-XB-005.4` Fee values remain `PLACEHOLDER` until `Q-12` is answered.

**Exceptions**
- `EX-XB-005.1` Partner fee unavailable at quote time → no quote issued; a transfer is never quoted on unknown costs.

**Events** — none
**Audit** — fee breakdown retained on the quote.

**Story `US-XB-005`** — As a sender, I want to see every charge before I send, so that I know the true cost and what will actually arrive.
*Given* a transfer with a partner payout fee, *when* I review the quote, *then* each charge is itemised with who levies it.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-XB-005-1 | POS | All known fees itemised with the charging party |
| TC-XB-005-2 | POS | Unknown payout deduction disclosed as possible |
| TC-XB-005-3 | NEG | No quote issued when partner fees are unknown |
| TC-XB-005-4 | DEC | Fee arithmetic exact in minor units |

---

### BFR-XB-006 — Recipient amount displayed `P1`

**Acceptance (URS):** Customer sees expected amount delivered before confirmation.

**Screens** — Quote leads with "They receive: X CURRENCY", with any caveat about payout-side deductions immediately adjacent.

**Workflow**
1. The quote computes the recipient amount after all known deductions.
2. It is displayed prominently before confirmation and repeated on the receipt.

**API** — quote responses include `receive_amount_minor`, `receive_currency`, `receive_amount_is_exact`.

**Data** — `fx_quote.receive_amount_minor`

**Rules**
- `BR-XB-006.1` The recipient amount is the headline figure of the quote.
- `BR-XB-006.2` `receive_amount_is_exact` is `false` where an unknown payout-side deduction may apply, and the UI states this — an approximate figure is never presented as exact.
- `BR-XB-006.3` In `RECEIVE_FIXED` mode the amount is exact by construction.
- `BR-XB-006.4` The delivered amount is compared to the quoted amount on delivery, and any difference is surfaced (`XB-009`).

**Exceptions**
- `EX-XB-006.1` Delivered amount differs from quoted → recorded, surfaced to the customer with an explanation, and raised as a reconciliation exception (`REC-003`).

**Events** — `transfer.delivered` carries the actual delivered amount.
**Audit** — quoted vs delivered comparison retained.

**Story `US-XB-006`** — As a sender, I want to know exactly what my recipient will get, so that I can send what they actually need.
*Given* a quote, *when* I review it, *then* the recipient amount is the most prominent figure, with any uncertainty stated.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-XB-006-1 | POS | Recipient amount displayed before confirmation |
| TC-XB-006-2 | POS | Approximate amounts flagged as not exact |
| TC-XB-006-3 | POS | RECEIVE_FIXED delivers exactly the quoted amount |
| TC-XB-006-4 | REC | Delivered/quoted difference raises an exception |

---

### BFR-XB-007 — Quote expires `P1`

**Acceptance (URS):** Expired quote cannot execute at stale rate.

**Screens** — Quote countdown; "This quote has expired — get a new one" with a single action.

**Workflow**
1. Every quote carries `expires_at` from the corridor and provider configuration.
2. Expiry is re-checked at acceptance and again at execution.
3. An expired quote cannot execute; a new quote is required.

**API** — acceptance and execution return `QUOTE_EXPIRED` after expiry.

**Data** — `fx_quote.expires_at`, `.status`

**Rules**
- `BR-XB-007.1` Expiry is checked at **both** acceptance and execution — a quote accepted just before expiry cannot execute long after it.
- `BR-XB-007.2` The platform never executes at a stale rate, whatever the customer's expectation.
- `BR-XB-007.3` Where a quote expires after funding, the recovery path is determined by `Q-14`; until answered, the design holds the transfer and escalates rather than guessing whose risk it is.
- `BR-XB-007.4` Re-quoting is a single, clear action that shows the new rate against the old.

**Exceptions**
- `EX-XB-007.1` Execution after expiry → refused; funds not released; the customer is offered a re-quote or a refund.
- `EX-XB-007.2` Expiry between funding and submission → transfer held, operations alerted, customer informed (pending `Q-14`).

**Events** — `transfer.quote.expired`
**Audit** — expiry refusals recorded.

**Story `US-XB-007`** — As a compliance officer, I want expired quotes to be unusable, so that no transfer executes at a rate that is no longer real.
*Given* an expired quote, *when* execution is attempted, *then* it is refused and no funds move.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-XB-007-1 | NEG | Execution after expiry refused |
| TC-XB-007-2 | NEG | Acceptance after expiry refused |
| TC-XB-007-3 | CON | Execution racing expiry resolves deterministically |
| TC-XB-007-4 | ERR | Expiry after funding holds and escalates, never silently repriced |
| TC-XB-007-5 | POS | Re-quote shows the new rate against the old |

---

### BFR-XB-008 — Corridor-specific compliance screening `P1`

**Acceptance (URS):** Screening occurs before final release where configured.

**Screens** — Transfer status "Being checked" with an honest expectation; Admin ▸ held transfers queue.

**Workflow**
1. On `FUNDED`, if the corridor requires screening, the transfer moves to `COMPLIANCE_SCREENING`.
2. Sender and recipient are screened (`AML-001`, `AML-002`); the result is recorded with list source and version.
3. Clear results proceed to `PROCESSING`; potential matches move to `ON_HOLD` for analyst review.

**API** — internal; `GET /api/admin/v1/transfers?state=ON_HOLD` → 200; `POST /api/admin/v1/transfers/{id}/clear` → 200 (analyst, with reason).

**Data** — `screening_result` linked to the transfer; `transfer_status_history`

**Rules**
- `BR-XB-008.1` **There is no state transition from `FUNDED` to `SENT_TO_PARTNER`** — the machine makes bypassing screening structurally impossible where the corridor requires it.
- `BR-XB-008.2` A screening result records its list source and version (`AML-001`).
- `BR-XB-008.3` Only an authorised analyst can clear a hold, with a reason; no automatic clearing on timeout.
- `BR-XB-008.4` The customer is told the transfer is being checked, without being told the substance of a screening match.
- `BR-XB-008.5` Where the partner also screens, both results are recorded; BuntuFin's obligation is not discharged by the partner's screening alone unless the contract says so (`Q-24`).

**Exceptions**
- `EX-XB-008.1` Screening provider unavailable → transfer held, not released; operations alerted. Release is never the failure mode.
- `EX-XB-008.2` Match confirmed → transfer not released; case created (`AML-006`); refund path per compliance decision.

**Events** — `transfer.screened`
**Audit** — screening result, analyst decision and reason.

**Story `US-XB-008`** — As a compliance officer, I want screening completed before funds leave, so that a sanctioned party cannot be paid because a check was skipped or timed out.
*Given* a corridor requiring screening, *when* screening has not completed, *then* the transfer cannot reach the partner by any path.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-XB-008-1 | POS | Screening completes before release |
| TC-XB-008-2 | SEC | No state path bypasses screening |
| TC-XB-008-3 | NEG | Screening provider outage holds, never releases |
| TC-XB-008-4 | PRM | Only an authorised analyst can clear a hold |
| TC-XB-008-5 | AUD | Result records list source and version |
| TC-XB-008-6 | SEC | Customer messaging discloses no match detail |

---

### BFR-XB-009 — Cross-border status trackable `P1`

**Acceptance (URS):** Sender sees processing, delivered, failed, reversed/refunded states.

**Screens** — Transfer detail ▸ plain-language timeline with each stage and its time; delivered shows the actual amount.

**Workflow**
1. Every transition writes a history row.
2. The sender sees the current stage, what happened, and what is expected next.
3. Delivery shows the actual delivered amount against the quoted amount (`XB-006`).

**API** — `GET /api/v1/transfers/{id}` → 200 with `status` and `history[]`.

**Data** — `transfer.state`, `transfer_status_history`

**Rules**
- `BR-XB-009.1` Status derives only from the state machine (`BFR-STD-001` §3).
- `BR-XB-009.2` Partner-reported states map into the machine; unmapped partner states hold the transfer for investigation rather than being guessed.
- `BR-XB-009.3` The recipient's experience (collected, credited) is shown where the partner reports it.
- `BR-XB-009.4` Long-running states explain what is happening and give an expectation.

**Exceptions**
- `EX-XB-009.1` No partner update within the expected window → status shows a delay, operations alerted, sender informed.

**Events** — `transfer.sent`, `transfer.delivered`, `transfer.failed`, `transfer.refunded`
**Audit** — every transition with its source.

**Story `US-XB-009`** — As a sender, I want to follow my transfer to delivery, so that I know whether my family has received the money.
*Given* a transfer in progress, *when* I open it, *then* I see its stage, its history and what happens next.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-XB-009-1 | POS | Every state visible with a timeline |
| TC-XB-009-2 | POS | Delivered shows actual vs quoted amount |
| TC-XB-009-3 | ERR | Unmapped partner state holds for investigation |
| TC-XB-009-4 | POS | Delay surfaces with an expectation |
| TC-XB-009-5 | PRM | Only the sender sees the transfer |

---

### BFR-XB-010 — Failed delivery triggers recovery workflow `P1`

**Acceptance (URS):** Retry, investigation or refund path is created according to configuration.

**Screens** — Failed transfer showing the recovery path and its progress; Admin ▸ recovery queue.

**Workflow**
1. A failure creates a `recovery_action` whose type is determined by the failure classification and corridor configuration.
2. Retryable failures retry within policy; non-retryable ones move to investigation or refund.
3. A refund returns funds to the sender with a linked ledger reversal (`LED-003`).
4. The sender is kept informed throughout.

**API** — `GET /api/v1/transfers/{id}/recovery` → 200; `POST /api/admin/v1/transfers/{id}/refund` → 202 (authorised, with reason).

**Data** — `recovery_action(type, status, attempts, resolved_at, resolution)`

**Rules**
- `BR-XB-010.1` **Every** failed transfer gets a recovery action — none is left in a terminal failure with no path.
- `BR-XB-010.2` Retry only for classified-retryable failures, capped and idempotent, so a retry can never double-pay (`NFR-004`).
- `BR-XB-010.3` A refund is a linked reversal, never a new unrelated credit (`LED-003`, `LED-007`).
- `BR-XB-010.4` An `UNKNOWN` partner outcome goes to investigation, never to automatic refund — refunding money that was in fact delivered would create a loss.
- `BR-XB-010.5` The sender is notified of the failure and of each recovery milestone (`NOT-008`).

**Exceptions**
- `EX-XB-010.1` Refund fails → escalated as an incident; funds are never left unaccounted (`REC-*`).
- `EX-XB-010.2` Partner later reports delivery of a refunded transfer → reconciliation exception and recovery action (`REC-006`).

**Events** — `transfer.failed`, `transfer.refunded`
**Audit** — recovery actions, retries, refunds and their authorisation.

**Story `US-XB-010`** — As a sender whose transfer failed, I want a clear path to getting my money back or delivered, so that a failure does not simply leave my money in limbo.
*Given* a failed delivery, *when* I check my transfer, *then* I see the recovery path, its progress and what I can expect.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-XB-010-1 | POS | Every failure creates a recovery action |
| TC-XB-010-2 | IDM | Retry cannot double-pay |
| TC-XB-010-3 | REV | Refund is a linked reversal |
| TC-XB-010-4 | NEG | UNKNOWN outcome investigated, never auto-refunded |
| TC-XB-010-5 | REC | Late delivery of a refunded transfer raises an exception |
| TC-XB-010-6 | INT | Sender notified of failure and recovery progress |
