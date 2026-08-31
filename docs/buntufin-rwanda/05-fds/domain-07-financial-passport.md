# BFR-FDS-07 — Domain 07: Financial Passport (`FP`)

**Context:** Financial Passport (`passport-svc`) · **Epic:** `EPIC-FP` — A defensible financial identity for people without a credit file
**Wave:** W2 · **Depends on:** `OF`, `CAT`, `CON`, `BIZ` · **Blocked values:** `Q-15` (minimum data), `Q-16` (bands) · **Blocking question:** `Q-09` (is this a regulated credit information activity?)

**Mandated structures:** URS §6 (metric and source fields), §7 (core metric set), §8 (explainability standard).

---

### BFR-FP-001 — Eligible customers generate a Financial Passport `P1`

**Acceptance (URS):** Passport can be created when configured minimum data criteria are met.

**Screens** — Passport ▸ empty state showing exactly what is still needed; Generate; Passport overview.

**Workflow**
1. The eligibility checker evaluates configured criteria: months of coverage, number of sources, minimum transaction count, identity status.
2. If unmet, the customer sees precisely what is missing and how to satisfy it.
3. If met, metrics are calculated and a `passport` with its metric set is created.
4. Passports refresh on a configured cadence and on material data change.

**API**
- `GET /api/v1/passport/eligibility` → 200 `{eligible, unmet_criteria[]}`
- `POST /api/v1/passport` → 201
- `GET /api/v1/passport` → 200

**Data** — `passport`, `passport_metric`, `passport_metric_source`

**Rules**
- `BR-FP-001.1` Minimum data criteria are configuration (`Q-15` placeholder), never coded thresholds.
- `BR-FP-001.2` A Passport is never generated from data lacking a live consent (`CON-001`).
- `BR-FP-001.3` Where criteria are unmet, the platform reports `INSUFFICIENT_DATA` — it never produces a weak Passport to appear helpful.
- `BR-FP-001.4` Eligibility feedback is specific and actionable ("connect one more account", "two more months of history"), not a bare refusal.

**Exceptions**
- `EX-FP-001.1` Criteria unmet → `422` with the unmet criteria enumerated; no partial Passport is created.
- `EX-FP-001.2` Consent revoked mid-calculation → calculation aborts, nothing is persisted.

**Events** — `passport.generated`
**Audit** — generation with the criteria version applied.

**Story `US-FP-001`** — As a customer with no credit history, I want to generate a Financial Passport from my real financial activity, so that I can evidence my finances to a lender.
*Given* I meet the minimum data criteria, *when* I generate my Passport, *then* it is created with metrics, sources and explanations.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FP-001-1 | POS | Eligible customer generates a Passport |
| TC-FP-001-2 | NEG | Ineligible customer gets INSUFFICIENT_DATA with specific unmet criteria |
| TC-FP-001-3 | NEG | Unconsented data never contributes |
| TC-FP-001-4 | POS | Criteria change via configuration alters eligibility |
| TC-FP-001-5 | CON | Consent revoked mid-calculation aborts cleanly |

---

### BFR-FP-002 — Passport shows identity confidence `P1`

**Acceptance (URS):** Verification status is displayed without exposing unnecessary identity data.

**Screens** — Passport header: "Identity verified — level 2, verified March 2026"; no document numbers, no images.

**Workflow**
1. The Passport reads the customer's KYC status and tier from `identity-svc`.
2. It renders a confidence statement and the verification date.
3. No underlying identity attribute is included in the Passport or its export.

**API** — `GET /api/v1/passport` → 200 including `identity {verification_level, verified_at, verification_confidence}`.

**Data** — read-only from `customer.kyc_tier`, `kyc_status`; not copied into the Passport store beyond the summary.

**Rules**
- `BR-FP-002.1` Data minimisation: the Passport carries verification **status**, never name, date of birth, document type or number.
- `BR-FP-002.2` A recipient sees the verification level, not the evidence behind it.
- `BR-FP-002.3` If verification has expired (`ID-010`), the Passport says so rather than showing a stale "verified".
- `BR-FP-002.4` The verification date is always shown alongside the status.

**Exceptions**
- `EX-FP-002.1` Unverified customer → Passport shows "unverified" plainly; it is not suppressed or disguised.

**Events** — `passport.updated` on verification change.
**Audit** — none additional.

