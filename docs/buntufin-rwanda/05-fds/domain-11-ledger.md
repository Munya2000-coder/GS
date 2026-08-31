# BFR-FDS-11 — Domain 11: Double-Entry Ledger (`LED`)

**Context:** Ledger (`ledger-svc`) · **Epic:** `EPIC-LED` — A financial record that cannot be quietly altered
**Wave:** W1 Foundation · **Blocking questions:** `Q-01`, `Q-02` (legal meaning of the ledger), `Q-11` (currency scale)

> The ledger is the one component whose mistakes cannot be corrected cheaply
> later. Immutability, balance and precision are enforced at the **database**
> level, not by application convention.

---

### BFR-LED-001 — Double-entry postings `P1`

**Acceptance (URS):** Sum of journal debits equals credits.

**Screens** — Admin ▸ Ledger ▸ journal view (read-only, no edit affordance anywhere).

**Workflow**
1. A business operation calls the posting API with a set of lines.
2. The balance validator checks, per currency, that debits equal credits.
3. On success the journal and its lines are written atomically inside the caller's transaction.

**API** — internal `POST /internal/ledger/journals`; `GET /api/admin/v1/ledger/journals/{id}` → 200.

**Data** — `journal`, `journal_line`

**Rules**
- `BR-LED-001.1` Every journal has at least two lines and balances per currency.
- `BR-LED-001.2` Validation occurs inside the transaction, so an invalid posting cannot leave partial rows.
- `BR-LED-001.3` Cross-currency movement is never a single unbalanced journal; it is two balanced journals plus an FX account.
- `BR-LED-001.4` The posting API is internal only — no external caller can post directly.

**Exceptions**
- `EX-LED-001.1` Unbalanced journal → rejected, whole transaction rolled back (`LED-009`).
- `EX-LED-001.2` Single-line journal → rejected.

**Events** — `ledger.journal.posted`
**Audit** — every posting audited with its correlation id.

**Story `US-LED-001`** — As a finance controller, I want every financial movement recorded as balanced double-entry, so that the books are provably complete.
*Given* a payment, *when* it posts, *then* the journal's debits equal its credits and no partial rows exist.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-LED-001-1 | POS | Balanced journal posts successfully |
| TC-LED-001-2 | NEG | Unbalanced journal rejected atomically |
| TC-LED-001-3 | NEG | Single-line journal rejected |
| TC-LED-001-4 | CON | Concurrent postings all balance |
| TC-LED-001-5 | SEC | Posting API unreachable from outside |

---

### BFR-LED-002 — Posted entries immutable `P1`

**Acceptance (URS):** Ordinary application actions cannot delete or edit posted entry.

**Screens** — Journal view is strictly read-only; the admin UI offers reversal, never edit (`ADM-006`).

**Workflow**
1. Journals and lines are insert-only.
2. The application database role holds `INSERT` and `SELECT` on these tables and **no** `UPDATE` or `DELETE`.
3. Any correction is a new, linked journal (`LED-003`).

**API** — no update or delete endpoint exists for journals or lines.

**Data** — `journal`, `journal_line` with restricted grants

**Rules**
- `BR-LED-002.1` Immutability is enforced by database grants, not only by the absence of an endpoint.
- `BR-LED-002.2` No administrative screen, CLI command or support tool can edit a posted entry (`ADM-006`).
- `BR-LED-002.3` Migrations never rewrite historical journal data; schema changes are additive.
- `BR-LED-002.4` Backups and archives preserve the same immutability guarantees.

**Exceptions**
- `EX-LED-002.1` Attempted update or delete → `PERMISSION_DENIED` at the application layer and denied by the database if attempted directly.

**Events** — none
**Audit** — attempted modifications are logged as security events (URS §21).

**Story `US-LED-002`** — As an auditor, I want posted entries to be technically impossible to alter, so that the financial record can be relied upon.
*Given* a posted journal, *when* an update or delete is attempted by any route, *then* it is refused and the attempt is recorded.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-LED-002-1 | SEC | Direct SQL UPDATE denied to the application role |
| TC-LED-002-2 | SEC | Direct SQL DELETE denied to the application role |
| TC-LED-002-3 | NEG | No API or UI edit path exists (route inventory test) |
| TC-LED-002-4 | AUD | Modification attempt raises a security event |

---

### BFR-LED-003 — Corrections use reversals and adjustments `P1`

**Acceptance (URS):** Original and correcting entries remain linked.

**Screens** — Journal view showing "reversed by" and "reverses" links; Reversal form with mandatory reason.

**Workflow**
1. An authorised correction creates a reversal journal with opposite-signed lines.
2. `reverses_journal_id` links it to the original; both remain visible.
3. Partial corrections use adjustment journals with the same linkage.

