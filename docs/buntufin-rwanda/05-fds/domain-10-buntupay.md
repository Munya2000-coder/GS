# BFR-FDS-10 — Domain 10: BuntuPay / Customer Payments (`PAY`)

**Context:** Payments (`payment-svc`) · **Epic:** `EPIC-PAY` — Payments that are correct, honest about their state, and impossible to duplicate
**Wave:** W3 · **Depends on:** `LED`, `ID`, `GOV`, `PRT` · **Contract-pending:** `Q-23` · **Blocked value:** `Q-12` (fee model)
**State machine:** `BFR-STD-001` §2

---

### BFR-PAY-001 — Customer views available transaction position `P1`

**Acceptance (URS):** Displayed value derives from ledger/authoritative partner state.

**Screens** — Home ▸ position card showing available amount, currency, "as at" time and its source; USSD balance journey.

**Workflow**
1. The client requests the position.
2. For `LEDGER_BACKED` products the position is the ledger projection minus active holds.
3. For `PARTNER_MIRRORED` products the position is the last partner-reported balance with its timestamp; a stale value is labelled.

**API** — `GET /api/v1/position` → 200 `{available_minor, currency, as_at, source, holds_minor}`.

**Data** — ledger balance projection, `hold`, `connected_account` balances.

**Rules**
- `BR-PAY-001.1` The displayed position is never computed in the client and never cached beyond its stated freshness.
- `BR-PAY-001.2` Active holds are deducted from available and are itemisable (`LED-008`).
- `BR-PAY-001.3` A mirrored partner balance always shows its `as_at` time; it is never presented as live.
- `BR-PAY-001.4` If the authoritative source is unavailable, the last known value is shown **labelled as such**, and money-moving actions re-check before authorising.

**Exceptions**
- `EX-PAY-001.1` Ledger projection unavailable → position unavailable with a clear message; no estimate is invented.
- `EX-PAY-001.2` Partner balance stale beyond the configured window → labelled stale, and authorisation requires a fresh check.

**Events** — none
**Audit** — position views are logged at a summary level (they are a sensitive read).

**Story `US-PAY-001`** — As a customer, I want to see how much I can actually use right now, so that I do not attempt a payment that will fail.
*Given* an active hold, *when* I view my position, *then* the held amount is excluded from what is available and is itemised.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PAY-001-1 | POS | Position matches ledger projection minus holds |
| TC-PAY-001-2 | POS | Mirrored balance shows its as-at time |
| TC-PAY-001-3 | NEG | No estimate shown when the source is unavailable |
| TC-PAY-001-4 | DEC | Arithmetic exact in minor units |
| TC-PAY-001-5 | PRM | A customer sees only their own position |

---

### BFR-PAY-002 — Send money to permitted recipients `P1`

**Acceptance (URS):** Valid payment completes through configured payment rail.

**Screens** — Send ▸ recipient (saved, new, QR); Amount; Review (fee, total, recipient); Authorise (PIN/step-up); Result.

**Workflow**
1. Recipient is resolved and validated through the rail adapter.
2. Eligibility is checked: KYC tier (`ID-007`), status (`USR-007`), limits (`GOV-006`), flags (`GOV-004/005`), fraud risk (`FRD-005`).
3. Fee is quoted and displayed (`PAY-006`); the customer confirms (`PAY-005`).
4. Payment is created with an idempotency key, a ledger hold is placed, and the rail is instructed.
5. The state machine advances on authoritative rail confirmation only.

**API**
- `POST /api/v1/payments/resolve-recipient` → 200 masked recipient name
- `POST /api/v1/payments` (with `Idempotency-Key`) → 201
- `GET /api/v1/payments/{id}` → 200

**Data** — `payment`, `payment_status_history`, `hold`, `journal`

**Rules**
- `BR-PAY-002.1` No payment is created before every eligibility check has passed.
- `BR-PAY-002.2` A ledger hold is placed before the rail is instructed, so the funds cannot be spent twice (`LED-008`).
- `BR-PAY-002.3` An `UNKNOWN` rail outcome never becomes `FAILED`; it remains in-flight and is reconciled (`BFR-STD-003`, `REC-004`).
- `BR-PAY-002.4` Recipient names are masked in display and never fully disclosed by a resolution lookup (an enumeration protection).
- `BR-PAY-002.5` Rail selection is configuration, not code.

