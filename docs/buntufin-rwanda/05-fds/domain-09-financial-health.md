# BFR-FDS-09 — Domain 09: Financial Health (`FH`)

**Context:** Insight (`insight-svc`) · **Epic:** `EPIC-FH` — Guidance, never a hidden credit decision
**Wave:** W2 · **Depends on:** `CAT`, `FP` · **Constraint:** URS §9 AI/ML controls

> The central risk in this domain is that a "health score" quietly becomes an
> underwriting decision. `FH-007` forbids it and the design enforces it: no
> health output is ever an input to a partner's automated approval path.

---

### BFR-FH-001 — Optional financial-health indicators `P2`

**Acceptance (URS):** Eligible customer sees calculated dimensions.

**Screens** — Financial health ▸ dimension cards (income stability, savings resilience, cashflow, commitments) with plain-language bands; Opt-in prompt.

**Workflow**
1. The customer opts in to financial-health insights.
2. Eligible dimensions are calculated from consented data with the same provenance rules as the Passport.
3. Dimensions display with their band, basis and reason factors.

**API** — `POST /api/v1/financial-health/opt-in` → 200; `GET /api/v1/financial-health` → 200.

**Data** — `health_assessment`, `health_dimension`

**Rules**
- `BR-FH-001.1` Financial health is **optional** — no dimension is calculated or displayed without opt-in.
- `BR-FH-001.2` Dimensions with insufficient data report `INSUFFICIENT_DATA` rather than a computed guess.
- `BR-FH-001.3` Health outputs are never shared with a partner unless the customer separately and explicitly shares them (`FPS-002`).
- `BR-FH-001.4` Opting out stops future calculation and removes the display; prior assessments follow the retention policy.

**Exceptions**
- `EX-FH-001.1` Access without opt-in → `422` with an opt-in prompt, no data computed.

**Events** — `health.assessment.created`
**Audit** — opt-in and opt-out recorded.

**Story `US-FH-001`** — As a customer, I want optional insight into my financial health, so that I can understand my position without being scored without asking.
*Given* I have not opted in, *when* I open the health section, *then* nothing has been calculated and I am invited to opt in.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FH-001-1 | POS | Opt-in produces dimensions |
| TC-FH-001-2 | NEG | No calculation occurs without opt-in |
| TC-FH-001-3 | NEG | Insufficient data reported honestly |
| TC-FH-001-4 | POS | Opt-out stops future calculation |
| TC-FH-001-5 | PRM | Health data not shared without explicit share scope |

---

### BFR-FH-002 — Explainable calculations `P1`

**Acceptance (URS):** Each score/dimension provides reason factors.

**Screens** — Dimension ▸ "What this is based on": reason factors, period, sources, version.

**Workflow**
1. Each dimension emits deterministic reason codes alongside its band.
2. Reason codes render through localised templates (URS §8).
3. The customer can drill through to the underlying transactions.

**API** — `GET /api/v1/financial-health/dimensions/{id}/explanation` → 200.

**Data** — `health_reason_code`, `health_dimension.algorithm_version_id`

**Rules**
- `BR-FH-002.1` No dimension exists without reason factors — same rule as `FP-008`.
- `BR-FH-002.2` Explanations are deterministic, not generative (URS §8).
- `BR-FH-002.3` The explanation identifies the data that drove the result, so the customer can challenge it (`FH-009`).
- `BR-FH-002.4` Explanations are available in all supported languages.

**Exceptions**
- `EX-FH-002.1` Dimension without reason codes → not published; alerted as a defect.

**Events** — none
**Audit** — none additional.

**Story `US-FH-002`** — As a customer, I want to know why a health dimension came out as it did, so that I can act on it or challenge it.
*Given* a savings resilience band, *when* I open its explanation, *then* I see the specific factors, the period, the sources and the methodology version.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FH-002-1 | POS | Every dimension carries reason factors |
| TC-FH-002-2 | NEG | Dimension without reason codes not published |
| TC-FH-002-3 | POS | Explanation renders in all languages |
| TC-FH-002-4 | POS | Drill-through to underlying transactions works |

---

### BFR-FH-003 — Income stability measurable `P2`

**Acceptance (URS):** Calculation uses documented, versioned methodology.

**Screens** — Health ▸ Income stability with band, trend and basis.

**Workflow**
1. Monthly income series is taken from the Passport's income metrics (`FP-004`).
2. Stability is derived using the documented, versioned methodology (variation of monthly inflow across complete months).
3. The band and its numeric basis are both shown.

**API** — `GET /api/v1/financial-health?dimension=INCOME_STABILITY` → 200.

**Data** — `health_dimension(dimension = INCOME_STABILITY, band, value, algorithm_version_id)`

