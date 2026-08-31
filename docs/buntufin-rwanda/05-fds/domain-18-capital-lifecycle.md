# BFR-FDS-18 — Domain 18: Capital Application Lifecycle (`CAF`)

**Context:** Capital Marketplace (`capital-svc`) · **Epic:** `EPIC-CAF` — The provider decides; the platform records faithfully
**Wave:** W4 · **Depends on:** `CAP`, `PRT` · **Contract-pending:** `Q-25`

---

### BFR-CAF-001 — Provider may request additional information `P2`

**Acceptance (URS):** Customer receives structured information request.

**Screens** — Application ▸ "Provider needs more information" with an itemised list and a due date.

**Workflow**
1. The provider raises an information request through the adapter or partner API.
2. The application moves to `MORE_INFORMATION_REQUIRED`.
3. The customer is notified and sees each requested item with guidance.
4. Once supplied, the application returns to `UNDER_REVIEW`.

**API** — `POST /api/partner/v1/applications/{id}/information-requests` → 201; `GET /api/v1/capital/applications/{id}/information-requests` → 200.

**Data** — `information_request(items[], requested_at, due_at, status)`

**Rules**
- `BR-CAF-001.1` Requests are structured items, not free-text demands, so the customer knows exactly what to provide.
- `BR-CAF-001.2` Free-text guidance from a provider is displayed as provider content, attributed to them, and sanitised.
- `BR-CAF-001.3` A provider cannot request data outside the scope the customer authorised — out-of-scope items are rejected at the API boundary (`FPS-002`).
- `BR-CAF-001.4` The customer is notified promptly, with the provider named.

**Exceptions**
- `EX-CAF-001.1` Out-of-scope request → rejected with `PERMISSION_DENIED` and logged as a control event.
- `EX-CAF-001.2` Request not fulfilled by its due date → the application follows the provider's stated behaviour; the platform does not decline on the provider's behalf.

**Events** — `capital.information.requested`
**Audit** — request and fulfilment audited.

**Story `US-CAF-001`** — As a customer, I want to know exactly what a lender still needs from me, so that I can respond without guessing.
*Given* an information request, *when* I open my application, *then* I see each item, why it is needed and by when.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAF-001-1 | POS | Structured request displayed to the customer |
| TC-CAF-001-2 | SEC | Out-of-scope request rejected |
| TC-CAF-001-3 | SEC | Provider free text sanitised and attributed |
| TC-CAF-001-4 | POS | Fulfilment returns the application to review |

---

### BFR-CAF-002 — Customer uploads supporting documents `P2`

**Acceptance (URS):** Uploaded evidence links to application securely.

**Screens** — Information request ▸ upload per item; Uploaded documents list with status.

**Workflow**
1. The customer uploads a document against a specific requested item.
2. The file goes to encrypted object storage via a pre-signed URL; only a reference is stored in the database.
3. The provider retrieves it through a scoped, time-limited, audited link.

**API** — `POST /api/v1/capital/applications/{id}/documents` → 201 (pre-signed upload); `GET /api/partner/v1/applications/{id}/documents/{doc_id}` → 200 (scoped, audited).

**Data** — `application_document(item_ref, object_ref, content_type, size, uploaded_at, virus_scan_status)`

**Rules**
- `BR-CAF-002.1` Documents are encrypted at rest and never served from a public URL (`NFR-002`).
- `BR-CAF-002.2` Only the provider for that application can retrieve its documents (`PRT-004`), and every retrieval is logged (`CON-009`).
- `BR-CAF-002.3` Uploads are scanned before being made available; unscanned or failed files are not released.
- `BR-CAF-002.4` File type and size limits are configuration, and limits are stated before upload.
- `BR-CAF-002.5` Documents follow the retention schedule and are disposed of independently of the application record (`BFR-STD-006`).

**Exceptions**
- `EX-CAF-002.1` Disallowed type or oversize → `VALIDATION_FAILED` stating the limits.
- `EX-CAF-002.2` Scan failure → quarantined, customer asked to re-upload, security alerted.

**Events** — `capital.document.uploaded`
**Audit** — upload and every retrieval audited.

