# BFR-FDS-06 — Domain 06: Transaction Categorisation (`CAT`)

**Context:** Insight (`insight-svc`) · **Epic:** `EPIC-CAT` — Understandable, correctable, versioned classification
**Wave:** W2 · **Depends on:** `OF` · **Feeds:** `FP`, `FH`, `BIZ`
**Constraint:** URS §9 — rules first; any ML assist is versioned, explainable and always correctable.

---

### BFR-CAT-001 — Automatic categorisation `P2`

**Acceptance (URS):** Supported transactions receive system category and confidence value.

**Screens** — Transactions list showing category chips; Transaction detail with category and confidence indicator.

**Workflow**
1. On `transaction.imported`, the classifier evaluates rules in priority order (merchant code, counterparty pattern, description keywords, amount/periodicity signals).
2. The first matching rule assigns a category and a confidence value.
3. The classification is written as a new `classification` row referencing the model version.

**API** — `GET /api/v1/transactions?category=` → 200; internal `POST /internal/insight/classify`.

**Data** — `classification(category_id, confidence, model_version_id, is_current)`

**Rules**
- `BR-CAT-001.1` Every classification records the model/rule version that produced it (`CAT-008`).
- `BR-CAT-001.2` Confidence is always populated; an unclassifiable transaction is assigned `UNCATEGORISED` with confidence 0, never left null.
- `BR-CAT-001.3` Classification is asynchronous and never blocks import.
- `BR-CAT-001.4` Classification never modifies the imported transaction — it is a separate row (`OF-006`).

**Exceptions**
- `EX-CAT-001.1` Classifier failure → transaction remains `UNCATEGORISED`, retried; import is unaffected.

**Events** — `transaction.categorised`
**Audit** — not per-transaction; model deployments are audited.

**Story `US-CAT-001`** — As a customer, I want my transactions categorised automatically, so that I can see where my money goes without labelling everything myself.
*Given* an imported transaction, *when* classification runs, *then* it has a category and a confidence value.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAT-001-1 | POS | Transaction receives category and confidence |
| TC-CAT-001-2 | POS | Unmatched transaction is UNCATEGORISED with confidence 0 |
| TC-CAT-001-3 | NEG | Classification does not modify the imported record |
| TC-CAT-001-4 | ERR | Classifier failure does not block import |

---

### BFR-CAT-002 — Configurable categories `P2`

**Acceptance (URS):** New category can be introduced without database redesign.

**Screens** — Admin ▸ Categories (hierarchical tree, add/rename/deprecate).

**Workflow**
1. Categories live in a hierarchical reference table.
2. A new category is added as data; rules referencing it are configuration.
3. Deprecating a category hides it from new classification but preserves historical assignments.

**API** — `GET /api/v1/categories` → 200 tree; `POST /api/admin/v1/categories` → 201.

**Data** — `category(id, parent_id, code, name_key, is_active, is_business, is_cash, is_remittance)`

**Rules**
- `BR-CAT-002.1` Categories are rows, never enums in code — adding one requires no migration.
- `BR-CAT-002.2` Category names are localisation keys (URS §18).
- `BR-CAT-002.3` A deprecated category is never deleted; historical classifications keep resolving.
- `BR-CAT-002.4` Semantic flags (`is_business`, `is_cash`, `is_remittance`) are attributes, so `CAT-004`, `CAT-005` and `CAT-006` are configuration, not special-case code.

**Exceptions**
- `EX-CAT-002.1` Deleting a category in use → refused; deprecation offered instead.

**Events** — `category.changed`
**Audit** — category changes audited.

**Story `US-CAT-002`** — As a product administrator, I want to add a category without a database change, so that the taxonomy can evolve with what we learn from the pilot.
*Given* a new category added as configuration, *when* rules reference it, *then* transactions are classified into it with no schema change.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAT-002-1 | POS | New category usable without migration |
| TC-CAT-002-2 | NEG | Category in use cannot be deleted |
| TC-CAT-002-3 | POS | Deprecated category still resolves historically |
| TC-CAT-002-4 | POS | Names render in all supported languages |

