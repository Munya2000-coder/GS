# BFR-FDS-17 — Domain 17: BuntuCapital Marketplace (`CAP`)

**Context:** Capital Marketplace (`capital-svc`) · **Epic:** `EPIC-CAP` — A marketplace that is honest about who lends and why offers are ordered
**Wave:** W4 · **Depends on:** `FPS`, `PRT`, `CON` · **Blocking:** `Q-08` (CRB obligations), `Q-09` · **Contract-pending:** `Q-25`
**State machine:** `BFR-STD-001` §4

---

### BFR-CAP-001 — Eligible customers explore financing offers `P1`

**Acceptance (URS):** User can initiate funding-request workflow.

**Screens** — Capital ▸ What do you need? (amount, purpose, term); Eligibility summary; Provider selection.

**Workflow**
1. Customer opens the capital journey; eligibility is evaluated against configured criteria.
2. A funding request is created in `DRAFT`.
3. The customer completes amount, purpose and provider selection, then submits.

**API** — `GET /api/v1/capital/eligibility` → 200; `POST /api/v1/capital/requests` → 201.

**Data** — `funding_request(amount_minor, currency, purpose_code, term_preference, status)`

**Rules**
- `BR-CAP-001.1` Eligibility criteria are configuration, and an ineligible customer is told specifically what is missing.
- `BR-CAP-001.2` A funding request is not an application; nothing is sent to any provider until the customer selects and submits (`CAP-006`).
- `BR-CAP-001.3` The journey shows the disclaimer that exploring does not imply approval (`FP-010`).
- `BR-CAP-001.4` The whole capital feature is behind a flag, currently disabled pending `Q-08`/`Q-09`.

**Exceptions**
- `EX-CAP-001.1` Ineligible customer → `422` with specific unmet criteria and how to progress.
- `EX-CAP-001.2` Feature disabled → `FEATURE_DISABLED` with a neutral message.

**Events** — `capital.request.created`
**Audit** — request creation audited.

**Story `US-CAP-001`** — As a small business owner, I want to explore financing options, so that I can find capital without visiting several institutions.
*Given* I meet the criteria, *when* I start a funding request, *then* it is created as a draft and nothing is sent to any provider yet.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAP-001-1 | POS | Eligible customer creates a draft request |
| TC-CAP-001-2 | NEG | Ineligible customer told specifically what is missing |
| TC-CAP-001-3 | NEG | Draft sends nothing to any provider |
| TC-CAP-001-4 | PRM | Feature flag disables the journey cleanly |

---

### BFR-CAP-002 — BuntuFin does not represent itself as lender `P1`

**Acceptance (URS):** Provider name displayed for every financing product.

**Screens** — Every financing surface names the provider; BuntuFin's role is described as introducing/facilitating, per the configured legal position.

**Workflow**
1. Every financing product declares its legal provider (`GOV-002`).
2. Offers, applications, decisions and disbursements all display the provider.
3. Platform copy describes BuntuFin's role per its configured, legally approved wording.

**API** — every capital response includes `provider {partner_id, legal_name, regulatory_reference}`.

**Data** — `product_version.legal_provider_partner_id`, `application.partner_id`

**Rules**
- `BR-CAP-002.1` No financing surface renders without a named provider — enforced by the component contract.
- `BR-CAP-002.2` BuntuFin's role description is versioned, legally approved configuration, not developer-written copy (`Q-01`).
- `BR-CAP-002.3` Where BuntuFin is legally the provider for a product, that is an explicit configured statement, never a default.
- `BR-CAP-002.4` Communications about an application name the provider as the decision-maker (`CAF-003`).

**Exceptions**
- `EX-CAP-002.1` Product without a provider → not offered; the omission is alerted as a configuration defect.

**Events** — none
**Audit** — role-description version changes audited.

**Story `US-CAP-002`** — As a customer, I want to know which institution is actually lending to me, so that I know who I owe and who is accountable.
*Given* any financing product or offer, *when* I view it, *then* the lending institution is named.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAP-002-1 | POS | Provider named on every financing surface |
| TC-CAP-002-2 | NEG | Product without a provider is not offered |
| TC-CAP-002-3 | SEC | Provider cannot be overridden by a client parameter |
| TC-CAP-002-4 | POS | Role description drawn from approved configuration |

---

### BFR-CAP-003 — Customer specifies requested amount `P1`

**Acceptance (URS):** Valid amount captured against configurable boundaries.

**Screens** — Amount entry with the permitted range shown and inline validation.

**Workflow**
1. The permitted range is resolved from configuration for the customer's segment and the product.
2. The customer enters an amount; it is validated client-side for convenience and server-side for control.

**API** — `PATCH /api/v1/capital/requests/{id}` `{amount_minor}` → 200.

