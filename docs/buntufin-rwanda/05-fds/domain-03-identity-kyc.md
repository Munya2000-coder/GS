# BFR-FDS-03 — Domain 03: BuntuID / Identity and KYC (`ID`)

**Context:** Identity & Access (`identity-svc`) · **Epic:** `EPIC-ID` — Verified financial identity for the underserved
**Wave:** W1 Foundation · **Blocked values:** `Q-03` (permitted documents), `Q-04` (tier limits), `Q-19` (IVP contract)

---

### BFR-ID-001 — Registration with a verified mobile number `P1`

**Acceptance (URS):** OTP verification completes before account activation.

**Screens** — Enter mobile number; Enter OTP (resend, countdown); Number verified.

**Workflow**
1. Customer enters MSISDN; the platform normalises to E.164 and checks eligibility.
2. An OTP is generated, hashed, stored with a TTL and sent via `SMSProviderAdapter`.
3. Customer submits the code; on match within TTL and attempt limit, `msisdn_verified_at` is set.
4. Only then may the customer proceed to identity capture and, ultimately, activation.

**API**
- `POST /api/v1/registration/otp` `{msisdn}` → 202 (no disclosure of existing registration)
- `POST /api/v1/registration/otp/verify` `{msisdn, code}` → 200 `{registration_token}`

**Data** — `otp_challenge(msisdn_hash, code_hash, expires_at, attempts, consumed_at)`, `customer.msisdn_verified_at`

**Rules**
- `BR-ID-001.1` No account reaches `ACTIVE` without a verified MSISDN.
- `BR-ID-001.2` OTP codes are hashed at rest, single-use, TTL-bounded and never logged or returned in any response.
- `BR-ID-001.3` OTP request and verification are rate-limited per MSISDN and per source (`FRD-002`).
- `BR-ID-001.4` OTP length, TTL, resend interval and attempt ceiling are configuration (`GOV-001`).
- `BR-ID-001.5` Responses never reveal whether an MSISDN is already registered (URS §21).

**Exceptions**
- `EX-ID-001.1` Wrong code → `VALIDATION_FAILED`, attempt counted; ceiling reached → challenge invalidated.
- `EX-ID-001.2` Expired code → `VALIDATION_FAILED` prompting resend.
- `EX-ID-001.3` Rate limit → `RATE_LIMITED`.
- `EX-ID-001.4` SMS provider failure → `PROVIDER_UNAVAILABLE`; challenge not consumed; retry permitted.

**Events** — `customer.created` on successful registration.
**Audit** — verification success/failure, without the code.

**Story `US-ID-001`** — As a new customer, I want to register with my mobile number and confirm it by code, so that only someone holding my SIM can open an account in my name.
*Given* an unverified number, *when* I submit the correct code within its validity, *then* my number is verified; *when* the code is wrong or expired, *then* it is refused and counted.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ID-001-1 | POS | Correct OTP verifies the number |
| TC-ID-001-2 | NEG | Expired code refused |
| TC-ID-001-3 | NEG | Attempt ceiling invalidates the challenge |
| TC-ID-001-4 | SEC | Code never appears in responses or logs |
| TC-ID-001-5 | SEC | Response does not disclose existing registration |
| TC-ID-001-6 | NEG | Activation impossible without verification |
| TC-ID-001-7 | INT | Provider failure leaves the challenge reusable |

---

### BFR-ID-002 — Optional email `P2`

**Acceptance (URS):** Customer can onboard without email where permitted.

**Screens** — Profile with clearly optional email field, labelled with what it unlocks.

**Workflow**
1. Onboarding does not require email.
2. Products whose configuration marks email mandatory prompt for it at the point of use, explaining why.

**API** — `PATCH /api/v1/customers/me` `{email}`; `POST /api/v1/customers/me/email/verify`

**Data** — `customer.email` nullable, `email_verified_at`

**Rules**
- `BR-ID-002.1` Email is nullable at the data layer — the requirement is enforced by schema, not only by UI.
- `BR-ID-002.2` A product may declare `requires_email` in its configuration; enforcement happens at that product's entry point, not at onboarding.
- `BR-ID-002.3` Where email is absent, email-channel notifications are skipped without error (`NOT-003`).

**Exceptions**
- `EX-ID-002.1` Email-requiring product without an email on file → `VALIDATION_FAILED` with a prompt to add one.

**Events** — none
**Audit** — email addition and change audited (a contact-point change is security-relevant, `NOT-005`).

