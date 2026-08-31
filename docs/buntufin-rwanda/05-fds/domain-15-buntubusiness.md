# BFR-FDS-15 — Domain 15: BuntuBusiness (`BIZ`)

**Context:** Business (`business-svc`) · **Epic:** `EPIC-BIZ` — Make an informal business visible without pretending self-reported data is verified
**Wave:** W3 · **Depends on:** `USR`, `PAY`, `LED` · **Feeds:** `FP-007`, `CAP`

---

### BFR-BIZ-001 — Create business profile `P1`

**Acceptance (URS):** Business owner can create profile with required business details.

**Screens** — New business ▸ name, activity type, location, classification; Business dashboard.

**Workflow**
1. A verified individual creates a business profile.
2. Required fields depend on the business classification (`BIZ-002`).
3. On creation a merchant identifier is issued (`BIZ-003`).

**API** — `POST /api/v1/businesses` → 201; `GET /api/v1/businesses/{id}` → 200.

**Data** — `business_customer`, `merchant`

**Rules**
- `BR-BIZ-001.1` Only a verified individual may create a business (`ID-007`).
- `BR-BIZ-001.2` Required fields come from the classification's configuration, not from a fixed form.
- `BR-BIZ-001.3` Business data is never merged with the owner's personal position (`USR-002`).
- `BR-BIZ-001.4` One individual may own several businesses; each has its own merchant identity and records.

**Exceptions**
- `EX-BIZ-001.1` Unverified individual → `KYC_TIER_INSUFFICIENT`.
- `EX-BIZ-001.2` Missing classification-required field → `VALIDATION_FAILED` naming the field.

**Events** — `merchant.created`
**Audit** — creation and profile changes audited.

**Story `US-BIZ-001`** — As a small trader, I want to create a business profile, so that my trading activity is recorded separately from my personal money.
*Given* a verified identity, *when* I create a business, *then* it exists with its own identity and its own records.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-BIZ-001-1 | POS | Business created with classification-required details |
| TC-BIZ-001-2 | NEG | Unverified individual refused |
| TC-BIZ-001-3 | POS | Business and personal positions remain separate |
| TC-BIZ-001-4 | POS | Multiple businesses per owner supported |

---

### BFR-BIZ-002 — Informal businesses supported `P1`

**Acceptance (URS):** Registration number can be optional based on business classification.

**Screens** — Classification selector (registered / informal / cooperative) with the field set adapting; no dead-end for an unregistered trader.

**Workflow**
1. The customer selects a business classification.
2. The required and optional field set is resolved from configuration for that classification.
3. An informal business proceeds without a registration number, with the capabilities its classification permits.

**API** — `GET /api/v1/business-classifications` → 200 with required fields; `POST /api/v1/businesses` accordingly.

**Data** — `business_customer.classification`, `registration_number` nullable

**Rules**
- `BR-BIZ-002.1` `registration_number` is nullable at the data layer — the requirement is enforced by schema, not only by UI.
- `BR-BIZ-002.2` Which classifications are permitted, and what each unlocks, is configuration (pending confirmation with `Q-01`/`Q-04`).
- `BR-BIZ-002.3` Informal status is recorded factually and never displayed as a deficiency to the customer.
- `BR-BIZ-002.4` Where a capability genuinely requires registration, the customer is told which, and how to progress.

**Exceptions**
- `EX-BIZ-002.1` Capability requiring registration attempted by an informal business → refused with a clear explanation and route.

**Events** — `merchant.created`
**Audit** — classification changes audited.

**Story `US-BIZ-002`** — As an unregistered trader, I want to use business features without a registration number, so that being informal does not exclude me from financial services.
*Given* the informal classification, *when* I create my business, *then* it is created without a registration number.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-BIZ-002-1 | POS | Informal business created without registration number |
| TC-BIZ-002-2 | POS | Field requirements vary by classification via configuration |
| TC-BIZ-002-3 | NEG | Registration-requiring capability refused with an explanation |
| TC-BIZ-002-4 | POS | Registered business still requires its number |