**API** — internal `POST /internal/ledger/journals/{id}/reverse` `{reason}`; `GET .../journals/{id}` includes both links.

**Data** — `journal.reverses_journal_id`

**Rules**
- `BR-LED-003.1` A reversal is a new journal; the original is never touched.
- `BR-LED-003.2` A reason is mandatory on every reversal.
- `BR-LED-003.3` A journal can be reversed only once; a second attempt is refused (double reversal would silently double the correction).
- `BR-LED-003.4` A reversal is itself immutable and cannot be reversed away — a further correction is a new adjustment.
- `BR-LED-003.5` High-value or unusual reversals require dual approval (`ADM-009`).

**Exceptions**
- `EX-LED-003.1` Reversing an already-reversed journal → `STATE_TRANSITION_INVALID`.
- `EX-LED-003.2` Reversal without reason → `VALIDATION_FAILED`.

**Events** — `ledger.journal.reversed`, `payment.reversed`
**Audit** — reversal actor, approver, reason and both journal ids.

**Story `US-LED-003`** — As a finance controller, I want corrections made by linked reversal rather than editing, so that the original record and its correction are both permanently visible.
*Given* an incorrect posting, *when* I reverse it, *then* both entries exist and are linked to each other.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-LED-003-1 | REV | Reversal creates a linked, opposite-signed journal |
| TC-LED-003-2 | NEG | Original journal unchanged after reversal |
| TC-LED-003-3 | NEG | Double reversal refused |
| TC-LED-003-4 | NEG | Reversal without reason refused |
| TC-LED-003-5 | PRM | High-value reversal requires dual approval |

---

### BFR-LED-004 — Pending and posted states `P1`

**Acceptance (URS):** Holds do not appear as final settled postings until appropriate.

**Screens** — Position shows available and held separately; Activity distinguishes pending from settled.

**Workflow**
1. An in-flight operation places a hold, reducing available funds without a settled posting.
2. On authoritative completion the hold converts to a posted journal.
3. On failure the hold is released with no posting.

**API** — internal hold and posting endpoints; `GET /api/v1/position` shows both figures.

**Data** — `hold`, `journal.posting_state`

**Rules**
- `BR-LED-004.1` A hold is never counted as a settled posting in any balance, statement or report.
- `BR-LED-004.2` Available funds always exclude active holds.
- `BR-LED-004.3` A hold has an expiry; expiry releases it automatically and is audited.
- `BR-LED-004.4` The transition from hold to posting is atomic — there is no window where both apply.

**Exceptions**
- `EX-LED-004.1` Hold on insufficient available funds → refused, nothing created.
- `EX-LED-004.2` Hold expiry while the operation is still in flight → escalated for investigation rather than silently released, because the underlying money may still move.

**Events** — `ledger.hold.placed`, `ledger.hold.released`
**Audit** — hold lifecycle recorded.

**Story `US-LED-004`** — As a customer, I want money reserved for a payment in progress shown as held rather than spent, so that my position is accurate at every moment.
*Given* a payment in progress, *when* I check my position, *then* the amount is held, not posted, and I cannot spend it twice.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-LED-004-1 | POS | Hold reduces available without a settled posting |
| TC-LED-004-2 | POS | Completion converts hold to posting atomically |
| TC-LED-004-3 | POS | Failure releases the hold with no posting |
| TC-LED-004-4 | CON | Concurrent holds cannot exceed available funds |
| TC-LED-004-5 | ERR | Hold expiry during an in-flight operation escalates |

---

### BFR-LED-005 — No binary floating-point for money `P1`

**Acceptance (URS):** Fixed precision or integer minor units used.

**Screens** — n/a (a data and code constraint).

**Workflow**
1. All monetary values are integers in minor units with an explicit currency.
2. Scale comes from the `currency` reference table (`Q-11`).
3. Conversions and fee splits use documented, deterministic rounding recorded with the transaction.

**API** — `{"amount_minor": 250000, "currency": "RWF"}` everywhere; no decimal or float representation in any contract.

**Data** — `amount_minor BIGINT` on every monetary column; `currency.scale`

**Rules**
- `BR-LED-005.1` No `float`, `double` or binary floating-point type appears on any monetary path — enforced by a static analysis rule in CI (`BFR-STD-008`).
- `BR-LED-005.2` Currency scale is data, not a constant; RWF handling follows the seeded reference table (`Q-11`).
- `BR-LED-005.3` Division (fee splits, allocations, interest-like calculations) uses documented rounding, and remainders are explicitly allocated, never dropped.
- `BR-LED-005.4` Serialisation never converts a monetary value to a floating-point JSON number.

**Exceptions**
- `EX-LED-005.1` A rounding remainder that cannot be allocated → posting refused rather than silently absorbed.

**Events** — none
**Audit** — none additional.

