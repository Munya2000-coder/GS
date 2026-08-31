# BFR-FDS-05 — Domain 05: Open Finance / BuntuConnect (`OF`)

**Context:** Open Finance (`connect-svc`) · **Epic:** `EPIC-OF` — One trustworthy view of a customer's financial life
**Wave:** W2 · **Depends on:** `CON`, `GOV` · **Contract-pending:** `Q-20` (MoMo), `Q-21` (bank), `Q-22` (SACCO)

---

### BFR-OF-001 — Connect supported external financial accounts `P1`

**Acceptance (URS):** Successful authorisation creates active connection record.

**Screens** — Add account ▸ choose institution; Provider authorisation (redirect or in-app); Connection success listing accounts found.

**Workflow**
1. Customer selects an institution from the configured, enabled list.
2. Consent is requested and recorded first (`CON-001`) — the connection cannot exist without it.
3. The relevant adapter runs the provider's authorisation flow.
4. On success a `connection` and its `connected_account` rows are created and an initial sync is scheduled.

**API**
- `GET /api/v1/institutions?type=` → 200 enabled institutions
- `POST /api/v1/connections` `{institution_id, consent_id}` → 201 `{connection_id, authorisation_url|challenge}`
- `POST /api/v1/connections/{id}/complete` → 200
- `GET /api/v1/connections` → 200

**Data** — `connection`, `connected_account` (URS §10 model), `institution`

**Rules**
- `BR-OF-001.1` A connection cannot be created without a live `consent_id`.
- `BR-OF-001.2` Credentials and tokens are never stored in plaintext; `connection.credential_handle` references the secret manager (URS §10, `NFR-003`).
- `BR-OF-001.3` Only institutions enabled for the customer's country and cohort are offered (`GOV-004/005`).
- `BR-OF-001.4` An abandoned authorisation leaves no partially-usable connection.

**Exceptions**
- `EX-OF-001.1` Provider authorisation declined → connection not created; the customer sees a plain-language reason.
- `EX-OF-001.2` Provider unavailable → `PROVIDER_UNAVAILABLE`; retry offered; no partial state persists.
- `EX-OF-001.3` Duplicate connection to the same institution and account → existing connection returned, not a second one.

**Events** — `connection.created`
**Audit** — connection creation with institution and consent reference.

**Story `US-OF-001`** — As a customer, I want to connect my mobile money and bank accounts, so that my financial activity can be seen in one place and used to build my Financial Passport.
*Given* an enabled institution and a granted consent, *when* I complete the provider's authorisation, *then* an active connection exists with my accounts listed.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-OF-001-1 | POS | Successful authorisation creates an active connection |
| TC-OF-001-2 | NEG | Connection without consent refused |
| TC-OF-001-3 | SEC | No plaintext credential is persisted anywhere |
| TC-OF-001-4 | ERR | Abandoned authorisation leaves no usable connection |
| TC-OF-001-5 | NEG | Duplicate connection returns the existing one |
| TC-OF-001-6 | PRM | Institution disabled for the cohort is not offered |

---

### BFR-OF-002 — Bank connections use provider adapters `P1`

**Acceptance (URS):** New bank adapter can be added without altering core transaction model.

**Screens** — Admin ▸ Institutions ▸ adapter binding and health.

**Workflow**
1. Each bank is configured with the adapter implementation that serves it.
2. `connect-svc` calls only `BankDataAdapter`; the adapter maps the provider payload into the URS §10/§11 models.
3. Adding a bank means adding an adapter implementation and a configuration row — nothing in the core changes.

**API** — internal adapter interface; `GET /api/admin/v1/institutions/{id}/adapter` → 200.

**Data** — `institution.adapter_key`, `connected_account`, `imported_transaction`

**Rules**
- `BR-OF-002.1` No bank-specific field, code or quirk appears in `connect-svc` domain code — quirks live in the adapter.
- `BR-OF-002.2` Adapters must populate every mandatory field of the normalised models, or mark it explicitly absent with a `source_quality` downgrade.
- `BR-OF-002.3` Every adapter is covered by contract tests against the interface (`BFR-STD-009`).
- `BR-OF-002.4` A new adapter can be enabled per cohort first (`GOV-005`).