---

### BFR-BIZ-003 — Merchant identifier issued `P1`

**Acceptance (URS):** Unique merchant reference generated.

**Screens** — Business dashboard showing the merchant reference; used on QR, receipts and settlement.

**Workflow**
1. On business creation a unique merchant reference is generated.
2. It appears on QR codes, receipts, settlement records and reconciliation.

**API** — merchant responses include `merchant_reference`.

**Data** — `merchant.merchant_reference` UNIQUE

**Rules**
- `BR-BIZ-003.1` The reference is unique, stable for the life of the merchant, and never reused.
- `BR-BIZ-003.2` It is not sequential or guessable in a way that would reveal merchant volumes.
- `BR-BIZ-003.3` It is the join key used by reconciliation for merchant settlement (`REC-001`).
- `BR-BIZ-003.4` It survives business profile changes, including a name change.

**Exceptions**
- `EX-BIZ-003.1` Generation collision → retried transparently; a duplicate reference can never be persisted (unique constraint).

**Events** — `merchant.created`
**Audit** — issuance recorded.

**Story `US-BIZ-003`** — As a merchant, I want a permanent reference for my business, so that my payments and settlements can always be attributed to me.
*Given* my business, *when* it is created, *then* it receives a unique reference used consistently everywhere.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-BIZ-003-1 | POS | Unique reference generated |
| TC-BIZ-003-2 | SEC | Reference not sequential or volume-revealing |
| TC-BIZ-003-3 | CON | Concurrent creation produces no duplicates |
| TC-BIZ-003-4 | POS | Reference stable across profile changes |

---

### BFR-BIZ-004 — Static QR `P1`

**Acceptance (URS):** QR resolves merchant correctly.

**Screens** — Business ▸ My QR (display, print, download); Customer scan resolves to the merchant.

**Workflow**
1. The merchant generates a static QR encoding a stable merchant token.
2. A customer scans; the platform resolves it server-side to the merchant (`PAY-004`).
3. The customer enters the amount and pays.

**API** — `POST /api/v1/merchants/{id}/qr/static` → 201; resolution via `POST /api/v1/qr/resolve`.

**Data** — `merchant_qr(type = STATIC, token_hash, status)`

**Rules**
- `BR-BIZ-004.1` The QR encodes a token, never the merchant's raw identifiers or account details.
- `BR-BIZ-004.2` A static QR can be revoked and regenerated (for example if a printed code is misused).
- `BR-BIZ-004.3` Resolution is server-side; the customer app never trusts an embedded name (`PAY-004`).
- `BR-BIZ-004.4` A suspended merchant's QR stops resolving.

**Exceptions**
- `EX-BIZ-004.1` Revoked QR scanned → `VALIDATION_FAILED` with a neutral message.
- `EX-BIZ-004.2` Suspended merchant → refused without disclosing why (`PRT-003` principle applied to merchants).

**Events** — `merchant.qr.created`
**Audit** — QR creation and revocation audited.

**Story `US-BIZ-004`** — As a merchant, I want a printable code customers can scan, so that I can accept digital payment without a terminal.
*Given* my static QR, *when* a customer scans it, *then* my business is resolved and shown to them before they pay.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-BIZ-004-1 | POS | Static QR resolves to the correct merchant |
| TC-BIZ-004-2 | SEC | QR encodes a token, not raw identifiers |
| TC-BIZ-004-3 | POS | Revocation stops resolution |
| TC-BIZ-004-4 | NEG | Suspended merchant's QR does not resolve |

---

### BFR-BIZ-005 — Dynamic QR `P1`

**Acceptance (URS):** QR contains/links amount and reference.

**Screens** — Business ▸ Charge (enter amount and reference) ▸ QR displayed with a countdown; Payment received confirmation.