---

### BFR-CAT-003 — Customers correct categories `P1`

**Acceptance (URS):** Customer correction does not overwrite original machine classification.

**Screens** — Transaction detail ▸ Change category; "You changed this from X" indicator with an undo.

**Workflow**
1. Customer selects a different category.
2. A `category_correction` row is written and `imported_transaction.customer_category_id` is set.
3. The machine classification remains untouched and visible in the transaction's history.
4. Downstream metrics recalculate using the resolved category, recording which source was used.

**API**
- `PUT /api/v1/transactions/{id}/category` `{category_id, reason?}` → 200
- `GET /api/v1/transactions/{id}/category-history` → 200

**Data** — `imported_transaction.system_category_id` (untouched), `.customer_category_id`, `category_correction` (append-only)

**Rules**
- `BR-CAT-003.1` `system_category_id` is never updated by a customer correction — two columns, two meanings.
- `BR-CAT-003.2` The resolved category prefers the customer's, and every metric records which source it used.
- `BR-CAT-003.3` Corrections are append-only and reversible by a further correction, never by deletion.
- `BR-CAT-003.4` A correction triggers recalculation of affected Passport metrics as a **new version**, never an in-place edit (`FP-009`, `CAT-009`).
- `BR-CAT-003.5` Corrections are a signal for model improvement but never silently retrain a live model (URS §9).

**Exceptions**
- `EX-CAT-003.1` Correction to a deprecated category → `VALIDATION_FAILED`.
- `EX-CAT-003.2` Correction on another customer's transaction → `404`.

**Events** — `transaction.corrected`
**Audit** — correction actor, from, to, timestamp.

**Story `US-CAT-003`** — As a customer, I want to correct a wrong category, so that my Passport reflects reality — without the platform losing what it originally thought.
*Given* a mis-categorised transaction, *when* I correct it, *then* my category applies to my figures and the original machine classification is still recorded.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAT-003-1 | POS | Correction applies to derived figures |
| TC-CAT-003-2 | NEG | Machine classification not overwritten |
| TC-CAT-003-3 | POS | Correction history retrievable |
| TC-CAT-003-4 | PRM | Cannot correct another customer's transaction |
| TC-CAT-003-5 | INT | Correction produces a new Passport metric version, not an edit |

---

### BFR-CAT-004 — Business income distinguishable from personal transfers `P1`

**Acceptance (URS):** Financial Passport calculations can exclude identified non-business transfers.

**Screens** — Merchant ▸ Income view with a business/personal toggle; Transaction detail ▸ "Is this business income?".

**Workflow**
1. Categories carry an `is_business` attribute; classification assigns accordingly.
2. Signals include the receiving account (merchant vs personal), counterparty patterns and customer confirmation.
3. Passport business metrics filter on the business flag, and state the filter in the metric's explanation.

**API** — `GET /api/v1/transactions?business_only=true`; `PUT /api/v1/transactions/{id}/business-flag`.

**Data** — `category.is_business`, resolved per transaction; recorded on `passport_metric_source`

**Rules**
- `BR-CAT-004.1` A transfer between a customer's own accounts is never counted as income — internal transfer detection runs before income aggregation.
- `BR-CAT-004.2` Business and personal figures are never silently combined; a combined view is explicitly labelled.
- `BR-CAT-004.3` The customer's designation overrides the machine's (`CAT-003`), and the Passport explanation says so.
- `BR-CAT-004.4` Exclusions are visible in the metric explanation (`FP-008`), not hidden inside the calculation.

**Exceptions**
- `EX-CAT-004.1` Ambiguous transaction → included in a low-confidence bucket and surfaced for confirmation (`CAT-010`), never silently counted as business income.

**Events** — `transaction.categorised`, `transaction.corrected`
**Audit** — business-flag changes audited.