**Data** — `funding_request.amount_minor`, `currency`

**Rules**
- `BR-CAP-003.1` Boundaries are configuration; the amount is validated server-side.
- `BR-CAP-003.2` The amount is in minor units with an explicit currency (`LED-005`).
- `BR-CAP-003.3` A provider may offer a different amount; the requested amount is retained alongside the offered amount (`CAP-007`).
- `BR-CAP-003.4` The permitted range is displayed before entry, so refusal is never a surprise.

**Exceptions**
- `EX-CAP-003.1` Amount outside the range → `VALIDATION_FAILED` stating the permitted range.

**Events** — none
**Audit** — requested amount recorded on the request.

**Story `US-CAP-003`** — As a customer, I want to say how much I need within a stated range, so that my request reflects my actual need.
*Given* the permitted range, *when* I enter an amount outside it, *then* I am told the range rather than simply refused.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAP-003-1 | POS | Valid amount captured |
| TC-CAP-003-2 | NEG | Out-of-range amount refused with the range stated |
| TC-CAP-003-3 | SEC | Client-side validation is not the control |
| TC-CAP-003-4 | POS | Requested amount retained alongside any offered amount |

---

### BFR-CAP-004 — Customer specifies funding purpose `P1`

**Acceptance (URS):** Selected purpose stored with application.

**Screens** — Purpose selection from a controlled list with an optional free-text detail.

**Workflow**
1. The customer selects a purpose from the configured purpose catalogue.
2. The purpose is stored with the request and included in the provider submission.

**API** — `PATCH /api/v1/capital/requests/{id}` `{purpose_code, purpose_detail}` → 200.

**Data** — `funding_request.purpose_code`, `purpose_detail`

**Rules**
- `BR-CAP-004.1` Purpose comes from a controlled catalogue; free text is supplementary detail, never the purpose itself.
- `BR-CAP-004.2` Free-text detail is treated as untrusted input: sanitised and length-limited.
- `BR-CAP-004.3` Purpose is included in the provider submission, since it materially affects assessment.
- `BR-CAP-004.4` Purpose codes may be constrained by product and by any applicable corridor or regulatory rule.

**Exceptions**
- `EX-CAP-004.1` Unknown purpose code → `VALIDATION_FAILED`.

**Events** — none
**Audit** — purpose stored with the request.

**Story `US-CAP-004`** — As a customer, I want to state what the money is for, so that lenders assess my request in context.
*Given* a purpose selection, *when* I submit, *then* it is stored and included in what the provider receives.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAP-004-1 | POS | Purpose stored with the request |
| TC-CAP-004-2 | NEG | Unknown purpose code refused |
| TC-CAP-004-3 | SEC | Free-text detail sanitised |
| TC-CAP-004-4 | POS | Purpose included in the provider submission |

---

### BFR-CAP-005 — Prequalification may use consented financial data `P1`

**Acceptance (URS):** Inputs can be traced to authorised sources.

**Screens** — "What we will use" panel listing the exact data and its sources before prequalification runs.

**Workflow**
1. Prequalification runs only on data covered by a live consent.
2. Every input records its source and consent reference.
3. The result is an **indication**, clearly labelled, never a decision (`FH-007`).

**API** — `POST /api/v1/capital/requests/{id}/prequalify` → 200 `{indication, inputs_used[], disclaimer}`.

**Data** — prequalification inputs recorded with source and consent references.

**Rules**
- `BR-CAP-005.1` Every input is traceable to an authorised source and a consent (`CON-001`, `FH-008`).
- `BR-CAP-005.2` The result is labelled an indication and carries the disclaimer (`FP-010`).
- `BR-CAP-005.3` Prequalification never sends data to a provider — it is a local indication only. Submission is a separate, explicit act (`CAP-006`).
- `BR-CAP-005.4` A prequalification result never becomes an approval or a decline (`FH-007`).

**Exceptions**
- `EX-CAP-005.1` Consent missing for a required input → prequalification declines to run and says which permission is needed.

**Events** — none
**Audit** — prequalification runs recorded with their inputs.

**Story `US-CAP-005`** — As a customer, I want an indication of what I might qualify for before I apply, so that I do not make applications that waste my time.
*Given* consented data, *when* I prequalify, *then* I see an indication labelled as such, and nothing is sent to any lender.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAP-005-1 | POS | Prequalification runs on consented data only |
| TC-CAP-005-2 | NEG | Missing consent halts prequalification with a clear message |
| TC-CAP-005-3 | SEC | No provider transmission occurs during prequalification |
| TC-CAP-005-4 | POS | Inputs traceable to sources and consents |
| TC-CAP-005-5 | POS | Result labelled an indication with disclaimer |

---