**Workflow**
1. The merchant enters an amount and optional reference.
2. A single-use, expiring dynamic QR token is created.
3. The customer scans; the amount and reference are shown for confirmation; on payment the token is consumed.

**API** — `POST /api/v1/merchants/{id}/qr/dynamic` `{amount_minor, reference}` → 201 with `expires_at`.

**Data** — `merchant_qr(type = DYNAMIC, amount_minor, reference, expires_at, consumed_at)`

**Rules**
- `BR-BIZ-005.1` Dynamic QR tokens are single-use and expire; a used token cannot be paid again.
- `BR-BIZ-005.2` The amount is resolved server-side from the token, never read from the QR by the client.
- `BR-BIZ-005.3` The merchant sees the payment confirmed only on authoritative settlement (`PAY-008`).
- `BR-BIZ-005.4` An expired unpaid token is closed and can be reissued.

**Exceptions**
- `EX-BIZ-005.1` Expired token scanned → `VALIDATION_FAILED`; the merchant reissues.
- `EX-BIZ-005.2` Concurrent scans of one token → exactly one payment proceeds (`CON` test).

**Events** — `merchant.payment.received`
**Audit** — token issuance and consumption recorded.

**Story `US-BIZ-005`** — As a merchant, I want a code for a specific amount, so that the customer cannot pay the wrong amount by mistake.
*Given* a dynamic QR for 5,000, *when* the customer scans it, *then* the amount is fixed and shown before they confirm.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-BIZ-005-1 | POS | Dynamic QR carries amount and reference |
| TC-BIZ-005-2 | NEG | Used token cannot be paid again |
| TC-BIZ-005-3 | CON | Concurrent scans yield exactly one payment |
| TC-BIZ-005-4 | SEC | Amount resolved server-side, not read from the code |
| TC-BIZ-005-5 | POS | Expiry closes the token; reissue works |

---

### BFR-BIZ-006 — Record manual cash sales `P1`

**Acceptance (URS):** Cash sale stored as merchant-entered, not verified digital receipt.

**Screens** — Business ▸ Record cash sale (amount, date, optional note); Sales list clearly separating verified and self-reported entries.

**Workflow**
1. The merchant records a cash sale.
2. It is stored with `evidence_type = SELF_REPORTED`.
3. It appears in turnover only in the self-reported column and is labelled everywhere it is shown.

**API** — `POST /api/v1/merchants/{id}/sales` `{amount_minor, occurred_at, evidence_type: SELF_REPORTED}` → 201.

**Data** — `merchant_sale.evidence_type` NOT NULL

**Rules**
- `BR-BIZ-006.1` A self-reported sale **never** posts to the ledger as received money — no digital funds moved (`LED-001`).
- `BR-BIZ-006.2` `evidence_type` is mandatory and immutable on the sale record; a merchant cannot relabel a cash sale as verified.
- `BR-BIZ-006.3` Self-reported sales are visually distinguished in every view, including the Passport (`BIZ-010`, `FP-007`).
- `BR-BIZ-006.4` Back-dating is limited to a configured window, and back-dated entries are marked.
- `BR-BIZ-006.5` Unusual self-reporting patterns are a monitoring signal (`AML-003`).

**Exceptions**
- `EX-BIZ-006.1` Back-dating beyond the configured window → `VALIDATION_FAILED`.
- `EX-BIZ-006.2` Attempt to set `evidence_type = VERIFIED_DIGITAL` manually → `PERMISSION_DENIED`; only the payment path can create verified records.

**Events** — `merchant.sale.recorded`
**Audit** — cash sale entries audited with actor (owner or delegate).

**Story `US-BIZ-006`** — As a merchant whose customers pay cash, I want to record those sales, so that my real turnover is visible — while everyone can still see which part is independently verified.
*Given* a recorded cash sale, *when* it appears in my turnover, *then* it is shown as self-reported, never as a verified digital receipt.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-BIZ-006-1 | POS | Cash sale recorded as self-reported |
| TC-BIZ-006-2 | SEC | Merchant cannot mark it verified |
| TC-BIZ-006-3 | NEG | No ledger posting for a self-reported sale |
| TC-BIZ-006-4 | NEG | Back-dating beyond the window refused |
| TC-BIZ-006-5 | POS | Label persists into the Passport |