**Story `US-CAT-004`** — As a merchant, I want money from my family kept separate from my sales, so that my business turnover is not overstated to a lender.
*Given* a personal transfer into my merchant account, *when* my Passport calculates turnover, *then* it is excluded, and the explanation says so.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAT-004-1 | POS | Personal transfer excluded from business turnover |
| TC-CAT-004-2 | NEG | Own-account transfer never counted as income |
| TC-CAT-004-3 | POS | Customer designation overrides the machine's |
| TC-CAT-004-4 | POS | Exclusion visible in the metric explanation |

---

### BFR-CAT-005 — Cash withdrawals separately classified `P2`

**Acceptance (URS):** Cash-out activity can be measured distinctly.

**Screens** — Insights ▸ Cash usage; Passport ▸ cash withdrawal dependency metric.

**Workflow**
1. Withdrawal-type transactions are classified into categories flagged `is_cash`.
2. The Passport derives a cash-dependency indicator from the ratio of cash-out to total outflow.

**API** — `GET /api/v1/insights/cash-usage?from=&to=` → 200.

**Data** — `category.is_cash`

**Rules**
- `BR-CAT-005.1` Cash-out classification is based on transaction type and channel, not on description text alone.
- `BR-CAT-005.2` Cash dependency is presented neutrally — it is an observation, not a judgement (`FH-006`).
- `BR-CAT-005.3` Agent-cashout and ATM withdrawals are distinguishable where the provider supplies the channel.

**Exceptions**
- `EX-CAT-005.1` Channel not supplied by the provider → classified as generic cash-out with a `source_quality` note.

**Events** — `transaction.categorised`
**Audit** — none additional.

**Story `US-CAT-005`** — As a customer, I want cash withdrawals identified separately, so that my digital and cash activity can be understood distinctly.
*Given* withdrawals in my history, *when* I view cash usage, *then* they are measured separately from other spending.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAT-005-1 | POS | Withdrawals classified as cash-out |
| TC-CAT-005-2 | POS | Cash dependency computed from the ratio |
| TC-CAT-005-3 | NEG | Description text alone does not drive classification |
| TC-CAT-005-4 | POS | Missing channel handled with a quality note |

---

### BFR-CAT-006 — Remittances identifiable `P2`

**Acceptance (URS):** Cross-border remittance inflows can be analysed separately.

**Screens** — Insights ▸ Money received from abroad; Passport ▸ remittance share of income.

**Workflow**
1. Inflows are flagged as remittance where the source is a cross-border rail, an identified remittance counterparty, or a BuntuSwitch transfer.
2. The Passport computes remittance share of income, showing it as a distinct component.

**API** — `GET /api/v1/insights/remittances?from=&to=` → 200.

**Data** — `category.is_remittance`; BuntuSwitch inflows carry an authoritative flag.

**Rules**
- `BR-CAT-006.1` Platform-originated cross-border inflows (`XB`) are flagged authoritatively, not inferred.
- `BR-CAT-006.2` Externally imported remittances are inferred and marked lower confidence.
- `BR-CAT-006.3` Remittance share is reported as a component of income, never as a deduction from it — remittance income is still income.
- `BR-CAT-006.4` Remittance patterns feed AML monitoring where configured (`AML-005`).

**Exceptions**
- `EX-CAT-006.1` Ambiguous inflow → low-confidence flag, surfaced for confirmation.

**Events** — `transaction.categorised`
**Audit** — none additional.

**Story `US-CAT-006`** — As a customer receiving support from abroad, I want remittances identified, so that a lender can see this income clearly for what it is.
*Given* remittance inflows, *when* my Passport is calculated, *then* remittance share of income is shown as its own indicator.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAT-006-1 | POS | Platform cross-border inflow flagged authoritatively |
| TC-CAT-006-2 | POS | Imported remittance inferred with lower confidence |
| TC-CAT-006-3 | POS | Remittance share computed as a component of income |
| TC-CAT-006-4 | INT | Remittance pattern visible to AML monitoring |

---

### BFR-CAT-007 — Recurring transactions detected `P3`

**Acceptance (URS):** System identifies repeated periodic counterparties/payments.