**Story `US-FP-002`** — As a lender, I want to see that the person's identity is verified and to what level, without receiving their identity documents, so that I get assurance without unnecessary personal data.
*Given* a verified customer, *when* I view their shared Passport, *then* I see the verification level and date, and no document details.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FP-002-1 | POS | Verification level and date displayed |
| TC-FP-002-2 | SEC | No identity attributes present in payload or export |
| TC-FP-002-3 | POS | Expired verification shown as expired |
| TC-FP-002-4 | POS | Unverified status shown plainly |

---

### BFR-FP-003 — Passport displays verified financial data sources `P1`

**Acceptance (URS):** Connected source names and coverage periods are shown.

**Screens** — Passport ▸ Data sources: institution, account type (masked identifier), coverage from–to, last sync, quality label.

**Workflow**
1. The Passport lists every source contributing to its metrics.
2. Each carries its coverage period, freshness and source-quality label.
3. Sources with no live consent are excluded entirely.

**API** — `GET /api/v1/passport/sources` → 200.

**Data** — `passport_metric_source` aggregated by source.

**Rules**
- `BR-FP-003.1` Only sources with a live consent appear (`CON-001`).
- `BR-FP-003.2` Source quality (`VERIFIED_API`, `FILE_IMPORT`, `SELF_REPORTED`) is displayed, never hidden — a recipient must be able to tell verified data from self-reported (`BIZ-010`).
- `BR-FP-003.3` Account identifiers are masked (`ADM-004`).
- `BR-FP-003.4` Coverage gaps are stated explicitly rather than smoothed over.

**Exceptions**
- `EX-FP-003.1` A source disconnected after contributing → still listed for the period it covered, marked as no longer connected.

**Events** — none
**Audit** — source list access recorded when accessed by a share recipient (`FPS-006`).

**Story `US-FP-003`** — As a lender, I want to see which institutions the figures come from and over what period, so that I can judge how much weight to place on them.
*Given* a shared Passport, *when* I view its sources, *then* each institution, its coverage period and its data quality are shown.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FP-003-1 | POS | All contributing sources listed with coverage |
| TC-FP-003-2 | POS | Source quality label displayed |
| TC-FP-003-3 | SEC | Account identifiers masked |
| TC-FP-003-4 | NEG | Unconsented source excluded |
| TC-FP-003-5 | POS | Coverage gaps disclosed |

---

### BFR-FP-004 — Income indicators `P1`

**Acceptance (URS):** Monthly inflows and consistency calculated from permitted data.

**Screens** — Passport ▸ Income: average and median monthly inflow, income stability band, volatility, number of income sources, remittance share.

**Workflow**
1. Qualifying inflows are selected: credits, excluding internal transfers and identified non-income (`CAT-004`).
2. Monthly aggregates are computed over complete months in the configured window.
3. Stability and volatility are derived from the monthly series using the documented methodology.
4. Each metric is stored with period, version, confidence, completeness and source count (URS §6).

**API** — `GET /api/v1/passport/metrics?group=INCOME` → 200.

**Data** — `passport_metric` with `metric_type ∈ {AVG_MONTHLY_INFLOW, MEDIAN_MONTHLY_INFLOW, INCOME_STABILITY, INCOME_VOLATILITY, INCOME_SOURCE_COUNT, REMITTANCE_SHARE}` (URS §7)

**Rules**
- `BR-FP-004.1` Only complete months are used; a partial month is excluded and the exclusion is stated.
- `BR-FP-004.2` Internal transfers between the customer's own accounts are excluded before aggregation (`CAT-004`).
- `BR-FP-004.3` All arithmetic is in minor units; no float (`LED-005`).
- `BR-FP-004.4` Band thresholds are configuration (`Q-16` placeholder) and the band is never displayed without its numeric basis.
- `BR-FP-004.5` Where sources overlap (the same salary seen at two institutions), deduplication runs before aggregation and is disclosed.

**Exceptions**
- `EX-FP-004.1` Fewer complete months than the configured minimum → metric status `INSUFFICIENT_DATA`, not a computed value from thin data.

**Events** — `passport.updated`
**Audit** — none additional; calculation is reproducible from stored inputs.

**Story `US-FP-004`** — As a customer, I want my Passport to show what I actually earn each month and how steady it is, so that a lender can assess me on real income rather than on a payslip I do not have.
*Given* six complete months of connected data, *when* my Passport calculates, *then* average and median monthly inflow and an income stability indicator are produced with their period and version.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FP-004-1 | POS | Income metrics computed over complete months |
| TC-FP-004-2 | NEG | Partial month excluded and disclosed |
| TC-FP-004-3 | NEG | Internal transfers excluded |
| TC-FP-004-4 | DEC | Arithmetic exact in minor units |
| TC-FP-004-5 | NEG | Below-minimum history yields INSUFFICIENT_DATA |
| TC-FP-004-6 | POS | Recalculation with the same inputs reproduces the same value |