**Story `US-CAF-002`** — As a customer, I want to upload documents securely to my application, so that only the lender I chose can see them.
*Given* an uploaded document, *when* another provider attempts to retrieve it, *then* it is not found and the attempt is recorded.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAF-002-1 | POS | Document uploads and links to the application |
| TC-CAF-002-2 | SEC | Only the owning provider can retrieve it |
| TC-CAF-002-3 | SEC | No public URL; encrypted at rest |
| TC-CAF-002-4 | NEG | Disallowed type or size refused |
| TC-CAF-002-5 | SEC | Unscanned file not released |
| TC-CAF-002-6 | AUD | Every retrieval logged |

---

### BFR-CAF-003 — Provider decision recorded `P1`

**Acceptance (URS):** Decision, provider reference and timestamp stored.

**Screens** — Application ▸ Decision with provider name, outcome, date and reference.

**Workflow**
1. The provider returns a decision through the adapter or partner API.
2. The decision, its provider reference and its timestamp are stored immutably.
3. The application state advances accordingly (`APPROVED`, `DECLINED`).

**API** — `POST /api/partner/v1/applications/{id}/decision` `{decision, provider_reference, decided_at, reason?}` → 200.

**Data** — `decision(application_id, decision, provider_reference, decided_at, reason_supplied)` append-only

**Rules**
- `BR-CAF-003.1` **Only the provider's own response sets a decision.** No platform rule, timeout or score produces one.
- `BR-CAF-003.2` The decision record is append-only; a provider changing its decision creates a new linked record, retaining the first.
- `BR-CAF-003.3` The provider reference is mandatory, so the decision can be traced back to the provider's own system.
- `BR-CAF-003.4` The customer is notified of a decision promptly, with the provider named.

**Exceptions**
- `EX-CAF-003.1` Decision without a provider reference → rejected at the API boundary.
- `EX-CAF-003.2` Decision for an application in an incompatible state → `STATE_TRANSITION_INVALID`.

**Events** — `capital.application.declined`, `capital.application.approved`
**Audit** — decision receipt with the raw provider payload reference.

**Story `US-CAF-003`** — As a regulator, I want every credit decision attributable to the licensed provider that made it, so that responsibility is unambiguous.
*Given* a decision, *when* it is recorded, *then* it carries the provider's identity, reference and timestamp, and no platform logic produced it.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAF-003-1 | POS | Provider decision recorded with reference and timestamp |
| TC-CAF-003-2 | NEG | No platform path can set a decision |
| TC-CAF-003-3 | NEG | Decision without provider reference rejected |
| TC-CAF-003-4 | SEC | Decision record append-only |
| TC-CAF-003-5 | INT | Customer notified with the provider named |

---

### BFR-CAF-004 — Decline reason shown when supplied and permitted `P1`

**Acceptance (URS):** Platform displays provider-supplied reason without invention.

**Screens** — Declined application showing the provider's reason if supplied, or an honest statement that the provider did not give one.

**Workflow**
1. If the provider supplies a reason and permits its display, it is shown attributed to them.
2. If not, the customer is told plainly that the provider did not supply a reason, and where to ask.

**API** — decline responses include `reason_supplied: true|false` and, where true, the provider's text.

**Data** — `decision.reason_supplied`, `decision.reason_text`, `decision.reason_display_permitted`

**Rules**
- `BR-CAF-004.1` **The platform never invents, paraphrases or infers a decline reason.** The absence of a reason is displayed as an absence.
- `BR-CAF-004.2` Provider reason text is displayed as provider content, attributed and sanitised.
- `BR-CAF-004.3` Where the provider does not permit display, the customer is told that a reason exists but the provider has not authorised its disclosure, and is given the route to request it.
- `BR-CAF-004.4` A decline never causes the platform to display a health or Passport figure as the explanation (`FH-007`).

**Exceptions**
- `EX-CAF-004.1` No reason supplied → honest "no reason was provided" message with the provider's contact route.

**Events** — `capital.application.declined`
**Audit** — what was displayed to the customer is recorded.