**Rules**
- `BR-FH-003.1` The methodology is documented and registered before use (URS §9).
- `BR-FH-003.2` Band thresholds are configuration (`Q-16`), never coded.
- `BR-FH-003.3` The band is never shown without its numeric basis and period.
- `BR-FH-003.4` The calculation reuses Passport income metrics rather than recomputing them differently — one definition of income across the platform.

**Exceptions**
- `EX-FH-003.1` Fewer complete months than the configured minimum → `INSUFFICIENT_DATA`.

**Events** — `health.assessment.created`
**Audit** — methodology registration and deployment.

**Story `US-FH-003`** — As a customer, I want to see how steady my income is, so that I can understand a factor lenders care about.
*Given* six months of income data, *when* my stability is calculated, *then* it uses a documented, versioned methodology and shows its basis.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FH-003-1 | POS | Stability computed from the Passport income series |
| TC-FH-003-2 | POS | Band derives from configured thresholds |
| TC-FH-003-3 | NEG | Insufficient months yields INSUFFICIENT_DATA |
| TC-FH-003-4 | POS | Same income definition as the Passport |

---

### BFR-FH-004 — Savings resilience measurable `P2`

**Acceptance (URS):** Emergency reserve or savings consistency can be calculated.

**Screens** — Health ▸ Savings resilience: months of expenditure covered, saving consistency, trend.

**Workflow**
1. Confirmed savings balances and contributions are read (`FP-006`).
2. Resilience is expressed as months of average expenditure covered, plus a consistency measure.
3. The result is labelled an estimate with its basis stated.

**API** — `GET /api/v1/financial-health?dimension=SAVINGS_RESILIENCE` → 200.

**Data** — `health_dimension(dimension = SAVINGS_RESILIENCE, ...)`

**Rules**
- `BR-FH-004.1` Only confirmed savings movements count (`SAV-010`).
- `BR-FH-004.2` The reserve figure is explicitly an estimate; the label is not optional.
- `BR-FH-004.3` Where expenditure cannot be estimated reliably, resilience reports `INSUFFICIENT_DATA` rather than dividing by an unreliable denominator.
- `BR-FH-004.4` Savings held outside connected sources are absent, and the coverage limitation is disclosed.

**Exceptions**
- `EX-FH-004.1` No expenditure baseline → `INSUFFICIENT_DATA`.

**Events** — `health.assessment.created`
**Audit** — none additional.

**Story `US-FH-004`** — As a customer, I want to know how long my savings would cover me, so that I can judge my own resilience.
*Given* confirmed savings and a stable expenditure baseline, *when* resilience is calculated, *then* I see months covered, labelled as an estimate.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FH-004-1 | POS | Resilience computed from confirmed savings |
| TC-FH-004-2 | NEG | Pending savings excluded |
| TC-FH-004-3 | NEG | No expenditure baseline yields INSUFFICIENT_DATA |
| TC-FH-004-4 | POS | Coverage limitation disclosed |

---

### BFR-FH-005 — Financial commitments contribute when data available `P2`

**Acceptance (URS):** System identifies documented data source before calculation.

**Screens** — Health ▸ Commitments: recognised recurring commitments with their source, and a note about what is not visible.

**Workflow**
1. Commitments are drawn from recurring series (`CAT-007`) and imported repayment status (`CAF-007`).
2. Each commitment records its data source before contributing.
3. The dimension states explicitly that commitments outside connected sources are not visible.

**API** — `GET /api/v1/financial-health?dimension=COMMITMENTS` → 200.

**Data** — `health_dimension`, provenance rows referencing `recurring_series` or `repayment_status`

**Rules**
- `BR-FH-005.1` A commitment contributes only if its data source is documented and traceable (`FH-008`).
- `BR-FH-005.2` The platform never infers a debt that it cannot evidence.
- `BR-FH-005.3` The customer can dismiss an incorrectly identified commitment (`CAT-007`).
- `BR-FH-005.4` The absence of visibility into external credit is stated plainly — a low commitments figure is not presented as proof of low indebtedness.

**Exceptions**
- `EX-FH-005.1` No documented commitment data → the dimension is shown as not measurable, with the reason.

**Events** — `health.assessment.created`
**Audit** — none additional.

**Story `US-FH-005`** — As a customer, I want my recognised regular commitments included, and to be told what the platform cannot see, so that I am not given a false picture.
*Given* commitments visible only from connected data, *when* the dimension is shown, *then* it names its sources and states what is not visible.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FH-005-1 | POS | Documented commitments contribute |
| TC-FH-005-2 | NEG | Undocumented commitment never inferred |
| TC-FH-005-3 | POS | Visibility limitation stated |
| TC-FH-005-4 | POS | Dismissal persists |

---