**Exceptions**
- `EX-OF-002.1` Adapter returns an unmappable payload → sync marked `PARTIAL`, the affected records are quarantined and alerted, and previously imported data is untouched (`OF-008`).

**Events** — `connection.synced`
**Audit** — adapter binding changes.

**Story `US-OF-002`** — As a platform owner, I want each bank behind an adapter, so that adding a bank does not require changing the transaction model.
*Given* a new bank adapter, *when* it is configured and enabled, *then* its data appears in the standard model with no core change.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-OF-002-1 | POS | New adapter's data lands in the standard model |
| TC-OF-002-2 | INT | Contract tests pass for every adapter |
| TC-OF-002-3 | NEG | Unmappable payload quarantined, existing data intact |
| TC-OF-002-4 | SEC | Adapter cannot bypass the consent check |

---

### BFR-OF-003 — Mobile-money connections use provider adapters `P1`

**Acceptance (URS):** Different operators implement standard interface.

**Screens** — Add account ▸ Mobile money ▸ operator selection; MSISDN confirmation.

**Workflow**
1. Customer selects an operator and confirms the MSISDN to connect.
2. `MobileMoneyAdapter` performs the operator's authorisation (USSD push, OTP or API, per operator).
3. Accounts and history are imported through the same normalisation path as banks.

**API** — same connection endpoints; `POST /api/v1/connections` with a mobile-money institution.

**Data** — `connected_account.account_type = MOBILE_MONEY`

**Rules**
- `BR-OF-003.1` All operators implement the same interface; operator differences are confined to adapters.
- `BR-OF-003.2` Where an operator supplies no stable transaction identifier, the adapter derives a documented composite key and downgrades `source_quality` (`Q-20`, `OF-009`).
- `BR-OF-003.3` The MSISDN connected must belong to the authenticated customer, verified by the operator flow.
- `BR-OF-003.4` History depth requested is configuration, bounded by what the operator permits.

**Exceptions**
- `EX-OF-003.1` MSISDN mismatch → refused, and the attempt is treated as a fraud signal (`FRD-003`).
- `EX-OF-003.2` Operator rate limit → sync backs off and retries; the customer sees "sync delayed", not "failed".

**Events** — `connection.created`, `connection.synced`
**Audit** — connection with operator and MSISDN (masked).

**Story `US-OF-003`** — As a customer, I want to connect any supported mobile money account, so that my main financial activity is included regardless of operator.
*Given* two different operators, *when* I connect both, *then* their data appears in one consistent format.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-OF-003-1 | POS | Two operators produce identically-shaped data |
| TC-OF-003-2 | SEC | Connecting another person's MSISDN refused |
| TC-OF-003-3 | INT | Missing external id handled by documented fallback with quality downgrade |
| TC-OF-003-4 | ERR | Rate limit produces a delay, not a failure |

---

### BFR-OF-004 — SACCO data sources where technically available `P2`

**Acceptance (URS):** SACCO data maps into common account schema.

**Screens** — Add account ▸ SACCO, with an honest statement of what is available and how fresh it will be.

**Workflow**
1. Where a SACCO offers an interface, it is treated exactly like a bank.
2. Where it does not, a controlled file or assisted-import path is used, and the resulting data is labelled accordingly.

**API** — same connection endpoints; `POST /api/v1/connections/{id}/import` for file-based sources.

**Data** — `connected_account.account_type = SACCO`, `source_quality = FILE_IMPORT`

**Rules**
- `BR-OF-004.1` File-imported SACCO data is never labelled as verified API data; `source_quality` follows it into every Passport metric (`FP-003`, `BIZ-010`).
- `BR-OF-004.2` The Passport displays SACCO coverage and freshness honestly, including when data is stale (`FPS-010`).
- `BR-OF-004.3` Manual import requires the same consent as any other source.
- `BR-OF-004.4` If no interface exists at all (`Q-22`), the institution is simply not offered — a placeholder that cannot sync is never shown as connectable.

**Exceptions**
- `EX-OF-004.1` Malformed import file → rejected with row-level feedback; nothing partially imported.

**Events** — `connection.created`, `transaction.imported`
**Audit** — import file reference, importer, record counts.