**Story `US-CAF-004`** — As a declined customer, I want the lender's own reason where they give one, and an honest statement where they do not, so that I am not given a made-up explanation.
*Given* a decline with no reason supplied, *when* I view it, *then* the platform tells me plainly that no reason was given rather than offering its own.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAF-004-1 | POS | Supplied and permitted reason displayed, attributed |
| TC-CAF-004-2 | NEG | No reason ⇒ honest absence message, never an invented one |
| TC-CAF-004-3 | NEG | Reason not permitted for display is withheld with an explanation |
| TC-CAF-004-4 | SEC | Provider text sanitised |
| TC-CAF-004-5 | NEG | Platform never substitutes a health or Passport figure as the reason |

---

### BFR-CAF-005 — Customer explicitly accepts offer `P1`

**Acceptance (URS):** Acceptance action and terms version recorded.

**Screens** — Offer ▸ full terms ▸ explicit accept action; Acceptance confirmation with the provider named.

**Workflow**
1. The customer reviews the offer and the provider's terms document.
2. They take an explicit accept action, with step-up authentication where configured.
3. Acceptance records the offer version, terms version, timestamp and authentication evidence.
4. The provider is notified of the acceptance.

**API** — `POST /api/v1/capital/offers/{id}/accept` → 200.

**Data** — `offer_acceptance(offer_id, terms_version, accepted_at, auth_evidence)`

**Rules**
- `BR-CAF-005.1` Acceptance is explicit; no offer is accepted by inaction, by default selection or by continuing.
- `BR-CAF-005.2` The exact offer and terms version accepted are recorded, so what the customer agreed to is provable.
- `BR-CAF-005.3` Expiry is re-checked at the moment of acceptance (`CAF-009`).
- `BR-CAF-005.4` Acceptance may require step-up authentication per configuration (`FRD-006`).
- `BR-CAF-005.5` Accepting one offer does not automatically withdraw others; the customer is asked what to do with the rest.

**Exceptions**
- `EX-CAF-005.1` Offer expired at acceptance → `OFFER_EXPIRED`; nothing is accepted.
- `EX-CAF-005.2` Terms changed since display → acceptance refused and re-review required.

**Events** — `capital.offer.accepted`
**Audit** — acceptance with versions and authentication evidence.

**Story `US-CAF-005`** — As a customer, I want to accept an offer deliberately, with a record of exactly what I agreed to, so that the terms cannot later be disputed.
*Given* an offer, *when* I accept it, *then* the offer and terms version I saw are recorded with my acceptance.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAF-005-1 | POS | Acceptance records offer and terms version |
| TC-CAF-005-2 | NEG | No acceptance by inaction or default |
| TC-CAF-005-3 | NEG | Expired offer cannot be accepted |
| TC-CAF-005-4 | SEC | Step-up enforced where configured |
| TC-CAF-005-5 | POS | Other offers handled by explicit choice |

---

### BFR-CAF-006 — Disbursement confirmation from authoritative source `P1`

**Acceptance (URS):** Application not shown as disbursed until partner confirms.

**Screens** — Application ▸ "Awaiting disbursement" until the provider confirms; then disbursement detail with reference and date.

**Workflow**
1. On acceptance the application moves to `DISBURSEMENT_PENDING`.
2. Only a provider confirmation moves it to `DISBURSED`.
3. Where funds arrive in a connected account, that is corroboration — not the trigger.

**API** — `POST /api/partner/v1/applications/{id}/disbursement` `{amount_minor, currency, provider_reference, disbursed_at}` → 200.

**Data** — `disbursement(amount_minor, provider_reference, disbursed_at, confirmed_by)`

**Rules**
- `BR-CAF-006.1` `DISBURSED` is set only by an authoritative provider confirmation.
- `BR-CAF-006.2` Customer report or observed inflow never sets the state; at most it raises a query.
- `BR-CAF-006.3` A disbursed amount differing from the accepted amount is recorded as-is and flagged for investigation, not silently reconciled.
- `BR-CAF-006.4` Disbursement confirmations reconcile against the ledger and partner settlement where BuntuFin is in the money flow (`REC-001`).

**Exceptions**
- `EX-CAF-006.1` No confirmation within the expected window → status shows a delay with the provider named, and operations is alerted.
- `EX-CAF-006.2` Amount mismatch → recorded and raised as an exception (`REC-003`).

**Events** — `capital.disbursement.confirmed`
**Audit** — confirmation with the provider payload reference.