**Story `US-ID-002`** — As a customer without email, I want to onboard using only my phone number, so that lacking an email address does not exclude me.
*Given* no email, *when* I complete onboarding, *then* my account is fully usable for products that do not require one.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ID-002-1 | POS | Onboarding completes with no email |
| TC-ID-002-2 | POS | Email-requiring product prompts at point of use |
| TC-ID-002-3 | INT | Email notifications skipped cleanly when absent |
| TC-ID-002-4 | AUD | Email change audited and notified |

---

### BFR-ID-003 — Capture legal identity information `P1`

**Acceptance (URS):** Required fields include legal name, DOB and permitted identity document.

**Screens** — Identity capture (name, DOB, document type/number, document images); Review and submit.

**Workflow**
1. The permitted document types for the customer's segment are fetched from configuration (pending `Q-03`).
2. Customer enters legal name and DOB and selects a document type.
3. Document number and images are captured, validated for format and quality, and stored encrypted.
4. The submission proceeds to verification (`ID-004`).

**API**
- `GET /api/v1/kyc/requirements?segment=` → 200 permitted document types and required fields
- `POST /api/v1/kyc/identity` → 201
- `POST /api/v1/kyc/identity/{id}/documents` → 201 (pre-signed upload to object store)

**Data** — `customer.legal_name`, `customer.date_of_birth` (both encrypted), `identity_document`

**Rules**
- `BR-ID-003.1` Permitted document types are configuration; the code contains no list of acceptable documents.
- `BR-ID-003.2` Document number is stored encrypted and additionally as a keyed hash for duplicate detection (`ID-008`), never as plaintext in an index.
- `BR-ID-003.3` Images are stored in the object store, encrypted, with access via short-lived pre-signed URLs only.
- `BR-ID-003.4` Only the minimum fields required for the requested tier are collected (data minimisation).
- `BR-ID-003.5` Identity data is masked by default in every admin view (`ADM-004`).

**Exceptions**
- `EX-ID-003.1` Unsupported document type → `VALIDATION_FAILED` listing permitted types.
- `EX-ID-003.2` Image quality below threshold → `VALIDATION_FAILED` with guidance, retry permitted.
- `EX-ID-003.3` Impossible DOB (future, or below configured minimum age) → `VALIDATION_FAILED`.

**Events** — `kyc.identity.submitted`
**Audit** — submission and any subsequent amendment audited.

**Story `US-ID-003`** — As a customer, I want to submit my legal identity details and an accepted document, so that I can be verified for the services I want to use.
*Given* the permitted document list, *when* I submit a valid document with my name and date of birth, *then* my identity submission is accepted for verification.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ID-003-1 | POS | Valid identity submission accepted |
| TC-ID-003-2 | NEG | Unsupported document type rejected |
| TC-ID-003-3 | SEC | Document number encrypted; not readable in the database or logs |
| TC-ID-003-4 | SEC | Document images only reachable by short-lived pre-signed URL |
| TC-ID-003-5 | PRM | Lower-privilege staff see masked identity data |
| TC-ID-003-6 | NEG | Impossible date of birth rejected |

---

### BFR-ID-004 — Configurable identity-verification providers `P1`

**Acceptance (URS):** Provider adapter can be replaced without changing core onboarding workflow.

**Screens** — Verification in progress; Admin ▸ Providers ▸ IVP configuration and health.

**Workflow**
1. The onboarding workflow calls `IdentityVerificationAdapter` — it never names a provider.
2. Provider selection is configuration by country and check type.
3. The adapter returns a normalised `IdentityVerificationOutcome`; provenance is stored (`ID-009`).

**API** — internal `POST /internal/kyc/verify`; `GET /api/admin/v1/providers/identity` → 200 configured providers and health.

**Data** — `identity_evidence(provider_id, provider_reference, outcome, raw_response_ref)`

**Rules**
- `BR-ID-004.1` No provider-specific type, field name or error code appears in `identity-svc` domain code.
- `BR-ID-004.2` Switching providers is a configuration change plus an adapter deployment; the workflow, screens and data model are untouched.
- `BR-ID-004.3` A provider timeout resolves to `MANUAL_REVIEW`, never to a pass or a silent fail.
- `BR-ID-004.4` A `Simulated` adapter exists and is used in every non-production environment until `Q-19` is answered.

**Exceptions**
- `EX-ID-004.1` Provider unavailable → queue for retry; if the retry budget is exhausted, route to `MANUAL_REVIEW` and inform the customer of the delay.
- `EX-ID-004.2` Malformed provider response → `PERMANENT_ERROR`, `MANUAL_REVIEW`, alert to operations.

**Events** — `kyc.verification.requested`, `kyc.verification.completed`
**Audit** — provider, request/response references, latency, outcome.