---

### BFR-FP-005 — Cashflow indicators `P1`

**Acceptance (URS):** Net cashflow shown for configurable historical periods.

**Screens** — Passport ▸ Cashflow: net monthly cashflow, positive-cashflow month ratio, average monthly expenditure, recurring essential expenditure, with a period selector.

**Workflow**
1. Inflows and outflows are aggregated per complete month.
2. Net cashflow, the ratio of positive months and expenditure measures are computed.
3. Periods are configurable (e.g. 3, 6, 12 months) and every figure states its period.

**API** — `GET /api/v1/passport/metrics?group=CASHFLOW&period_months=6` → 200.

**Data** — `metric_type ∈ {NET_MONTHLY_CASHFLOW, POSITIVE_CASHFLOW_MONTH_RATIO, AVG_MONTHLY_EXPENDITURE, RECURRING_ESSENTIAL_EXPENDITURE}` (URS §7)

**Rules**
- `BR-FP-005.1` Net cashflow is inflow minus outflow over the same complete months — never mixed periods.
- `BR-FP-005.2` Only periods fully covered by connected data are offered; a 12-month view is not offered on 4 months of data.
- `BR-FP-005.3` Transfers between own accounts are excluded from both sides.
- `BR-FP-005.4` Negative cashflow is presented factually and neutrally (`FH-006`).

**Exceptions**
- `EX-FP-005.1` Requested period exceeds coverage → the metric returns for the available period, explicitly labelled, rather than silently substituting.

**Events** — `passport.updated`
**Audit** — none additional.

**Story `US-FP-005`** — As a lender, I want to see whether this person's money in exceeds money out, month by month, so that I can judge affordability.
*Given* a Passport with six months of data, *when* I view cashflow, *then* I see net monthly cashflow and how many months were positive, for a stated period.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FP-005-1 | POS | Net cashflow computed per complete month |
| TC-FP-005-2 | POS | Period selector limited to covered periods |
| TC-FP-005-3 | NEG | Own-account transfers excluded from both sides |
| TC-FP-005-4 | POS | Requested period beyond coverage labelled honestly |
| TC-FP-005-5 | DEC | Aggregation exact in minor units |

---

### BFR-FP-006 — Savings indicators `P1`

**Acceptance (URS):** Savings frequency/rate calculated from qualifying sources.

**Screens** — Passport ▸ Savings: savings rate, savings consistency, emergency reserve estimate.

**Workflow**
1. Qualifying savings movements are identified: BuntuSave contributions, Circle contributions (with consent, `CG-008`), and identified transfers to savings accounts.
2. Savings rate is computed against income; consistency from the frequency of saving months.
3. Emergency reserve is estimated against average monthly expenditure, and labelled an estimate.

**API** — `GET /api/v1/passport/metrics?group=SAVINGS` → 200.

**Data** — `metric_type ∈ {SAVINGS_RATE, SAVINGS_CONSISTENCY, EMERGENCY_RESERVE_ESTIMATE}` (URS §7)

**Rules**
- `BR-FP-006.1` Only **confirmed** savings movements count; pending or failed transfers never do (`SAV-010`).
- `BR-FP-006.2` Circle contributions are included only with the specific consent required by `CG-008`.
- `BR-FP-006.3` The emergency reserve is explicitly an estimate, with its basis stated.
- `BR-FP-006.4` Withdrawals from savings reduce the reserve estimate — the indicator reflects net position, not cumulative deposits.

**Exceptions**
- `EX-FP-006.1` No qualifying savings activity → the metric reports zero with an explanation, rather than being hidden.

**Events** — `passport.updated`
**Audit** — none additional.

**Story `US-FP-006`** — As a customer who saves regularly, I want my saving behaviour reflected in my Passport, so that discipline that no bank has recorded still counts in my favour.
*Given* regular confirmed savings, *when* my Passport calculates, *then* savings rate and consistency are shown with their basis.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FP-006-1 | POS | Confirmed savings produce rate and consistency |
| TC-FP-006-2 | NEG | Pending or failed transfers excluded |
| TC-FP-006-3 | NEG | Circle contributions excluded without CG-008 consent |
| TC-FP-006-4 | POS | Withdrawals reduce the reserve estimate |
| TC-FP-006-5 | POS | Zero savings reported honestly, not hidden |