**Story `US-LED-005`** — As a finance controller, I want monetary arithmetic exact, so that no rounding error can accumulate across millions of small transactions.
*Given* repeated splits and aggregations, *when* totals are computed, *then* they are exact to the minor unit with no drift.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-LED-005-1 | DEC | Static analysis finds no float on monetary paths |
| TC-LED-005-2 | DEC | Repeated split-and-sum produces exact totals |
| TC-LED-005-3 | DEC | Remainders explicitly allocated, never dropped |
| TC-LED-005-4 | API | No monetary value serialised as a float |
| TC-LED-005-5 | POS | Currency scale resolved from reference data |

---

### BFR-LED-006 — Accounts identify currency `P1`

**Acceptance (URS):** Currency is explicit for every account/posting.

**Screens** — Account view showing currency; Journal lines showing currency per line.

**Workflow**
1. Every ledger account is created with exactly one currency.
2. Every journal line carries its currency explicitly.
3. Balance validation is per currency.

**API** — account and journal payloads always include `currency`.

**Data** — `ledger_account.currency_code` NOT NULL, `journal_line.currency_code` NOT NULL

**Rules**
- `BR-LED-006.1` An account has one currency; multi-currency positions are multiple accounts.
- `BR-LED-006.2` A line's currency must match its account's currency.
- `BR-LED-006.3` There is no implicit or default currency anywhere in the ledger.
- `BR-LED-006.4` Cross-currency operations post through explicit FX accounts.

**Exceptions**
- `EX-LED-006.1` Line currency ≠ account currency → posting refused.
- `EX-LED-006.2` Missing currency → posting refused; no default is applied.

**Events** — none
**Audit** — none additional.

**Story `US-LED-006`** — As a finance controller, I want currency explicit on every account and posting, so that multi-currency activity can never be silently conflated.
*Given* a posting whose line currency differs from its account, *when* it is submitted, *then* it is refused.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-LED-006-1 | POS | Every account and line carries a currency |
| TC-LED-006-2 | NEG | Currency mismatch refused |
| TC-LED-006-3 | NEG | Missing currency never defaulted |
| TC-LED-006-4 | POS | Balance validation is per currency |

---

### BFR-LED-007 — Transaction correlation maintained `P1`

**Acceptance (URS):** Business transaction references linked journal entries.

**Screens** — Payment detail ▸ "Accounting" panel linking to its journals; Journal ▸ link back to the business transaction.

**Workflow**
1. Every posting carries the business operation's `correlation_id` and its business reference.
2. Both directions are queryable: business transaction → journals, and journal → business transaction.

**API** — `GET /api/admin/v1/ledger/journals?correlation_id=` → 200; payment responses include journal references.

**Data** — `journal.correlation_id` NOT NULL, `journal.business_ref`

**Rules**
- `BR-LED-007.1` `correlation_id` is mandatory on every journal.
- `BR-LED-007.2` The correlation id is the same one used in API responses, logs and audit (`NFR-005`), so a single identifier traces an operation end to end.
- `BR-LED-007.3` Reversals inherit the original correlation id and add their own reference.
- `BR-LED-007.4` Multi-leg operations (allocations, `GOAL-002`) share a parent correlation with per-leg references.

**Exceptions**
- `EX-LED-007.1` Posting without a correlation id → refused.

**Events** — none
**Audit** — the correlation id appears in every related audit record.

**Story `US-LED-007`** — As an investigator, I want to move between a customer's transaction and its accounting entries in both directions, so that I can resolve a query without guesswork.
*Given* a payment, *when* I inspect its accounting, *then* I see its journals; and from a journal I can find the payment.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-LED-007-1 | POS | Business transaction resolves to its journals |
| TC-LED-007-2 | POS | Journal resolves back to its business transaction |
| TC-LED-007-3 | NEG | Posting without correlation id refused |
| TC-LED-007-4 | POS | Same correlation id present in logs and audit |

---

### BFR-LED-008 — Holds and releases supported `P1`

**Acceptance (URS):** Held amount can be traced and released/reversed appropriately.

**Screens** — Position ▸ held amount itemised with reason and age; Admin ▸ Holds with ageing.

**Workflow**
1. A hold is placed with an amount, reason, correlation id and expiry.
2. It can be released (freeing funds), converted (to a posting) or expired.
3. Every hold's full lifecycle is traceable.

**API** — internal hold endpoints; `GET /api/v1/position/holds` → 200; `GET /api/admin/v1/ledger/holds?status=ACTIVE&older_than=` → 200.

**Data** — `hold(status, placed_at, expires_at, released_at, released_by_journal_id)`