**Story `US-ID-004`** — As a platform owner, I want identity verification behind an adapter, so that we can change or add providers without rewriting onboarding.
*Given* a second configured provider, *when* the first is disabled, *then* verification continues through the second with no change to the customer journey.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ID-004-1 | POS | Verification succeeds through the configured provider |
| TC-ID-004-2 | INT | Switching provider by configuration requires no workflow change |
| TC-ID-004-3 | ERR | Provider timeout routes to MANUAL_REVIEW, never auto-pass |
| TC-ID-004-4 | INT | Malformed response handled and alerted |
| TC-ID-004-5 | SEC | Provider credentials resolved from the vault, never from config or code |

---

### BFR-ID-005 — Automated and manual verification review `P1`

**Acceptance (URS):** Failed automated result can enter MANUAL_REVIEW.

**Screens** — Admin ▸ KYC queue (filter, SLA age); Case detail with evidence and side-by-side comparison; Decision panel with mandatory reason.

**Workflow**
1. Automated verification returns pass, fail or refer.
2. Pass assigns the tier; fail and refer create a `MANUAL_REVIEW` case.
3. A KYC reviewer examines evidence and records `MANUAL_PASS` or `MANUAL_FAIL` with a reason.
4. The customer is notified of the outcome and of any next step.

**API**
- `GET /api/admin/v1/kyc/cases?status=MANUAL_REVIEW` → 200
- `POST /api/admin/v1/kyc/cases/{id}/decision` `{decision, reason}` → 200

**Data** — `kyc_case(decision, decided_by, decided_at)`, `identity_evidence`

**Rules**
- `BR-ID-005.1` A manual decision always records the deciding human and a reason; the system never records a manual decision anonymously.
- `BR-ID-005.2` A reviewer cannot decide a case relating to their own customer record.
- `BR-ID-005.3` Manual override of an automated fail requires the reviewer role plus, where configured, a second approver (`ADM-009`).
- `BR-ID-005.4` Automated and manual outcomes are both retained — a manual pass never erases the automated fail.

**Exceptions**
- `EX-ID-005.1` Decision without reason → `VALIDATION_FAILED`.
- `EX-ID-005.2` Self-review attempt → `PERMISSION_DENIED`, audited.

**Events** — `kyc.case.created`, `customer.verified`
**Audit** — decision, reviewer, reason, evidence viewed.

**Story `US-ID-005`** — As a KYC reviewer, I want failed automated checks to reach me for manual review, so that a customer with a genuine but hard-to-read document is not permanently excluded.
*Given* an automated fail, *when* I review the evidence and pass the customer with a reason, *then* both the automated fail and my decision are retained.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ID-005-1 | POS | Automated fail creates a manual review case |
| TC-ID-005-2 | POS | Manual pass assigns the tier and retains the automated result |
| TC-ID-005-3 | NEG | Decision without reason rejected |
| TC-ID-005-4 | PRM | Self-review refused |
| TC-ID-005-5 | AUD | Reviewer, reason and evidence access audited |

---

### BFR-ID-006 — Configurable KYC tiers `P1`

**Acceptance (URS):** Tier rules can be configured without code changes.

**Screens** — Admin ▸ KYC tiers (requirements and limits per tier); Customer app ▸ "What you can do at your level" and upgrade path.

**Workflow**
1. Tier definitions declare required evidence and the resulting capability and limit set.
2. On verification, the customer is assigned the highest tier whose evidence requirements they satisfy.
3. The customer can see what additional evidence would raise their tier, and start that journey.

**API**
- `GET /api/v1/kyc/tiers` → 200 tiers, requirements and limits
- `GET /api/v1/customers/me/tier` → 200 current tier and upgrade requirements
- `POST /api/admin/v1/kyc/tiers` → 201 (regulated change, `GOV-008`)

**Data** — tier definitions in `config_version`; `customer.kyc_tier`

**Rules**
- `BR-ID-006.1` Tier rules and their limits are configuration only (`GOV-001`, `GOV-006`); no tier logic is coded.
- `BR-ID-006.2` A tier change is effective-dated and never retroactively re-decides past transactions (`GOV-007`).
- `BR-ID-006.3` Tier values remain `PLACEHOLDER` until `Q-04` is answered; the release gate blocks production while they are.
- `BR-ID-006.4` Downgrades (e.g. on document expiry, `ID-010`) follow the same configured mechanism as upgrades.

**Exceptions**
- `EX-ID-006.1` No tier satisfied → customer remains at the base tier with its restricted capability set, and is told what is missing.