---

### BFR-BIZ-007 — Record business expenses `P2`

**Acceptance (URS):** Expense stores amount, category, date and evidence if provided.

**Screens** — Business ▸ Add expense (amount, category, date, supplier, optional photo); Expenses list.

**Workflow**
1. The merchant records an expense with its category and date.
2. Optional evidence (a photo of a receipt) is stored in the object store.
3. Expenses feed the net cashflow estimate (`BIZ-009`).

**API** — `POST /api/v1/merchants/{id}/expenses` → 201; evidence via pre-signed upload.

**Data** — `merchant_expense(amount_minor, category_id, occurred_at, supplier_id, evidence_ref, evidence_type)`

**Rules**
- `BR-BIZ-007.1` Expenses are self-reported unless derived from a real outbound payment, and are labelled accordingly.
- `BR-BIZ-007.2` Evidence images are stored encrypted with access by short-lived pre-signed URL only.
- `BR-BIZ-007.3` Expense categories come from configuration (`CAT-002`).
- `BR-BIZ-007.4` Expenses linked to a supplier support supplier-payment regularity metrics (`INV-008`, `FP-007`).

**Exceptions**
- `EX-BIZ-007.1` Evidence upload failure → the expense is still recorded, marked as lacking evidence.

**Events** — `merchant.expense.recorded`
**Audit** — expense entries and evidence access audited.

**Story `US-BIZ-007`** — As a merchant, I want to record what I spend on the business, so that my profit, not just my sales, becomes visible.
*Given* an expense with a photo, *when* I save it, *then* the amount, category, date and evidence are stored.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-BIZ-007-1 | POS | Expense recorded with all fields |
| TC-BIZ-007-2 | SEC | Evidence encrypted, pre-signed access only |
| TC-BIZ-007-3 | POS | Self-reported vs payment-derived labelled |
| TC-BIZ-007-4 | ERR | Evidence upload failure still records the expense |

---

### BFR-BIZ-008 — Dashboard displays turnover `P1`

**Acceptance (URS):** Totals derive from selected periods and identified evidence types.

**Screens** — Business dashboard ▸ turnover for a selected period, split by evidence type, with a total clearly composed of both.

**Workflow**
1. The merchant selects a period.
2. Verified digital and self-reported turnover are computed separately.
3. A combined total is shown with the self-reported proportion stated.

**API** — `GET /api/v1/merchants/{id}/turnover?from=&to=` → 200 `{verified_minor, self_reported_minor, total_minor, self_reported_pct}`.

**Data** — aggregation over `merchant_sale` and confirmed merchant receipts.

**Rules**
- `BR-BIZ-008.1` The two evidence types are always shown separately; a single unlabelled turnover figure is never displayed (`BIZ-006`).
- `BR-BIZ-008.2` Only confirmed digital receipts count as verified (`PAY-008`).
- `BR-BIZ-008.3` Refunds and reversals reduce turnover for the period in which they occurred.
- `BR-BIZ-008.4` The calculation basis is stated on the screen, so the merchant can reconcile it themselves.

**Exceptions**
- `EX-BIZ-008.1` Period with no activity → zero shown explicitly, not a blank.

**Events** — none
**Audit** — none additional.

**Story `US-BIZ-008`** — As a merchant, I want to see my turnover for a period, split into verified and self-reported, so that I know my real trading position and what a lender will treat as evidenced.
*Given* digital and cash sales, *when* I view turnover, *then* both are shown separately and the total states how much is self-reported.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-BIZ-008-1 | POS | Turnover split by evidence type |
| TC-BIZ-008-2 | NEG | No single unlabelled total displayed |
| TC-BIZ-008-3 | POS | Refunds reduce the correct period |
| TC-BIZ-008-4 | DEC | Aggregation exact in minor units |
| TC-BIZ-008-5 | PRM | Only the merchant and delegates can view |