**Screens** — Insights ▸ Regular payments; Passport ▸ recurring essential expenditure.

**Workflow**
1. A periodicity detector groups transactions by counterparty and amount tolerance.
2. Where a stable interval is observed over a configured minimum number of occurrences, a recurring series is created.
3. Series feed the recurring-expenditure and commitments metrics.

**API** — `GET /api/v1/insights/recurring` → 200 series with cadence, typical amount and next expected date.

**Data** — `recurring_series(counterparty_key, cadence, typical_amount_minor, confidence, first_seen, last_seen)`

**Rules**
- `BR-CAT-007.1` Detection thresholds (minimum occurrences, interval and amount tolerance) are configuration.
- `BR-CAT-007.2` A recurring series is a **derived observation**, clearly labelled as such, never presented as a commitment the customer has confirmed (`FH-005`).
- `BR-CAT-007.3` The customer can dismiss an incorrect series; the dismissal persists.
- `BR-CAT-007.4` Series are versioned with the detector version (`CAT-008`).

**Exceptions**
- `EX-CAT-007.1` Insufficient history → no series is created; the absence is reported honestly rather than guessed.

**Events** — `transaction.categorised`
**Audit** — none additional.

**Story `US-CAT-007`** — As a customer, I want my regular payments recognised, so that my recurring commitments are visible in my financial picture.
*Given* a payment repeating monthly, *when* enough occurrences are seen, *then* it is identified as recurring and shown with its cadence.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAT-007-1 | POS | Repeating payment detected as a series |
| TC-CAT-007-2 | NEG | Insufficient history produces no series |
| TC-CAT-007-3 | POS | Customer dismissal persists |
| TC-CAT-007-4 | POS | Series labelled as observed, not confirmed |

---

### BFR-CAT-008 — Classification models are versioned `P1`

**Acceptance (URS):** Every automated classification can identify model/rule version.

**Screens** — Admin ▸ Models register (URS §9 fields); Transaction detail ▸ "classified by version X".

**Workflow**
1. Every rule set or model is registered with the URS §9 attributes before deployment.
2. Deployment records the version and its effective window.
3. Every classification row carries `model_version_id`.

**API** — `GET /api/admin/v1/models` → 200; `POST /api/admin/v1/models/{id}/deploy` → 200 (approval required).

**Data** — `classification_model` (URS §9 register), `classification.model_version_id` NOT NULL

**Rules**
- `BR-CAT-008.1` `model_version_id` is non-null on every classification — an unversioned classification cannot be written.
- `BR-CAT-008.2` The register carries every URS §9 attribute: id, version, owner, purpose, approved and prohibited inputs, training data reference, validation record, deployment date, performance metrics, fairness assessment, explainability approach and rollback mechanism.
- `BR-CAT-008.3` Deployment requires approval and is audited (`GOV-008`).
- `BR-CAT-008.4` Rollback to a prior version is supported and does not delete results produced by the rolled-back version.

**Exceptions**
- `EX-CAT-008.1` Deploying a model with an incomplete register entry → refused.

**Events** — `model.deployed`
**Audit** — registration, validation, deployment and rollback.

**Story `US-CAT-008`** — As a compliance officer, I want every automated classification attributable to a specific model version, so that a disputed figure can be reproduced exactly.
*Given* a classification from three months ago, *when* I inspect it, *then* I can identify the exact rule set or model version that produced it.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAT-008-1 | POS | Classification carries the model version |
| TC-CAT-008-2 | NEG | Unversioned classification cannot be written |
| TC-CAT-008-3 | NEG | Incomplete register entry blocks deployment |
| TC-CAT-008-4 | AUD | Deployment approved and audited |
| TC-CAT-008-5 | POS | Rollback preserves prior results |

---

### BFR-CAT-009 — Model changes do not silently rewrite historical evidence `P1`

**Acceptance (URS):** Historical results remain reproducible.

**Screens** — Transaction detail ▸ classification history across versions; Passport metric ▸ version and recalculation notice.