**Story `US-CAF-006`** — As a customer, I want my application to show as disbursed only when the lender confirms it, so that I am never told money has been sent when it has not.
*Given* an accepted offer, *when* the provider has not confirmed, *then* the status shows awaiting disbursement.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAF-006-1 | POS | Provider confirmation sets DISBURSED |
| TC-CAF-006-2 | NEG | Customer report does not set the state |
| TC-CAF-006-3 | NEG | Observed inflow alone does not set the state |
| TC-CAF-006-4 | POS | Amount mismatch flagged, not silently reconciled |
| TC-CAF-006-5 | INT | Delay alerts operations with the provider named |

---

### BFR-CAF-007 — Repayment status imported from provider `P2`

**Acceptance (URS):** Status maps into standard finance lifecycle.

**Screens** — Application ▸ Repayment status with the provider named and the last update time.

**Workflow**
1. The provider supplies repayment status through the adapter or partner API.
2. Provider-specific states map into a standard lifecycle.
3. The customer sees the status with its source and freshness.

**API** — `POST /api/partner/v1/applications/{id}/repayment-status` → 200; `GET /api/v1/capital/applications/{id}/repayment` → 200.

**Data** — `repayment_status(state, as_of, provider_reference, raw_state)`

**Rules**
- `BR-CAF-007.1` Provider states map into a documented standard set; the raw provider state is retained.
- `BR-CAF-007.2` The platform never computes arrears, balances or schedules itself — it displays what the provider supplies.
- `BR-CAF-007.3` Repayment status always shows its `as_of` time; a stale status is labelled (`FPS-010` principle).
- `BR-CAF-007.4` An unmapped provider state is displayed as "reported by provider" with the raw value, never guessed into a standard state.

**Exceptions**
- `EX-CAF-007.1` Unmapped state → displayed with the raw value and alerted for mapping.
- `EX-CAF-007.2` No update within the expected window → labelled stale.

**Events** — `capital.repayment.updated`
**Audit** — status receipts retained.

**Story `US-CAF-007`** — As a customer, I want to see my repayment status from the lender in one place, so that I do not have to track it separately.
*Given* a provider-supplied status, *when* I view my application, *then* I see the status, its source and when it was last updated.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAF-007-1 | POS | Provider status maps into the standard lifecycle |
| TC-CAF-007-2 | POS | Raw provider state retained |
| TC-CAF-007-3 | NEG | Platform never computes arrears itself |
| TC-CAF-007-4 | POS | Stale status labelled |
| TC-CAF-007-5 | ERR | Unmapped state displayed raw and alerted |

---

### BFR-CAF-008 — Repayment behaviour may feed Passport where lawful and consented `P1`

**Acceptance (URS):** Data source and consent are traceable.

**Screens** — Consent prompt: "Include my repayment record in my Passport"; Passport shows repayment history as a source when included.

**Workflow**
1. Inclusion requires a specific consent, and is gated on the lawfulness determination (`Q-08`).
2. Where permitted and consented, repayment behaviour contributes to Passport metrics with full provenance.
3. Consent revocation removes future contribution.

**API** — consent of type `REPAYMENT_TO_PASSPORT`; Passport sources then include the provider.

**Data** — `passport_metric_source` with `data_source = LENDING_PARTNER` and a consent reference.

**Rules**
- `BR-CAF-008.1` Inclusion is gated on both consent **and** the lawfulness determination; the feature ships disabled pending `Q-08`.
- `BR-CAF-008.2` Every contributing record carries its source, consent and retrieval time (URS §6).
- `BR-CAF-008.3` Negative repayment information is subject to the same accuracy and dispute rights as any other data (`FH-009`).
- `BR-CAF-008.4` Revocation stops future contribution and marks affected metrics for recalculation.

**Exceptions**
- `EX-CAF-008.1` Consent absent → excluded, with the Passport stating that repayment history is not included.

**Events** — `passport.updated`
**Audit** — consent and inclusion recorded.