---

### BFR-BIZ-009 — Dashboard displays net cashflow estimate `P2`

**Acceptance (URS):** Calculation methodology documented and reproducible.

**Screens** — Dashboard ▸ net cashflow estimate with a "how this is calculated" link.

**Workflow**
1. Net cashflow = qualifying receipts − qualifying expenses for the period.
2. The methodology and its version are documented and shown.
3. The estimate is labelled an estimate, with its self-reported proportion stated.

**API** — `GET /api/v1/merchants/{id}/cashflow?from=&to=` → 200 including `methodology_version`.

**Data** — derived; `algorithm_version` recorded on the result.

**Rules**
- `BR-BIZ-009.1` The methodology is documented, versioned and reproducible from stored inputs.
- `BR-BIZ-009.2` The estimate always states how much of its input is self-reported.
- `BR-BIZ-009.3` It is labelled an estimate, never presented as accounting profit.
- `BR-BIZ-009.4` The same definition is used by the Passport (`FP-007`) — one definition, not two.

**Exceptions**
- `EX-BIZ-009.1` Insufficient expense data → the estimate is withheld with an explanation rather than shown as equal to turnover.

**Events** — none
**Audit** — methodology version changes audited.

**Story `US-BIZ-009`** — As a merchant, I want an estimate of what I am actually keeping, so that I can judge whether my business is working.
*Given* recorded sales and expenses, *when* I view net cashflow, *then* I see an estimate with its method explained and its self-reported proportion stated.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-BIZ-009-1 | POS | Estimate computed and reproducible |
| TC-BIZ-009-2 | POS | Methodology version shown |
| TC-BIZ-009-3 | NEG | Withheld when expense data is insufficient |
| TC-BIZ-009-4 | POS | Same definition as the Passport metric |

---

### BFR-BIZ-010 — Merchant data may feed Financial Passport `P1`

**Acceptance (URS):** Passport identifies verified versus self-entered business data.

**Screens** — Passport ▸ Business section with the verified/self-reported split visible to the customer and to any recipient.

**Workflow**
1. With consent, merchant data contributes to Passport business metrics.
2. `source_quality` travels with every contributing record.
3. The Passport presents verified and self-reported figures separately (`FP-007`).

**API** — Passport business metrics carry `source_quality` breakdowns.

**Data** — `passport_metric_source.source_quality`

**Rules**
- `BR-BIZ-010.1` The verified/self-reported distinction is preserved end to end — from the sale record, through the metric, into the recipient view and the export.
- `BR-BIZ-010.2` A recipient can never receive a business turnover figure without knowing its composition.
- `BR-BIZ-010.3` Merchant data contributes only with consent (`CON-001`).
- `BR-BIZ-010.4` Self-reported data alone can support a Passport, provided its nature is stated — the design does not exclude cash-based traders, it labels their data honestly.

**Exceptions**
- `EX-BIZ-010.1` Composition cannot be determined for a record → excluded from verified figures and counted as self-reported (the conservative treatment).

**Events** — `passport.updated`
**Audit** — none additional.

**Story `US-BIZ-010`** — As a lender, I want to know how much of a trader's turnover is independently verified, so that I can lend on an honest picture rather than on a claim.
*Given* a merchant with both kinds of sales, *when* I receive their Passport, *then* verified and self-reported turnover are separately stated.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-BIZ-010-1 | POS | Split preserved into the Passport and export |
| TC-BIZ-010-2 | NEG | No business figure delivered without its composition |
| TC-BIZ-010-3 | NEG | Merchant data excluded without consent |
| TC-BIZ-010-4 | POS | Indeterminate records treated as self-reported |