**Story `US-OF-004`** — As a SACCO member, I want my SACCO activity included where possible, so that a significant part of my financial life is not invisible.
*Given* SACCO data imported from a file, *when* it contributes to my Passport, *then* it is labelled as file-sourced rather than verified API data.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-OF-004-1 | POS | SACCO data maps into the common schema |
| TC-OF-004-2 | POS | Source quality label propagates to Passport metrics |
| TC-OF-004-3 | NEG | Malformed file rejected atomically |
| TC-OF-004-4 | PRM | Import requires consent |

---

### BFR-OF-005 — Imported transactions are normalised `P1`

**Acceptance (URS):** Different provider formats map to standard transaction representation.

**Screens** — Transactions list (uniform regardless of source); Transaction detail showing source institution.

**Workflow**
1. The adapter returns provider-native records.
2. The normaliser maps them into the URS §11 standard transaction model, applying currency, direction and timestamp conventions.
3. Normalised records are deduplicated (`OF-009`) then persisted with provenance (`OF-006`).

**API** — `GET /api/v1/transactions?account_id=&from=&to=&cursor=` → 200 standard shape.

**Data** — `imported_transaction` (URS §11)

**Rules**
- `BR-OF-005.1` Amounts are converted to minor units on ingest; no decimal or float representation survives normalisation (`LED-005`).
- `BR-OF-005.2` Direction is explicit (`CREDIT`/`DEBIT`); sign conventions differ by provider and are resolved in the adapter.
- `BR-OF-005.3` Timestamps are stored as UTC with the provider's original value retained in `raw_reference`.
- `BR-OF-005.4` Unmappable fields are left null and reflected in `source_quality`; they are never guessed.

**Exceptions**
- `EX-OF-005.1` Missing mandatory field (amount, currency, date) → the record is quarantined, not imported, and alerted.
- `EX-OF-005.2` Unknown currency → quarantined; no default currency is ever assumed.

**Events** — `transaction.imported`
**Audit** — sync run counts; quarantine events alerted.

**Story `US-OF-005`** — As a customer, I want transactions from every connected source shown consistently, so that I can understand my finances without translating between formats.
*Given* accounts at two providers with different formats, *when* I view my transactions, *then* they appear in one consistent representation.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-OF-005-1 | POS | Two provider formats normalise identically |
| TC-OF-005-2 | DEC | Amounts exact in minor units, no float anywhere |
| TC-OF-005-3 | NEG | Record missing a mandatory field quarantined |
| TC-OF-005-4 | NEG | Unknown currency never defaulted |
| TC-OF-005-5 | POS | Original provider values retained in raw reference |

---

### BFR-OF-006 — Data source provenance retained `P1`

**Acceptance (URS):** Original source and external reference remain retrievable.

**Screens** — Transaction detail ▸ "Where this came from"; Passport metric ▸ contributing sources.

**Workflow**
1. Every imported record stores `source_system`, `external_transaction_id`, `raw_reference` and `source_quality`.
2. Provenance flows through categorisation into Passport metric sources (`passport_metric_source`).
3. Any displayed figure can be traced back to the records and sources that produced it.

**API** — `GET /api/v1/transactions/{id}/provenance` → 200.

**Data** — `imported_transaction` provenance columns; `passport_metric_source`

**Rules**
- `BR-OF-006.1` Provenance fields are mandatory — a record without them cannot be persisted.
- `BR-OF-006.2` Imported records are **never edited**; corrections are overlays (`CAT-003`).
- `BR-OF-006.3` Raw payloads are retained per the retention schedule and are accessible only to authorised roles.
- `BR-OF-006.4` Provenance survives into every derived artefact, including Passport exports (`FP-008`).

**Exceptions**
- `EX-OF-006.1` Attempt to modify an imported record → `PERMISSION_DENIED`; the correct action is a correction overlay.

**Events** — `transaction.imported`
**Audit** — access to raw payloads audited.