**Workflow**
1. A new model version classifies **new** transactions from its effective date.
2. Reclassification of history, where genuinely needed, is an explicit, approved, audited batch that writes new rows and marks the previous ones superseded.
3. Passport metrics recalculated after a model change are new metric versions; prior versions remain retrievable.

**API** — `POST /api/admin/v1/models/{id}/reclassify` → 202 (approval required); `GET /api/v1/transactions/{id}/classifications` → 200 all versions.

**Data** — `classification` (append-only, `is_current` flag), `passport_metric` (versioned)

**Rules**
- `BR-CAT-009.1` Classification rows are append-only; a new version never updates an old row.
- `BR-CAT-009.2` Reclassification of history requires explicit approval and is never a side effect of deployment.
- `BR-CAT-009.3` Any figure previously shared with a partner remains reproducible exactly as shared (`FPS-008`).
- `BR-CAT-009.4` Where a recalculation materially changes a shared figure, the recipient's view shows both the value shared and its current value with timestamps.

**Exceptions**
- `EX-CAT-009.1` Attempt to update an existing classification row → `PERMISSION_DENIED`.

**Events** — `model.reclassification.started`, `passport.updated`
**Audit** — reclassification scope, approver, affected record count.

**Story `US-CAT-009`** — As an auditor, I want a model change not to rewrite history, so that a figure shared with a lender last month can still be reproduced today.
*Given* a Passport metric shared in May, *when* a new model deploys in July, *then* the May figure remains reproducible with its original version.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAT-009-1 | POS | New model version does not alter existing classifications |
| TC-CAT-009-2 | POS | Historical metric reproducible after a model change |
| TC-CAT-009-3 | PRM | Reclassification requires approval |
| TC-CAT-009-4 | SEC | Classification rows cannot be updated |
| TC-CAT-009-5 | POS | Shared figure and current figure both visible with timestamps |

---

### BFR-CAT-010 — Low-confidence classifications identifiable `P2`

**Acceptance (URS):** Configurable confidence threshold flags transactions for correction/review.

**Screens** — Transactions ▸ "Needs your attention" filter; nudge to confirm low-confidence items.

**Workflow**
1. Classifications below the configured threshold are flagged.
2. Flagged items are surfaced to the customer for confirmation, and excluded or down-weighted in metrics per configuration.
3. Confirmation clears the flag and is recorded as a correction (`CAT-003`).

**API** — `GET /api/v1/transactions?confidence_below=` → 200; `POST /api/v1/transactions/{id}/confirm-category` → 200.

**Data** — `classification.confidence`, threshold in configuration

**Rules**
- `BR-CAT-010.1` The threshold is configuration, not a constant.
- `BR-CAT-010.2` Metrics state how low-confidence data was treated, in the explanation (`FP-008`).
- `BR-CAT-010.3` `data_completeness` and `confidence` on affected Passport metrics reflect the proportion of low-confidence input.
- `BR-CAT-010.4` The customer is nudged, never nagged — nudge frequency is configured (`NOT-006`).

**Exceptions**
- `EX-CAT-010.1` Too many low-confidence items to meet the Passport minimum-data criteria → Passport reports `INSUFFICIENT_DATA` honestly rather than producing a weak figure (`FP-001`).

**Events** — `transaction.categorised`
**Audit** — confirmations recorded as corrections.

**Story `US-CAT-010`** — As a customer, I want to be shown the transactions the system is unsure about, so that I can improve the accuracy of my own financial picture.
*Given* a low-confidence classification, *when* I open my transactions, *then* it is flagged for confirmation and its effect on my metrics is disclosed.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAT-010-1 | POS | Below-threshold classification flagged |
| TC-CAT-010-2 | POS | Threshold change takes effect via configuration |
| TC-CAT-010-3 | POS | Metric explanation discloses treatment of low-confidence data |
| TC-CAT-010-4 | POS | Confirmation clears the flag and records a correction |
| TC-CAT-010-5 | NEG | Excessive low-confidence data yields INSUFFICIENT_DATA, not a weak figure |