**Rules**
- `BR-LED-008.1` Every hold is traceable to the operation that placed it.
- `BR-LED-008.2` A hold is released exactly once; double release is refused.
- `BR-LED-008.3` Ageing holds are monitored and alerted — an old hold usually means a stuck operation.
- `BR-LED-008.4` Hold history is retained after release; it is not deleted.

**Exceptions**
- `EX-LED-008.1` Double release → `STATE_TRANSITION_INVALID`.
- `EX-LED-008.2` Release of a hold already converted to a posting → refused.

**Events** — `ledger.hold.placed`, `ledger.hold.released`, `ledger.hold.expired`
**Audit** — hold lifecycle recorded.

**Story `US-LED-008`** — As an operations analyst, I want every hold traceable and monitored, so that funds are never left reserved indefinitely because of a stuck process.
*Given* a hold older than its expected window, *when* I review ageing holds, *then* it is listed with its originating operation.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-LED-008-1 | POS | Hold traceable to its operation |
| TC-LED-008-2 | NEG | Double release refused |
| TC-LED-008-3 | CON | Concurrent release attempts release exactly once |
| TC-LED-008-4 | INT | Ageing holds alert |
| TC-LED-008-5 | POS | Hold history retained after release |

---

### BFR-LED-009 — Imbalance prevents posting `P1`

**Acceptance (URS):** Unbalanced journal fails transaction atomically.

**Screens** — n/a (an integrity guarantee).

**Workflow**
1. The validator computes per-currency debit and credit totals inside the transaction.
2. Any imbalance raises an error that rolls back the entire business operation, not merely the posting.

**API** — internal posting returns `VALIDATION_FAILED` with the computed imbalance.

**Data** — enforced in the posting transaction; additionally verified by a scheduled integrity job over all journals.

**Rules**
- `BR-LED-009.1` Failure is atomic across the whole business operation — a payment whose posting fails does not exist as a payment.
- `BR-LED-009.2` A scheduled integrity job re-verifies every journal's balance and alerts on any exception.
- `BR-LED-009.3` Imbalance is treated as a severity-one defect, not a data-entry error to be corrected quietly.
- `BR-LED-009.4` The validator is a single code path used by every caller.

**Exceptions**
- `EX-LED-009.1` Imbalance detected by the integrity job → immediate alert, incident raised, affected correlation ids listed.

**Events** — `ledger.integrity.violation` (alerting)
**Audit** — rejected postings recorded with the imbalance detail.

**Story `US-LED-009`** — As a finance controller, I want an unbalanced posting to fail the whole operation, so that the ledger can never contain a half-recorded transaction.
*Given* an unbalanced journal, *when* it is submitted, *then* the entire operation fails and nothing is persisted.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-LED-009-1 | NEG | Unbalanced journal fails the whole operation atomically |
| TC-LED-009-2 | NEG | No partial rows persist after failure |
| TC-LED-009-3 | POS | Integrity job detects any injected imbalance |
| TC-LED-009-4 | CON | Concurrency does not create transient imbalance |

---

### BFR-LED-010 — Ledger data supports reconciliation `P1`

**Acceptance (URS):** Partner and settlement references are retained.

**Screens** — Journal ▸ partner reference; Reconciliation ▸ matched journal links.

**Workflow**
1. Postings arising from partner activity carry the partner's reference.
2. `recon-svc` matches settlement records to journals on those references (`REC-002`).
3. Unmatched items on either side become exceptions (`REC-004`, `REC-005`).

**API** — `GET /api/admin/v1/ledger/journals?partner_reference=` → 200.

**Data** — `journal.partner_reference`, indexed for matching

**Rules**
- `BR-LED-010.1` Where a partner supplies a reference, it is stored on the journal — never discarded.
- `BR-LED-010.2` Where a partner supplies none at posting time, the field is filled by a later linked adjustment record, never by editing the journal (`LED-002`).
- `BR-LED-010.3` References are indexed so reconciliation is efficient at volume.
- `BR-LED-010.4` A single partner reference matching multiple journals is an exception, not a merge (`REC-006`).

**Exceptions**
- `EX-LED-010.1` Duplicate partner reference across journals → reconciliation exception raised for investigation.

**Events** — none
**Audit** — reference linkage recorded.

**Story `US-LED-010`** — As a reconciliation analyst, I want partner references retained on postings, so that internal records can be matched to partner statements without manual detective work.
*Given* a settlement file, *when* reconciliation runs, *then* records match to journals by their partner references and anything unmatched becomes an exception.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-LED-010-1 | POS | Partner reference retained on the journal |
| TC-LED-010-2 | REC | Settlement record matches its journal by reference |
| TC-LED-010-3 | NEG | Late-arriving reference added by adjustment, not by editing |
| TC-LED-010-4 | NEG | Duplicate reference raises an exception |
| TC-LED-010-5 | POS | Matching performs within target at volume |