**Story `US-OF-008x`** *(traces `BFR-OF-006`)* — As a lender receiving a Passport, I want each figure traceable to its source, so that I can rely on it.
*Given* a Passport metric, *when* I inspect it, *then* I can see which institutions and which retrieval times contributed.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-OF-006-1 | POS | Provenance retrievable for any imported transaction |
| TC-OF-006-2 | NEG | Record without provenance cannot be persisted |
| TC-OF-006-3 | SEC | Imported record cannot be edited |
| TC-OF-006-4 | POS | Provenance propagates into Passport metric sources |
| TC-OF-006-5 | PRM | Raw payload access restricted and audited |

---

### BFR-OF-007 — Synchronisation status is visible `P2`

**Acceptance (URS):** Customer sees latest successful sync and connection problems.

**Screens** — Accounts list with per-connection status chip (icon + text, never colour alone, URS §20) and "last updated" time; Connection detail with problem explanation and a fix action.

**Workflow**
1. Every sync run records start, finish, counts and outcome.
2. The connection's status and `last_successful_sync_at` are surfaced to the customer.
3. A failing connection offers a clear remedy — usually reconnect.

**API** — `GET /api/v1/connections` → 200 including `connection_status`, `last_successful_sync_at`, `problem_reason_key`.

**Data** — `sync_run`, `connected_account.last_successful_sync_at`, `connection_status`

**Rules**
- `BR-OF-007.1` Status is honest: a connection that has not synced successfully within its expected interval shows as `DEGRADED`, not `ACTIVE`.
- `BR-OF-007.2` Problem reasons are plain-language localisation keys, not provider error codes.
- `BR-OF-007.3` Stale data anywhere it is displayed carries its age (`FPS-010` principle).
- `BR-OF-007.4` Repeated failures notify the customer once, not on every attempt.

**Exceptions**
- `EX-OF-007.1` Provider degraded → status `DEGRADED` with an explanation; existing data remains available and labelled.

**Events** — `connection.synced`, `connection.failed`
**Audit** — sync outcomes retained.

**Story `US-OF-007`** — As a customer, I want to see when each account last updated and what is wrong when it has not, so that I know whether what I am looking at is current.
*Given* a failing connection, *when* I view my accounts, *then* I see the problem in plain language and how to fix it.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-OF-007-1 | POS | Last successful sync displayed |
| TC-OF-007-2 | POS | Failure shown with plain-language reason and remedy |
| TC-OF-007-3 | POS | Status uses icon and text, not colour alone |
| TC-OF-007-4 | NEG | Repeated failures do not spam notifications |

---

### BFR-OF-008 — Failed connections do not corrupt existing data `P1`

**Acceptance (URS):** Existing records remain intact after provider failure.

**Screens** — Connection detail showing the failed run without altering the visible history.

**Workflow**
1. Each sync run operates in its own transaction scope.
2. A failure marks the run `FAILED` or `PARTIAL` and leaves all previously imported records untouched.
3. Records successfully imported within a partial run are retained; the rest are retried on the next run.

**API** — `GET /api/v1/connections/{id}/sync-runs` → 200.

**Data** — `sync_run(status, records_imported, error_code)`

**Rules**
- `BR-OF-008.1` A sync never deletes or truncates previously imported data as a "refresh" strategy.
- `BR-OF-008.2` Partial success is preserved, not rolled back, because deduplication makes re-import safe (`OF-009`).
- `BR-OF-008.3` A failed run never changes connection-level balances to zero or null — the last known values remain with their timestamp.
- `BR-OF-008.4` Repeated failures escalate the connection to `FAILED` and alert operations, without touching data.

**Exceptions**
- `EX-OF-008.1` Provider returns an empty history where data previously existed → treated as suspect, not as deletion; the run is flagged and alerted, and existing data is retained.

**Events** — `connection.failed`
**Audit** — run outcomes; suspicious empty responses alerted.

**Story `US-OF-008`** — As a customer, I want a failed refresh to leave my existing history intact, so that a provider outage never erases what I could already see.
*Given* imported history, *when* the next sync fails, *then* my existing transactions and last-known balances are unchanged.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-OF-008-1 | POS | Failed sync leaves existing records intact |
| TC-OF-008-2 | POS | Partial run retains what it imported |
| TC-OF-008-3 | NEG | Balances not zeroed by a failed run |
| TC-OF-008-4 | NEG | Empty provider response does not delete history |
| TC-OF-008-5 | CON | Concurrent syncs on one connection do not corrupt state |