---

### BFR-FP-007 — Business metrics `P1`

**Acceptance (URS):** Merchant turnover and transaction frequency available when applicable.

**Screens** — Passport ▸ Business: verified digital turnover, self-reported cash turnover, total estimated turnover, transaction count, average transaction size, active trading days, sales growth and volatility, business history period.

**Workflow**
1. For customers with a merchant profile, business metrics are computed from merchant sales and business-flagged transactions.
2. Verified digital and self-reported cash turnover are computed and displayed **separately**, then optionally combined into a clearly-labelled total estimate.
3. Growth, volatility, active trading days and history period are derived from the same series.

**API** — `GET /api/v1/passport/metrics?group=BUSINESS` → 200.

**Data** — `metric_type ∈ {VERIFIED_DIGITAL_TURNOVER, SELF_REPORTED_CASH_TURNOVER, TOTAL_ESTIMATED_TURNOVER, TRANSACTION_COUNT, AVG_TRANSACTION_SIZE, ACTIVE_TRADING_DAYS, SALES_GROWTH, SALES_VOLATILITY, CUSTOMER_CONCENTRATION, SUPPLIER_PAYMENT_REGULARITY, EXPENSE_LEVEL, NET_OPERATING_CASHFLOW, SEASONALITY, BUSINESS_HISTORY_PERIOD}` (URS §7)

**Rules**
- `BR-FP-007.1` Verified and self-reported turnover are **never** merged into a single unlabelled figure (`BIZ-006`, `BIZ-010`).
- `BR-FP-007.2` `TOTAL_ESTIMATED_TURNOVER` always carries the proportion that is self-reported.
- `BR-FP-007.3` Customer concentration is computed only where counterparty data supports it; otherwise the metric is `INSUFFICIENT_DATA`, not estimated.
- `BR-FP-007.4` Business metrics appear only for customers with a merchant profile; they are absent, not zeroed, for others.

**Exceptions**
- `EX-FP-007.1` Merchant with only self-reported data → verified turnover is zero and prominently labelled, so a lender is not misled.

**Events** — `passport.updated`
**Audit** — none additional.

**Story `US-FP-007`** — As a lender assessing a small trader, I want verified digital sales separated from self-reported cash sales, so that I know exactly how much of the turnover is independently evidenced.
*Given* a merchant with both, *when* I view their Passport, *then* the two figures are shown separately and any combined total states the self-reported proportion.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FP-007-1 | POS | Verified and self-reported turnover shown separately |
| TC-FP-007-2 | NEG | The two are never merged into one unlabelled figure |
| TC-FP-007-3 | POS | Combined total states the self-reported proportion |
| TC-FP-007-4 | NEG | Concentration reported INSUFFICIENT_DATA when unmeasurable |
| TC-FP-007-5 | POS | Business metrics absent for non-merchants |

---

### BFR-FP-008 — Every calculated metric is explainable `P1`

**Acceptance (URS):** User can view why metric was calculated and which data sources contributed.

**Screens** — Any metric ▸ "Why?" panel: metric description, calculation period, reason codes in plain language, data sources used, calculation timestamp, algorithm version.

**Workflow**
1. Each calculation emits deterministic reason codes with parameters.
2. Reason codes render through localised templates (URS §8), producing a sentence such as: *"Your verified monthly inflows remained within a relatively narrow range in five of the previous six complete months."*
3. The panel lists contributing sources and the calculation period.

**API** — `GET /api/v1/passport/metrics/{id}/explanation` → 200 `{description_key, period, reason_codes[], sources[], calculated_at, algorithm_version}`.

**Data** — `metric_reason_code`, `passport_metric_source`

**Rules**
- `BR-FP-008.1` **No derived indicator exists without an explanation** — a metric written without reason codes is a defect.
- `BR-FP-008.2` Explanations are generated from deterministic reason codes, **not** from unrestricted generative AI, in the regulated release (URS §8).
- `BR-FP-008.3` The explanation names the data sources and the period, so the customer can identify and challenge the underlying data (`FH-009`).
- `BR-FP-008.4` Explanations are available in all supported languages and are included in exports (`FPS-009`).

**Exceptions**
- `EX-FP-008.1` Missing reason codes for a metric → the metric is not published; the failure is alerted.

**Events** — none
**Audit** — explanation access by a share recipient is logged (`FPS-006`).