### BFR-FH-006 — Non-deceptive guidance `P1`

**Acceptance (URS):** Suggestions are phrased as guidance, not guaranteed outcomes.

**Screens** — Guidance cards using conditional, non-promissory language, with no implied approval.

**Workflow**
1. Guidance is generated from deterministic rules mapped to reason codes.
2. Copy is drawn from an approved, versioned content library reviewed for non-deceptive language.
3. No guidance references or implies a financing outcome.

**API** — `GET /api/v1/financial-health/guidance` → 200 `{guidance_key, parameters, evidence[]}`.

**Data** — guidance content in versioned configuration.

**Rules**
- `BR-FH-006.1` Guidance never states or implies that an action will result in approval, a better rate or a specific outcome.
- `BR-FH-006.2` All guidance copy is from an approved library; free-text or generated advice is not permitted in the regulated release (URS §8/§9).
- `BR-FH-006.3` Guidance cites the observation it is based on, so it is checkable.
- `BR-FH-006.4` Content changes are reviewed and versioned like any other regulated content (`GOV-003`).

**Exceptions**
- `EX-FH-006.1` Guidance key missing from the approved library → no guidance displayed; a defect is raised. Nothing is improvised.

**Events** — none
**Audit** — guidance library changes audited.

**Story `US-FH-006`** — As a customer, I want honest guidance rather than promises, so that I am not misled into expecting an outcome the platform cannot deliver.
*Given* a guidance card, *when* I read it, *then* it describes what I could consider and why, without promising an approval or a rate.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FH-006-1 | POS | Guidance rendered from the approved library |
| TC-FH-006-2 | NEG | No guidance implies a guaranteed outcome (content review test) |
| TC-FH-006-3 | NEG | Missing key produces no guidance, not improvised text |
| TC-FH-006-4 | AUD | Library changes versioned and audited |

---

### BFR-FH-007 — Health indicator is not a silent underwriting decision `P1`

**Acceptance (URS):** Lending workflow requires separate partner decision.

**Screens** — Capital journey shows the provider's decision as the decision; no health band is presented as an eligibility verdict.

**Workflow**
1. Health outputs are never sent to a partner as an approval signal.
2. Any financing decision comes from the partner's own response (`CAF-003`).
3. Prequalification, where offered, is explicitly labelled as an indication and never as a decision.

**API** — capital endpoints do not accept a health band as an input to a decision; the partner submission payload contains no health score.

**Data** — no foreign key from `decision` to `health_dimension`.

**Rules**
- `BR-FH-007.1` The health score is architecturally excluded from the partner submission payload — the absence is enforced by a schema test, not by convention.
- `BR-FH-007.2` No platform code path converts a health band into an approval, a decline or an offer.
- `BR-FH-007.3` Any prequalification indication is labelled as such and carries the disclaimer (`FP-010`).
- `BR-FH-007.4` A partner requiring health data must receive it through an explicit customer share (`FPS-002`), where it is data, not a decision.

**Exceptions**
- `EX-FH-007.1` Attempt to submit health data as a decision input → rejected by schema validation and alerted.

**Events** — none
**Audit** — attempts to include health outputs in a decision path are audited as control events.

**Story `US-FH-007`** — As a regulator, I want the financial-health indicator kept out of the credit decision, so that BuntuFin does not become an unlicensed underwriter through the back door.
*Given* a financing application, *when* it is submitted, *then* the payload contains no health score and the decision comes solely from the provider.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FH-007-1 | SEC | Partner submission payload contains no health score (schema test) |
| TC-FH-007-2 | NEG | No code path converts a band into a decision |
| TC-FH-007-3 | POS | Decision recorded comes only from the provider response |
| TC-FH-007-4 | POS | Prequalification labelled as an indication, with disclaimer |

---

### BFR-FH-008 — Automated indicators retain input provenance `P1`

**Acceptance (URS):** Inputs used for each assessment are traceable.

**Screens** — Dimension ▸ Sources: which accounts, which periods, which transactions.

**Workflow**
1. Each assessment records its inputs: source references, consent references, retrieval times and transformation versions.
2. An assessment can be replayed from its recorded inputs to reproduce the same output.

**API** — `GET /api/v1/financial-health/assessments/{id}/provenance` → 200.

**Data** — provenance rows mirroring the URS §6 source structure.

**Rules**
- `BR-FH-008.1` An assessment without complete provenance is not published.
- `BR-FH-008.2` Provenance includes the consent reference for every input (`CON-001`).
- `BR-FH-008.3` Replay with the recorded inputs and version reproduces the output exactly.
- `BR-FH-008.4` Provenance is retained for the life of the assessment under the retention schedule.

**Exceptions**
- `EX-FH-008.1` Missing provenance for any input → assessment not persisted, defect raised.