**Exceptions**
- `EX-PAY-002.1` Recipient unresolvable → `VALIDATION_FAILED`, nothing created.
- `EX-PAY-002.2` Limit breach → `LIMIT_EXCEEDED`, nothing created.
- `EX-PAY-002.3` Rail rejects → `PROVIDER_REJECTED`, hold released, payment `FAILED`.
- `EX-PAY-002.4` Rail timeout → payment stays `PROCESSING`, hold retained, reconciliation seeded.

**Events** — `payment.created`, `payment.authorised`, `payment.completed`, `payment.failed`
**Audit** — creation, authorisation, state transitions with rail references.

**Story `US-PAY-002`** — As a customer, I want to send money to someone, so that I can pay for goods and support my family.
*Given* sufficient funds and a valid recipient, *when* I authorise the payment, *then* it completes through the configured rail and my ledger reflects it exactly once.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PAY-002-1 | POS | Valid payment completes and posts to the ledger |
| TC-PAY-002-2 | NEG | Insufficient position refused before any hold |
| TC-PAY-002-3 | NEG | Limit breach refused |
| TC-PAY-002-4 | PRM | Insufficient KYC tier refused |
| TC-PAY-002-5 | ERR | Rail timeout leaves the payment in-flight, not failed |
| TC-PAY-002-6 | CON | Concurrent payments cannot exceed the position |
| TC-PAY-002-7 | REV | Rail rejection releases the hold cleanly |

---

### BFR-PAY-003 — Request money `P2`

**Acceptance (URS):** Payment request can be sent and tracked.

**Screens** — Request ▸ from whom, amount, note; Requests list (sent/received) with status; Pay/Decline on a received request.

**Workflow**
1. Requester creates a request naming a payer and amount.
2. The payer is notified and sees the request with the requester's verified display name.
3. The payer pays (which creates a normal payment referencing the request) or declines.
4. The request status tracks: `PENDING`, `PAID`, `DECLINED`, `EXPIRED`, `CANCELLED`.

**API** — `POST /api/v1/payment-requests` → 201; `POST /api/v1/payment-requests/{id}/decline` → 200; `GET /api/v1/payment-requests` → 200.

**Data** — `payment_request(requester_id, payer_id, amount_minor, currency, note, status, expires_at)`

**Rules**
- `BR-PAY-003.1` A request never moves money by itself — it is an invitation that the payer must authorise.
- `BR-PAY-003.2` Requests expire after a configured window.
- `BR-PAY-003.3` Request notes are treated as untrusted user content: sanitised, length-limited, and never rendered as markup.
- `BR-PAY-003.4` Request volume is rate-limited to prevent request spam as a harassment or phishing vector.

**Exceptions**
- `EX-PAY-003.1` Paying an expired request → `VALIDATION_FAILED`, the requester may reissue.
- `EX-PAY-003.2` Request rate limit → `RATE_LIMITED`.

**Events** — `payment.request.created`, `payment.request.paid`
**Audit** — request lifecycle recorded.

**Story `US-PAY-003`** — As a customer, I want to request money from someone, so that they can pay me without me dictating my account details each time.
*Given* a request I sent, *when* the payer authorises it, *then* it shows as paid and links to the payment.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PAY-003-1 | POS | Request sent, tracked and paid |
| TC-PAY-003-2 | NEG | A request alone never debits the payer |
| TC-PAY-003-3 | NEG | Expired request cannot be paid |
| TC-PAY-003-4 | SEC | Note content sanitised, never rendered as markup |
| TC-PAY-003-5 | SEC | Request spam rate-limited |

---

### BFR-PAY-004 — Pay by QR `P1`

**Acceptance (URS):** Valid QR resolves recipient before authorisation.

**Screens** — Scan QR; Resolved recipient and amount; Review; Authorise.

**Workflow**
1. The customer scans a QR; the payload is parsed and validated.
2. The platform resolves it server-side to a merchant or customer and, for dynamic QR, to an amount and reference (`BIZ-005`).
3. The resolved recipient is displayed for confirmation **before** authorisation.
4. Payment proceeds as a normal payment.

**API** — `POST /api/v1/qr/resolve` `{payload}` → 200 `{recipient_display, merchant_id, amount_minor?, reference?}`.

**Data** — `qr_token`, `merchant_qr`

**Rules**
- `BR-PAY-004.1` QR payloads are resolved **server-side**; the client never trusts embedded display names or amounts.
- `BR-PAY-004.2` A QR that does not resolve to an active merchant or customer is refused — an unresolvable code never proceeds to authorisation.
- `BR-PAY-004.3` Dynamic QR tokens are single-use and expire.
- `BR-PAY-004.4` The confirmation screen always shows the **resolved** recipient, so a tampered QR cannot misrepresent the payee.
- `BR-PAY-004.5` QR tokens are unguessable and rate-limited against resolution scraping.