**Story `US-FP-008`** — As a customer, I want to understand why a Passport metric was assigned, so that I can understand it and challenge inaccurate data.
*Given* a calculated metric, *when* I select "Why?", *then* I see the metric description, the calculation period, the reason codes, the data sources and the calculation timestamp and version.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FP-008-1 | POS | Explanation returns all six required elements |
| TC-FP-008-2 | NEG | Metric without reason codes is not published |
| TC-FP-008-3 | POS | Explanation renders in rw, en and fr |
| TC-FP-008-4 | SEC | Explanation contains no generative free text |
| TC-FP-008-5 | POS | Explanation included in the export |
| TC-FP-008-6 | AUD | Recipient access to an explanation is logged |

---

### BFR-FP-009 — Passport calculations are versioned `P1`

**Acceptance (URS):** Metric displays/references algorithm version and calculation timestamp.

**Screens** — Metric detail footer: "Calculated 14 July 2026 · methodology v2.1".

**Workflow**
1. Every calculation records `algorithm_version_id` and `calculated_at`.
2. A new methodology version produces new metric rows; prior rows are marked `SUPERSEDED` and retained.
3. Any past Passport state can be reconstructed for any date.

**API** — `GET /api/v1/passport/metrics/{id}/versions` → 200; `GET /api/v1/passport?as_of=` → 200.

**Data** — `passport_metric(algorithm_version_id, calculated_at, status)`; `algorithm_version` register

**Rules**
- `BR-FP-009.1` `algorithm_version_id` and `calculated_at` are non-null on every metric.
- `BR-FP-009.2` Recalculation writes new rows; it never updates existing ones.
- `BR-FP-009.3` A methodology change is registered, validated and approved before deployment (URS §9, `GOV-008`).
- `BR-FP-009.4` A figure shared with a recipient remains reproducible exactly as shared (`FPS-008`, `CAT-009`).

**Exceptions**
- `EX-FP-009.1` Attempt to update a metric row → `PERMISSION_DENIED`.

**Events** — `passport.updated`
**Audit** — methodology registration, approval and deployment.

**Story `US-FP-009`** — As a compliance officer, I want each Passport figure bound to a methodology version and timestamp, so that any figure can be reproduced and defended long after it was produced.
*Given* a metric calculated under v2.0, *when* v2.1 deploys, *then* the v2.0 value remains retrievable with its version and timestamp.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FP-009-1 | POS | Every metric carries version and timestamp |
| TC-FP-009-2 | POS | Recalculation creates a new row, retains the old |
| TC-FP-009-3 | SEC | Metric rows cannot be updated |
| TC-FP-009-4 | POS | Historical Passport reconstructable as-of a date |
| TC-FP-009-5 | PRM | Methodology deployment requires approval |

---

### BFR-FP-010 — Passport is not a financing guarantee `P1`

**Acceptance (URS):** Disclaimer appears in digital and exportable versions.

**Screens** — Passport header/footer disclaimer; Export cover page and every page footer; Recipient view disclaimer.

**Workflow**
1. The disclaimer is part of the Passport template, not an optional field.
2. It appears in the app, in the API response, in the recipient view and on every page of the export.
3. Its wording is versioned configuration approved by legal.

**API** — every Passport response includes `disclaimer {text_key, version}`.

**Data** — disclaimer text and version in `config_version`.

**Rules**
- `BR-FP-010.1` A Passport cannot be rendered, shared or exported without the disclaimer — it is structural, not a styling choice.
- `BR-FP-010.2` The disclaimer states that the Passport is an evidence summary, not an offer, approval, guarantee or credit score.
- `BR-FP-010.3` It is available in all supported languages, with legal approval per language.
- `BR-FP-010.4` The lending workflow separately requires an actual partner decision (`FH-007`, `CAP-002`).

**Exceptions**
- `EX-FP-010.1` Missing disclaimer configuration → Passport generation and sharing fail closed rather than rendering without it.

**Events** — none
**Audit** — disclaimer version changes audited.

**Story `US-FP-010`** — As a customer, I want it made clear that my Passport is not a promise of finance, so that I do not form a false expectation of being approved.
*Given* any Passport view or export, *when* it is displayed, *then* the disclaimer is present and legible.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FP-010-1 | POS | Disclaimer present in app, API, recipient view and export |
| TC-FP-010-2 | NEG | Passport cannot render without the disclaimer |
| TC-FP-010-3 | POS | Disclaimer available in all supported languages |
| TC-FP-010-4 | POS | Disclaimer appears on every page of a multi-page export |
| TC-FP-010-5 | AUD | Disclaimer version change audited |