### BFR-CAP-006 — Customer selects partners allowed to receive information `P1`

**Acceptance (URS):** No partner submission occurs without selected authorised flow.

**Screens** — Provider selection with each provider's identity, what they will receive and typical decision time; explicit "Send to selected providers" action.

**Workflow**
1. The customer selects one or more providers.
2. A share/consent is created per provider (`FPS-001`, `CON-001`).
3. Only then is an `application` created per selected provider and submitted.

**API** — `POST /api/v1/capital/requests/{id}/submit` `{partner_ids[], scopes[]}` → 202.

**Data** — `application(partner_id)` one per provider; `passport_share` per provider.

**Rules**
- `BR-CAP-006.1` No data reaches a provider without an explicit per-provider selection and consent.
- `BR-CAP-006.2` One application per provider, each with its own lifecycle, share and audit trail.
- `BR-CAP-006.3` The customer sees exactly what each provider will receive before confirming.
- `BR-CAP-006.4` Deselecting a provider before submission leaves no trace with that provider.
- `BR-CAP-006.5` Broadcast-to-all is never a default; the customer chooses each recipient.

**Exceptions**
- `EX-CAP-006.1` Submission without a selection → `VALIDATION_FAILED`.
- `EX-CAP-006.2` Selected provider suspended at submission → excluded, and the customer is told (`PRT-003`).

**Events** — `capital.application.submitted`, `passport.shared`
**Audit** — selection, consent and submission per provider.

**Story `US-CAP-006`** — As a customer, I want to choose exactly which lenders see my information, so that applying does not broadcast my finances across the market.
*Given* three available providers, *when* I select one and submit, *then* only that provider receives anything.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAP-006-1 | POS | Only selected providers receive data |
| TC-CAP-006-2 | NEG | Submission without selection refused |
| TC-CAP-006-3 | SEC | Unselected provider has no record of the customer |
| TC-CAP-006-4 | POS | One application per provider with its own lifecycle |
| TC-CAP-006-5 | AUD | Per-provider consent and submission audited |

---

### BFR-CAP-007 — Providers return structured financing offers `P1`

**Acceptance (URS):** Amount, duration, fees and repayment information can be compared.

**Screens** — Offers comparison table with normalised columns; Offer detail with the provider's own terms document.

**Workflow**
1. Providers return offers through `LendingPartnerAdapter`.
2. The adapter maps them into the normalised `FinancingOffer` shape (`BFR-STD-003` §3).
3. Offers display side by side; fields the provider did not supply are shown as "not provided", never estimated.

**API** — `GET /api/v1/capital/requests/{id}/offers` → 200.

**Data** — `offer` with normalised fields and `provider_offer_reference`.

**Rules**
- `BR-CAP-007.1` BuntuFin never computes, estimates or infers a missing offer field (`CAF-004` principle).
- `BR-CAP-007.2` Comparison is like-for-like where data permits; where it does not, the gap is displayed rather than filled.
- `BR-CAP-007.3` Every offer carries an expiry (`CAF-009`).
- `BR-CAP-007.4` Offer terms are stored as received, so what the customer saw is provable.

**Exceptions**
- `EX-CAP-007.1` Malformed provider offer → not displayed; the provider is alerted and operations notified. A partial or garbled offer is never shown to a customer.
- `EX-CAP-007.2` No offers received → the customer is told clearly, with the application status per provider.

**Events** — `capital.offer.received`
**Audit** — offers stored as received, with receipt timestamps.

**Story `US-CAP-007`** — As a customer, I want to compare offers side by side, so that I can choose on real terms rather than on marketing.
*Given* offers from two providers, *when* I compare them, *then* amount, duration, total cost and fees are shown in the same form, with any missing field marked as not provided.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAP-007-1 | POS | Offers normalised and comparable |
| TC-CAP-007-2 | NEG | Missing fields shown as not provided, never estimated |
| TC-CAP-007-3 | NEG | Malformed offer not displayed |
| TC-CAP-007-4 | POS | Offer terms stored exactly as received |
| TC-CAP-007-5 | INT | Two different provider formats normalise identically |

---

### BFR-CAP-008 — Offers identify provider `P1`

**Acceptance (URS):** Customer sees legal provider before selection.

**Screens** — Every offer card leads with the provider's legal name and regulatory reference.

**Workflow**
1. Each offer displays its provider prominently, before terms.
2. Acceptance confirmation restates the provider.

**API** — every offer payload includes `provider {partner_id, legal_name, regulatory_reference}`.

**Data** — `offer.partner_id` NOT NULL

**Rules**
- `BR-CAP-008.1` An offer without an identified provider cannot be stored or displayed.
- `BR-CAP-008.2` The provider is shown before terms, not after.
- `BR-CAP-008.3` The acceptance screen restates the provider, so the customer confirms who they are contracting with (`CAF-005`).
- `BR-CAP-008.4` White-labelling that obscures the legal provider is not permitted.