**Exceptions**
- `EX-PAY-004.1` Invalid or tampered payload → `VALIDATION_FAILED`, no recipient shown.
- `EX-PAY-004.2` Expired or already-used dynamic QR → `VALIDATION_FAILED` with a clear message.
- `EX-PAY-004.3` Merchant suspended → refused with a neutral message.

**Events** — `payment.created` referencing the QR token.
**Audit** — resolution attempts, including failures (a scraping signal).

**Story `US-PAY-004`** — As a customer, I want to pay by scanning a merchant's code, so that paying is fast and I do not mistype an account.
*Given* a valid merchant QR, *when* I scan it, *then* the resolved merchant is shown for confirmation before I authorise anything.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PAY-004-1 | POS | Valid QR resolves and displays the merchant |
| TC-PAY-004-2 | SEC | Tampered payload refused; client-side name never trusted |
| TC-PAY-004-3 | NEG | Expired or reused dynamic QR refused |
| TC-PAY-004-4 | NEG | Suspended merchant QR refused |
| TC-PAY-004-5 | SEC | Resolution endpoint rate-limited |

---

### BFR-PAY-005 — Confirmation shows amount and recipient `P1`

**Acceptance (URS):** Customer confirms final details before execution.

**Screens** — Review screen: recipient (resolved, masked identifier), amount, fee, total debit, currency, rail and the exact action button.

**Workflow**
1. Every payment path converges on one review screen.
2. Nothing is executed until an explicit confirm action.
3. Any change to amount or recipient returns the customer to review.

**API** — `POST /api/v1/payments/preview` → 200 the exact figures to be executed.

**Data** — preview values persisted with the payment, so what was shown is provable.

**Rules**
- `BR-PAY-005.1` The figures shown at review are persisted with the payment, so the platform can prove what the customer was shown.
- `BR-PAY-005.2` There is no "one-tap send" bypass of the review step for a new recipient.
- `BR-PAY-005.3` If the preview becomes invalid (fee change, limit change) before confirmation, execution is refused and re-preview is required.
- `BR-PAY-005.4` The review screen is legible at the lowest supported device profile and on a constrained connection (URS §20, `NFR-007`).

**Exceptions**
- `EX-PAY-005.1` Preview expired or figures changed → `VALIDATION_FAILED` requiring re-preview; nothing executes at the old figures.

**Events** — none
**Audit** — the confirmed preview snapshot is retained.

**Story `US-PAY-005`** — As a customer, I want to see exactly who I am paying and how much before it happens, so that I do not send money to the wrong person.
*Given* a payment ready to send, *when* I reach the review screen, *then* the resolved recipient, the amount, the fee and the total are all shown before I confirm.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PAY-005-1 | POS | Review shows recipient, amount, fee and total |
| TC-PAY-005-2 | NEG | Execution without confirmation impossible |
| TC-PAY-005-3 | NEG | Changed figures force a re-preview |
| TC-PAY-005-4 | AUD | Confirmed snapshot retained with the payment |

---

### BFR-PAY-006 — Fees displayed before confirmation `P1`

**Acceptance (URS):** Final customer fee is visible prior to authorisation.

**Screens** — Review ▸ fee line with a breakdown link showing each component and who charges it.

**Workflow**
1. The fee engine computes the customer-facing fee from the versioned fee configuration and the rail's quoted charge.
2. The total debit (amount + fee) is displayed.
3. The fee version used is persisted with the payment.

**API** — `POST /api/v1/payments/preview` → 200 including `fee {total_minor, components[{type, amount_minor, charged_by}]}`.

**Data** — `payment.fee_minor`, `payment.total_debit_minor`, `partner_fee_version`

**Rules**
- `BR-PAY-006.1` The fee shown is the **final** customer fee, with no undisclosed additions at execution.
- `BR-PAY-006.2` Fee components identify who charges them (BuntuFin or partner) (`GOV-002`).
- `BR-PAY-006.3` The fee version is persisted, so a past fee is reproducible (`PRT-008`).
- `BR-PAY-006.4` A zero fee is displayed as "no fee", not omitted, so its absence is affirmative.
- `BR-PAY-006.5` Fee values remain `PLACEHOLDER` until `Q-12` is answered; the release gate blocks production while they are.

**Exceptions**
- `EX-PAY-006.1` Fee cannot be computed → payment refused; a payment never proceeds on an unknown fee.
- `EX-PAY-006.2` Rail returns a different fee at execution → execution halts and a re-preview is required.