**Events** — `customer.tier.changed`
**Audit** — tier definition changes and per-customer tier assignments.

**Story `US-ID-006`** — As a compliance officer, I want KYC tiers configured rather than coded, so that a change in requirements does not need a software release.
*Given* a tier definition change, *when* it is approved and takes effect, *then* new assessments use it and past assessments remain as they were.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ID-006-1 | POS | New tier rule applied without a deployment |
| TC-ID-006-2 | POS | Customer assigned the highest satisfied tier |
| TC-ID-006-3 | NEG | Tier change does not retroactively alter past transactions |
| TC-ID-006-4 | PRM | Tier definition change requires approval |
| TC-ID-006-5 | ERR | Placeholder tier values fail the pre-production gate |

---

### BFR-ID-007 — Transaction privileges depend on KYC status `P1`

**Acceptance (URS):** Unverified customer cannot perform restricted transactions.

**Screens** — Restricted actions are shown with an explanation and a "verify to unlock" path, not hidden without reason.

**Workflow**
1. Every money-moving endpoint resolves the customer's tier and status before authorising.
2. The action's required tier comes from product configuration.
3. If insufficient, the request is refused with a specific, actionable error.

**API** — enforced on all of `/api/v1/payments`, `/transfers`, `/savings`, `/circles/*/contributions`, `/capital/*`.

**Data** — `customer.kyc_tier`, `customer.kyc_status`, product `required_tier`

**Rules**
- `BR-ID-007.1` Enforcement is server-side on every path; the UI hint is not the control.
- `BR-ID-007.2` `kyc_status ∈ {UNVERIFIED, EXPIRED, REJECTED}` blocks restricted actions regardless of the tier previously held.
- `BR-ID-007.3` The error names the required tier and the route to obtain it — a refusal must be actionable.
- `BR-ID-007.4` Tier is read at request time; it is never trusted from a token claim.

**Exceptions**
- `EX-ID-007.1` Insufficient tier → `KYC_TIER_INSUFFICIENT` with required tier and upgrade link.
- `EX-ID-007.2` Expired KYC → `KYC_TIER_INSUFFICIENT` with re-verification path (`ID-010`).

**Events** — none additional; refusals are audited.
**Audit** — every refusal recorded with customer, action and required tier.

**Story `US-ID-007`** — As a compliance officer, I want transaction privileges tied to verification status, so that an unverified customer cannot perform restricted transactions.
*Given* an unverified customer, *when* they attempt a restricted transaction, *then* it is refused server-side with a clear route to verification.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ID-007-1 | NEG | Unverified customer refused on every restricted endpoint |
| TC-ID-007-2 | POS | Verified customer at the required tier succeeds |
| TC-ID-007-3 | SEC | Forged tier claim in a token is ignored |
| TC-ID-007-4 | NEG | Expired KYC blocks restricted actions |
| TC-ID-007-5 | API | Error names the required tier and upgrade path |

---

### BFR-ID-008 — Duplicate identity detection `P1`

**Acceptance (URS):** Potential duplicate creates review case rather than second unrestricted identity.

**Screens** — Admin ▸ Duplicate review queue; Side-by-side comparison; Link/Reject decision.

**Workflow**
1. On identity submission, the platform matches against existing records on document hash, name+DOB similarity and MSISDN history.
2. A match above the configured threshold creates a `DUPLICATE_REVIEW` case and holds the new identity at a restricted tier.
3. A reviewer links the records or confirms them as distinct, with a reason.

**API**
- internal `POST /internal/kyc/duplicate-check`
- `GET /api/admin/v1/kyc/duplicates` → 200; `POST /api/admin/v1/kyc/duplicates/{id}/decision` → 200

**Data** — `kyc_case.duplicate_of_customer_id`, `identity_document.document_number_hash`

**Rules**
- `BR-ID-008.1` A potential duplicate is **never** silently allowed to become a second unrestricted identity.
- `BR-ID-008.2` Matching uses keyed hashes, so duplicate detection never requires plaintext document numbers in an index.
- `BR-ID-008.3` Match thresholds are configuration.
- `BR-ID-008.4` The customer is not told the details of the matched record — only that verification requires review.

**Exceptions**
- `EX-ID-008.1` Exact document match on an active customer → new identity held, case created, no second unrestricted identity exists at any point.

**Events** — `kyc.duplicate.detected`
**Audit** — detection, decision and reason.