**Exceptions**
- `EX-CAP-008.1` Provider identification missing from an adapter response → offer rejected at ingestion.

**Events** — none
**Audit** — none additional.

**Story `US-CAP-008`** — As a customer, I want each offer to name the institution making it, so that I know who I would be borrowing from before I choose.
*Given* an offer, *when* I view it, *then* the provider is named before the terms.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAP-008-1 | POS | Provider displayed on every offer |
| TC-CAP-008-2 | NEG | Offer without a provider rejected at ingestion |
| TC-CAP-008-3 | POS | Acceptance screen restates the provider |
| TC-CAP-008-4 | SEC | Provider cannot be masked by presentation configuration |

---

### BFR-CAP-009 — Commission does not invisibly determine ranking `P1`

**Acceptance (URS):** Ranking methodology can be explained and configured fairly.

**Screens** — Offers list with a visible "How are these ordered?" link explaining the criteria; sort control the customer can change.

**Workflow**
1. Offers are ordered by the configured ranking policy.
2. The policy's criteria are displayed to the customer on request.
3. The customer may re-sort by their own preference.

**API** — `GET /api/v1/capital/requests/{id}/offers?sort=` → 200 including `ranking {policy_version, criteria[]}`.

**Data** — ranking policy in versioned configuration; `route`-style decision record retained per offer list.

**Rules**
- `BR-CAP-009.1` **Commission is not an input to the ranking function.** This is enforced by the ranking policy schema, which does not accept a commercial term, and by a test asserting the absence.
- `BR-CAP-009.2` The ranking criteria are displayed in plain language to any customer who asks.
- `BR-CAP-009.3` The policy is versioned and its changes are approved (`GOV-008`).
- `BR-CAP-009.4` The customer can override the order.
- `BR-CAP-009.5` The ranking applied is recorded with the offer list, so a past ordering can be explained.

**Exceptions**
- `EX-CAP-009.1` Attempt to configure a commercial term as a ranking input → rejected by schema validation and alerted.

**Events** — none
**Audit** — ranking policy changes audited; the applied policy version stored with each offer list.

**Story `US-CAP-009`** — As a customer, I want to know why offers are ordered as they are, so that I can trust the marketplace is not steering me to whoever pays BuntuFin most.
*Given* a list of offers, *when* I ask how they are ordered, *then* I see the criteria, and commission is not among them.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAP-009-1 | SEC | Ranking policy schema rejects commercial terms |
| TC-CAP-009-2 | POS | Ranking criteria displayed on request |
| TC-CAP-009-3 | POS | Customer can re-sort |
| TC-CAP-009-4 | POS | Applied policy version stored with the offer list |
| TC-CAP-009-5 | AUD | Policy changes approved and audited |

---

### BFR-CAP-010 — Application status trackable `P1`

**Acceptance (URS):** Customer sees submitted/reviewing/approved/declined/etc.

**Screens** — Applications list with status per provider; Application detail with a plain-language timeline and next expected step.

**Workflow**
1. Each application follows the Financing Application state machine (`BFR-STD-001` §4).
2. Status changes come from the provider, or from platform-side events such as offer expiry.
3. The customer sees each application separately, since providers move at different speeds.

**API** — `GET /api/v1/capital/applications` → 200; `GET .../applications/{id}` → 200 with `history[]`.

**Data** — `application.state`, `application_status_history`

**Rules**
- `BR-CAP-010.1` Status is derived from the state machine only, and displayed in plain language.
- `BR-CAP-010.2` Each provider's application has its own independent status.
- `BR-CAP-010.3` The customer is told what is expected next and, where the provider supplies it, by when.
- `BR-CAP-010.4` No status is inferred: if a provider has not responded, the status says awaiting the provider (`CAF-003`).

**Exceptions**
- `EX-CAP-010.1` Provider unresponsive beyond the configured window → status shows a delay with the provider named, and operations is alerted; the platform never invents a decline.

**Events** — every state transition publishes its event.
**Audit** — transitions recorded with their source.

**Story `US-CAP-010`** — As a customer, I want to see where each application stands, so that I am not left wondering whether anything is happening.
*Given* applications with two providers, *when* I check them, *then* I see each one's status separately and what happens next.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAP-010-1 | POS | Every state visible in plain language |
| TC-CAP-010-2 | POS | Per-provider statuses independent |
| TC-CAP-010-3 | NEG | Unresponsive provider never produces an invented decline |
| TC-CAP-010-4 | SEC | Status history append-only |
| TC-CAP-010-5 | PRM | Only the applicant sees the application |