**Events** — none
**Audit** — fee version and components retained with the payment.

**Story `US-PAY-006`** — As a customer, I want to know the fee before I authorise, so that I am never surprised by a deduction.
*Given* a payment with a fee, *when* I review it, *then* I see the fee, who charges it, and the total that will leave my account.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PAY-006-1 | POS | Fee and total debit displayed before authorisation |
| TC-PAY-006-2 | NEG | Payment refused if the fee cannot be computed |
| TC-PAY-006-3 | NEG | Fee change at execution halts and forces re-preview |
| TC-PAY-006-4 | POS | Zero fee displayed explicitly |
| TC-PAY-006-5 | DEC | Fee arithmetic exact in minor units |
| TC-PAY-006-6 | POS | Historical fee reproducible from the persisted version |

---

### BFR-PAY-007 — Payment status trackable `P1`

**Acceptance (URS):** Customer sees pending, completed, failed or reversed state.

**Screens** — Payment detail ▸ status with a plain-language timeline; Activity list with status chips (icon + text).

**Workflow**
1. Every state transition writes a history row (`BFR-STD-001`).
2. The customer view renders the current state and its timeline in plain language.
3. Long-running states show what is happening and what happens next.

**API** — `GET /api/v1/payments/{id}` → 200 with `status` and `history[]`.

**Data** — `payment.state`, `payment_status_history`

**Rules**
- `BR-PAY-007.1` Customer-facing status is derived from the state machine only; there is no separate display status that could diverge.
- `BR-PAY-007.2` States are shown in plain language, in the customer's language, with icon and text (URS §20).
- `BR-PAY-007.3` A payment in a non-terminal state tells the customer what is expected next and by when.
- `BR-PAY-007.4` Status history is append-only.

**Exceptions**
- `EX-PAY-007.1` Unknown/indeterminate rail state → shown as "being confirmed", never as completed or failed.

**Events** — every transition publishes its event.
**Audit** — transitions recorded with actor (customer, system or partner).

**Story `US-PAY-007`** — As a customer, I want to see exactly where my payment is, so that I know whether to wait, retry or seek help.
*Given* a payment in progress, *when* I open it, *then* I see its current state and its history in language I understand.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PAY-007-1 | POS | Each state visible with its timeline |
| TC-PAY-007-2 | POS | Plain language, all supported languages |
| TC-PAY-007-3 | POS | Indeterminate state shown as being confirmed |
| TC-PAY-007-4 | SEC | Status history append-only |
| TC-PAY-007-5 | PRM | Only the owner sees the payment |

---

### BFR-PAY-008 — Failed payment never displays as completed `P1`

**Acceptance (URS):** UI reflects authoritative transaction state.

**Screens** — No optimistic success screen anywhere; a submitted payment shows "sending", never "sent".

**Workflow**
1. The client renders exactly the server's state.
2. The server sets `COMPLETED` only on authoritative rail confirmation.
3. Failures render as failures with the reason and next step.

**API** — the payment response is the single source of display state; no client-side inference.

**Data** — `payment.state`

**Rules**
- `BR-PAY-008.1` The client never infers success from an HTTP 200 or 201 — those mean "accepted", and the payload's state means what happened.
- `BR-PAY-008.2` `COMPLETED` is set only by authoritative confirmation from the rail (`Q-23`).
- `BR-PAY-008.3` An `UNKNOWN` outcome is never rendered as either success or failure.
- `BR-PAY-008.4` A notification is sent only after authoritative completion or failure (`NOT-007`, `NOT-008`).

**Exceptions**
- `EX-PAY-008.1` Rail reports failure after a provisional success was displayed → not possible by design, because provisional success is never displayed.

**Events** — `payment.completed` / `payment.failed` only on authoritative outcome.
**Audit** — the authoritative source of each transition is recorded.

**Story `US-PAY-008`** — As a customer, I want to be told a payment succeeded only when it really has, so that I never walk away from a shop believing I have paid when I have not.
*Given* a payment the rail later fails, *when* I look at it at any point, *then* it never showed as completed.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PAY-008-1 | NEG | Failed payment never displays as completed at any point |
| TC-PAY-008-2 | NEG | HTTP acceptance does not render as success |
| TC-PAY-008-3 | POS | Only authoritative confirmation sets COMPLETED |
| TC-PAY-008-4 | ERR | UNKNOWN outcome renders as in-progress |
| TC-PAY-008-5 | INT | Confirmation notification sent only after authoritative completion |