---

### BFR-OF-009 — Duplicate imported transactions detected `P1`

**Acceptance (URS):** Same provider transaction is not counted twice.

**Screens** — none customer-facing; Admin ▸ sync run shows `records_deduplicated`.

**Workflow**
1. Each normalised record is keyed on `(connected_account_id, external_transaction_id)`.
2. A unique index rejects a second insert of the same key; the record is counted as deduplicated, not as an error.
3. Where no stable external id exists, the adapter's documented composite key is used and `source_quality` is downgraded.

**API** — none additional.

**Data** — unique index on `(connected_account_id, external_transaction_id)`

**Rules**
- `BR-OF-009.1` Deduplication is enforced by a database constraint, not only by application logic — the guarantee must survive concurrent syncs.
- `BR-OF-009.2` Overlapping date-range fetches are expected and safe by design.
- `BR-OF-009.3` A duplicate never increments any Passport, turnover or savings figure.
- `BR-OF-009.4` The composite fallback key is documented per adapter and covered by tests (`Q-20`).

**Exceptions**
- `EX-OF-009.1` Same external id with a **different** amount → not silently deduplicated; quarantined and alerted as a provider data-integrity issue.

**Events** — `transaction.imported` only for genuinely new records.
**Audit** — deduplication counts per run.

**Story `US-OF-009`** — As a customer, I want repeated syncs not to double-count my transactions, so that my income and turnover figures are correct.
*Given* overlapping sync windows, *when* the same provider transaction is fetched twice, *then* it is stored once and counted once.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-OF-009-1 | POS | Repeated fetch stores the record once |
| TC-OF-009-2 | CON | Concurrent syncs cannot both insert the same record |
| TC-OF-009-3 | POS | Passport figures unaffected by duplicate fetches |
| TC-OF-009-4 | NEG | Same id with different amount quarantined, not deduplicated |
| TC-OF-009-5 | INT | Composite fallback key works for a provider without stable ids |

---

### BFR-OF-010 — Disconnection stops further retrieval `P1`

**Acceptance (URS):** No additional sync occurs after connection removal or consent revocation.

**Screens** — Connection detail ▸ Disconnect, stating clearly what stops and what is kept.

**Workflow**
1. Customer disconnects, or revokes the underlying consent (`CON-005`).
2. Scheduling is cancelled, in-flight runs are cancelled, and the provider token is revoked and destroyed.
3. The connection status becomes `DISCONNECTED` or `CONSENT_REVOKED`; historical data is retained per policy.

**API** — `DELETE /api/v1/connections/{id}` → 204; also triggered by `consent.revoked`.

**Data** — `connection.connection_status`, `credential_handle` destroyed

**Rules**
- `BR-OF-010.1` Disconnection revokes the provider token where the provider supports it, and always destroys the stored handle.
- `BR-OF-010.2` The scheduler checks connection status at execution time, so no queued job can run after disconnection.
- `BR-OF-010.3` Historical data is retained unless a separate deletion request is made and permitted (`CON-006`, URS §17).
- `BR-OF-010.4` Reconnection is a new connection with a new consent, never a revival of the old one.

**Exceptions**
- `EX-OF-010.1` Provider token revocation fails → the local handle is destroyed regardless, the failure is alerted, and no further calls are made.

**Events** — `connection.disconnected`
**Audit** — disconnection actor, trigger (customer or consent revocation) and outcome.

**Story `US-OF-010`** — As a customer, I want disconnecting an account to genuinely stop data retrieval, so that removing permission is effective, not cosmetic.
*Given* a disconnected account, *when* the next sync would have run, *then* no call is made to the provider and no new data appears.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-OF-010-1 | POS | No sync occurs after disconnection |
| TC-OF-010-2 | POS | Consent revocation disconnects automatically |
| TC-OF-010-3 | SEC | Stored credential handle destroyed |
| TC-OF-010-4 | CON | Queued job cancelled at execution time |
| TC-OF-010-5 | POS | Historical data retained per policy |
| TC-OF-010-6 | ERR | Provider revocation failure still stops all local activity |