**Story `US-ID-008`** — As a compliance officer, I want potential duplicate identities held for review, so that one person cannot hold two unrestricted identities and evade limits.
*Given* a submission matching an existing customer, *when* it is processed, *then* a review case is created and the new identity remains restricted until decided.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ID-008-1 | POS | Matching document creates a review case |
| TC-ID-008-2 | NEG | No second unrestricted identity exists during review |
| TC-ID-008-3 | SEC | Matching works without plaintext document numbers |
| TC-ID-008-4 | SEC | Customer is not told whose record matched |
| TC-ID-008-5 | AUD | Decision and reason audited |

---

### BFR-ID-009 — Identity evidence retains verification provenance `P1`

**Acceptance (URS):** Provider, timestamp, outcome and reference are stored.

**Screens** — Admin ▸ KYC case ▸ Evidence trail (provider, check type, outcome, timestamp, reference).

**Workflow**
1. Every verification call writes an `identity_evidence` row before its result is acted upon.
2. The row records provider, check type, provider reference, outcome, timestamp and a pointer to the stored raw response.
3. Evidence is retained per the retention schedule, separately from the decision record.

**API** — `GET /api/admin/v1/kyc/cases/{id}/evidence` → 200 (masked per role)

**Data** — `identity_evidence` (append-only)

**Rules**
- `BR-ID-009.1` Evidence is written even when the outcome is a failure or an error — a missing evidence row is itself a defect.
- `BR-ID-009.2` Evidence rows are append-only.
- `BR-ID-009.3` Raw provider responses are stored encrypted and are accessible only to authorised roles, with each access audited.
- `BR-ID-009.4` Evidence outlives the check but is subject to the retention schedule (`BFR-STD-006`).

**Exceptions**
- `EX-ID-009.1` Evidence write failure → the verification result is not applied; the case routes to `MANUAL_REVIEW`.

**Events** — `kyc.evidence.recorded`
**Audit** — every access to raw evidence.

**Story `US-ID-009`** — As an auditor, I want each verification's provider, time, outcome and reference retained, so that a past KYC decision can be reconstructed and defended.
*Given* a verified customer, *when* I inspect their KYC case, *then* I can see every check performed, by whom, when, and with what result.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ID-009-1 | POS | Evidence recorded for a successful check |
| TC-ID-009-2 | POS | Evidence recorded for failures and errors too |
| TC-ID-009-3 | SEC | Evidence rows cannot be modified |
| TC-ID-009-4 | PRM | Raw response access restricted and audited |
| TC-ID-009-5 | ERR | Evidence write failure prevents applying the result |

---

### BFR-ID-010 — Expired identity information triggers review `P1`

**Acceptance (URS):** Customer is notified and configured restrictions apply where required.

**Screens** — Customer banner "Your ID expires in N days — update it"; Re-verification journey; Admin ▸ Expiry queue.

**Workflow**
1. A scheduled job scans `identity_document.expiry_date` against configured notice windows.
2. Advance notices are sent; at expiry, `kyc_status = EXPIRED` and configured restrictions apply.
3. The customer re-verifies; on success the tier and capabilities are restored.

**API**
- `GET /api/v1/customers/me/kyc/status` → 200 including `expires_at` and any restriction
- `POST /api/v1/kyc/reverify` → 201

**Data** — `identity_document.expiry_date`, `customer.kyc_status`, `customer_status_history`

**Rules**
- `BR-ID-010.1` Notice windows, restriction severity and the grace period are all configuration.
- `BR-ID-010.2` Expiry restricts, it does not close: inbound and read access continue unless configured otherwise, so a customer is never locked out of their own record.
- `BR-ID-010.3` Expiry notifications are service messages and are not suppressible by marketing preferences (`NOT-005`, `NOT-006`).
- `BR-ID-010.4` Restoration on successful re-verification is automatic, with no support ticket required.

**Exceptions**
- `EX-ID-010.1` Restricted action after expiry → `KYC_TIER_INSUFFICIENT` explaining the expiry and the re-verification route.

**Events** — `kyc.document.expiring`, `kyc.document.expired`, `customer.restricted`
**Audit** — expiry-driven status changes recorded with the system as actor and the rule as reason.

**Story `US-ID-010`** — As a customer, I want warning before my ID expires and a clear way to update it, so that my account is not restricted without notice.
*Given* an ID expiring soon, *when* the notice window is reached, *then* I am notified; *when* it expires, *then* configured restrictions apply and re-verification restores my access.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-ID-010-1 | POS | Advance notice sent within the configured window |
| TC-ID-010-2 | POS | Expiry applies the configured restriction |
| TC-ID-010-3 | POS | Re-verification restores tier automatically |
| TC-ID-010-4 | NEG | Expiry notice cannot be suppressed by marketing opt-out |
| TC-ID-010-5 | AUD | Automatic status change audited with rule reference |