---

### BFR-PAY-009 — Idempotency protects duplicate payment requests `P1`

**Acceptance (URS):** Repeated same request does not create unintended duplicate debit.

**Screens** — Retry after a dropped connection resumes the same payment, never creates a second.

**Workflow**
1. The client generates an idempotency key per logical payment and reuses it on every retry.
2. The server records the key with the request hash before executing.
3. A repeat with the same key and body returns the original result; a repeat with a different body is refused.

**API** — `POST /api/v1/payments` with `Idempotency-Key`; replay returns the original response with `Idempotent-Replay: true`.

**Data** — `idempotency_key` UNIQUE `(principal_id, key)`, `payment.idempotency_key`

**Rules**
- `BR-PAY-009.1` The uniqueness guarantee is a **database constraint**, so it holds under concurrency.
- `BR-PAY-009.2` A request in flight under the same key returns `REQUEST_IN_PROGRESS`; it never executes twice.
- `BR-PAY-009.3` The same key with a different body is `IDEMPOTENCY_KEY_REUSED` and never executes.
- `BR-PAY-009.4` USSD money-moving actions carry a server-generated key bound to the session (URS §19).
- `BR-PAY-009.5` Where the rail lacks idempotency (`Q-23`), a pre-flight duplicate check on `(customer, beneficiary, amount, window)` is added and every `UNKNOWN` outcome is reconciled.

**Exceptions**
- `EX-PAY-009.1` Duplicate submission → original result returned, exactly one debit exists.
- `EX-PAY-009.2` Key expired and resubmitted → treated as a new payment; the window is configured long enough that this is safe.

**Events** — `payment.created` fires once per logical payment.
**Audit** — replays recorded, so duplicate-submission patterns are visible.

**Story `US-PAY-009`** — As a customer on an unreliable connection, I want retrying a payment not to send it twice, so that a dropped signal never costs me money.
*Given* a payment submitted twice with the same key, *when* both requests are processed, *then* exactly one debit exists.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PAY-009-1 | IDM | Same key twice ⇒ one debit, original response replayed |
| TC-PAY-009-2 | CON | N concurrent identical submissions ⇒ exactly one debit |
| TC-PAY-009-3 | NEG | Same key, different body refused |
| TC-PAY-009-4 | POS | In-flight duplicate returns REQUEST_IN_PROGRESS |
| TC-PAY-009-5 | INT | USSD resubmission does not duplicate |
| TC-PAY-009-6 | REC | UNKNOWN rail outcome seeds a reconciliation exception |

---

### BFR-PAY-010 — Receipts generated `P2`

**Acceptance (URS):** Completed transaction produces timestamped reference and amount.

**Screens** — Payment detail ▸ Receipt (share, save); Merchant receipt view.

**Workflow**
1. On authoritative completion, a receipt is generated with reference, amount, fee, recipient, timestamp and provider attribution.
2. The receipt is retrievable at any later time and can be shared.

**API** — `GET /api/v1/payments/{id}/receipt` → 200 (JSON and rendered form).

**Data** — `receipt(payment_id, reference, issued_at, amount_minor, fee_minor, recipient_display, provider_attribution)`

**Rules**
- `BR-PAY-010.1` Receipts are issued only for authoritatively completed payments (`PAY-008`).
- `BR-PAY-010.2` The receipt reference is unique, stable and quotable in a complaint (`CMP-003`).
- `BR-PAY-010.3` Receipts show the legal provider where relevant (`GOV-002`).
- `BR-PAY-010.4` A reversed payment's receipt is annotated with the reversal, never deleted (`LED-003`).
- `BR-PAY-010.5` Receipts are available in the customer's language and are lightweight to render (`NFR-007`).

**Exceptions**
- `EX-PAY-010.1` Receipt requested for a non-completed payment → `422` with the current state.

**Events** — `payment.completed`
**Audit** — receipt generation and shares recorded.

**Story `US-PAY-010`** — As a customer, I want a receipt for every completed payment, so that I have proof and a reference if something goes wrong.
*Given* a completed payment, *when* I open its receipt, *then* it shows a unique reference, the amount, the recipient and the time.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PAY-010-1 | POS | Receipt generated on completion with all required fields |
| TC-PAY-010-2 | NEG | No receipt for a non-completed payment |
| TC-PAY-010-3 | POS | Reversal annotates the receipt, does not delete it |
| TC-PAY-010-4 | POS | Reference quotable in a complaint |
| TC-PAY-010-5 | PRM | Only the payer and payee can retrieve it |