**Story `US-CAF-008`** — As a customer who repays reliably, I want that record to count towards my Passport if I choose, so that good behaviour improves my future access.
*Given* the specific consent and the lawfulness determination, *when* my Passport recalculates, *then* my repayment record contributes and is named as a source.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAF-008-1 | POS | With consent and permission, repayment data contributes |
| TC-CAF-008-2 | NEG | Without consent it does not |
| TC-CAF-008-3 | NEG | Feature disabled while the lawfulness question is open |
| TC-CAF-008-4 | POS | Source and consent traceable per record |
| TC-CAF-008-5 | POS | Dispute rights apply to negative information |

---

### BFR-CAF-009 — Provider offer expiry enforced `P1`

**Acceptance (URS):** Expired offer cannot be accepted without reissue.

**Screens** — Offer card with a countdown; Expired offer clearly marked with a "request a new offer" action.

**Workflow**
1. Every offer carries `offer_expires_at` from the provider.
2. Expiry is re-checked at the moment of acceptance.
3. An expired offer can only be replaced by a new offer from the provider.

**API** — acceptance returns `OFFER_EXPIRED` after expiry; `POST /api/v1/capital/applications/{id}/request-new-offer` → 202.

**Data** — `offer.offer_expires_at`, `offer.status`

**Rules**
- `BR-CAF-009.1` Expiry is enforced at acceptance time, not only by a sweep job.
- `BR-CAF-009.2` The platform never extends a provider's offer.
- `BR-CAF-009.3` An expired offer's terms remain viewable for the record but cannot be acted on.
- `BR-CAF-009.4` The customer is warned before expiry where the window permits.

**Exceptions**
- `EX-CAF-009.1` Acceptance in the same instant as expiry → resolved by the server clock, deterministically, in the customer's favour only if the provider's contract allows; otherwise refused.

**Events** — `capital.offer.expired`
**Audit** — expiry-time refusals recorded.

**Story `US-CAF-009`** — As a lender, I want my offer expiry respected, so that a customer cannot accept terms I priced weeks ago.
*Given* an expired offer, *when* the customer attempts to accept, *then* it is refused and a new offer must be issued.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAF-009-1 | NEG | Expired offer cannot be accepted |
| TC-CAF-009-2 | CON | Acceptance racing expiry resolves deterministically |
| TC-CAF-009-3 | NEG | Platform cannot extend an offer |
| TC-CAF-009-4 | POS | Expired terms remain viewable but not actionable |
| TC-CAF-009-5 | POS | Pre-expiry warning issued |

---

### BFR-CAF-010 — Financing disputes link to provider and application `P2`

**Acceptance (URS):** Complaint contains partner and application reference.

**Screens** — Application ▸ Raise an issue; Complaint detail showing provider and application references and who is handling it.

**Workflow**
1. The customer raises a complaint from within the application.
2. The complaint carries the provider and application references automatically.
3. Routing depends on subject: platform issues to BuntuFin, provider issues to the provider with BuntuFin tracking the referral.

**API** — `POST /api/v1/complaints` `{application_id, partner_id, category}` → 201.

**Data** — `complaint.partner_id`, `complaint.application_ref`

**Rules**
- `BR-CAF-010.1` References are attached automatically, so the customer never has to quote them.
- `BR-CAF-010.2` The customer is always told who is handling the complaint and how to escalate.
- `BR-CAF-010.3` A referral to a provider does not close BuntuFin's record; BuntuFin tracks it to outcome (`CMP-009`).
- `BR-CAF-010.4` Complaint volumes by provider are reportable (`RPT-009`) and feed partner performance review.

**Exceptions**
- `EX-CAF-010.1` Provider unresponsive on a referred complaint → escalated within BuntuFin and reflected in partner monitoring (`PRT-006`).

**Events** — `complaint.created`
**Audit** — complaint lifecycle including referral and outcome.

**Story `US-CAF-010`** — As a customer with a problem about a loan, I want to raise it from within the application, so that whoever handles it has the full context immediately.
*Given* an application, *when* I raise an issue, *then* the complaint carries the provider and application references and tells me who is handling it.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CAF-010-1 | POS | Complaint carries provider and application references |
| TC-CAF-010-2 | POS | Customer told who is handling it |
| TC-CAF-010-3 | POS | Referral tracked to outcome, not closed on referral |
| TC-CAF-010-4 | POS | Volumes reportable by provider |