**Events** — `health.assessment.created`
**Audit** — provenance access audited.

**Story `US-FH-008`** — As a compliance officer, I want every automated indicator traceable to its inputs, so that a disputed result can be examined and reproduced.
*Given* a health assessment, *when* I inspect its provenance, *then* I see every input, its consent and its retrieval time.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FH-008-1 | POS | Provenance complete for every assessment |
| TC-FH-008-2 | NEG | Assessment without provenance not persisted |
| TC-FH-008-3 | POS | Replay reproduces the output exactly |
| TC-FH-008-4 | POS | Consent reference present for every input |

---

### BFR-FH-009 — Customers challenge inaccurate underlying data `P1`

**Acceptance (URS):** Dispute/reclassification workflow exists.

**Screens** — Any metric or dimension ▸ "This looks wrong": choose reason, correct a category, or raise a data dispute; Dispute status tracker.

**Workflow**
1. The customer indicates that an underlying figure is wrong.
2. Where the fix is a categorisation, it is applied immediately as a correction (`CAT-003`) and dependent figures recalculate as new versions.
3. Where the underlying source data itself is wrong, a data dispute case is created, linked to the source and the metric, and routed to support (`CMP-001`).
4. Affected metrics are marked "under review" while the dispute is open.

**API**
- `POST /api/v1/data-disputes` `{subject_type, subject_id, reason, detail}` → 201
- `GET /api/v1/data-disputes/{id}` → 200

**Data** — `data_request`/`complaint` with `type = DATA_DISPUTE`, linked to the metric and source.

**Rules**
- `BR-FH-009.1` A dispute is always possible on any displayed derived figure — there is no un-challengeable number.
- `BR-FH-009.2` While a dispute is open, affected metrics carry an "under review" marker wherever they appear, including in shares (`FPS-010` principle).
- `BR-FH-009.3` A dispute has an SLA and an outcome (`CMP-005`, `CMP-008`).
- `BR-FH-009.4` Correcting data never edits the source record; it creates an overlay (`OF-006`, `CAT-003`).

**Exceptions**
- `EX-FH-009.1` Dispute about a partner's own record → routed to the partner with the reference retained (`CMP-004`), and the customer is told who is handling it.

**Events** — `complaint.created`, `transaction.corrected`
**Audit** — dispute lifecycle audited.

**Story `US-FH-009`** — As a customer, I want to challenge data I believe is wrong, so that an error does not permanently distort how lenders see me.
*Given* an incorrect figure, *when* I raise a dispute, *then* it is tracked with an SLA and the affected metrics are marked under review.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FH-009-1 | POS | Dispute created and tracked with an SLA |
| TC-FH-009-2 | POS | Categorisation fix applies immediately and recalculates |
| TC-FH-009-3 | POS | Affected metrics marked under review, including in shares |
| TC-FH-009-4 | NEG | Correction never edits the source record |
| TC-FH-009-5 | POS | Partner-owned data routed to the partner with reference retained |

---

### BFR-FH-010 — Configurable and versioned methodology `P1`

**Acceptance (URS):** New model version can run without erasing prior outputs.

**Screens** — Admin ▸ Health methodologies register; Customer sees methodology version on each dimension.

**Workflow**
1. Methodologies are registered with the URS §9 attributes and approved before deployment.
2. A new version calculates new assessments; prior assessments remain with their version.
3. Rollback is supported and preserves everything produced by the rolled-back version.

**API** — `GET /api/admin/v1/health-methodologies` → 200; `POST .../deploy` → 200 (approval required).

**Data** — `algorithm_version`, `health_assessment.algorithm_version_id`

**Rules**
- `BR-FH-010.1` Prior outputs are never deleted or overwritten by a new version.
- `BR-FH-010.2` Deployment requires validation evidence and approval (URS §9, `GOV-008`).
- `BR-FH-010.3` Where a methodology is withdrawn, its outputs are marked superseded, not removed.
- `BR-FH-010.4` The customer-visible version reference lets a past result be explained even after a change.

**Exceptions**
- `EX-FH-010.1` Deployment without validation evidence → refused.

**Events** — `model.deployed`
**Audit** — registration, validation, approval, deployment, rollback.

**Story `US-FH-010`** — As a compliance officer, I want methodology changes versioned and non-destructive, so that we can improve the model without erasing the basis of past results.
*Given* assessments under v1, *when* v2 deploys, *then* v1 results remain intact and identifiable.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FH-010-1 | POS | New version runs without erasing prior outputs |
| TC-FH-010-2 | NEG | Deployment without validation evidence refused |
| TC-FH-010-3 | POS | Rollback preserves all outputs |
| TC-FH-010-4 | AUD | Deployment approved and audited |
