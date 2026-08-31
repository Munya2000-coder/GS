# BFR-FDS-04 — Domain 04: Consent and Privacy (`CON`)

**Context:** Consent (`consent-svc`) · **Epic:** `EPIC-CON` — The customer decides, and it is provable
**Wave:** W1 Foundation · **Consumed by:** `OF`, `FP`, `FPS`, `FH`, `CAP`, `CAF`, `CG-008`

> Consent is on the hot path by design. Any context that cannot resolve a live
> consent **fails closed** rather than returning degraded data.

---

### BFR-CON-001 — Explicit consent for optional data sharing `P1`

**Acceptance (URS):** No optional external sharing occurs without recorded customer action.

**Screens** — Consent request (scopes, purpose, duration, recipient); Confirm; Consent receipt.

**Workflow**
1. A flow needing customer data outside the platform requests consent, naming recipient, scopes, purpose and duration.
2. The customer takes an affirmative action; the platform records the grant with evidence of how it was captured.
3. The consuming context receives a `consent_id` and may proceed only within the granted scope and window.

**API**
- `POST /api/v1/consents` `{consent_type, recipient, scopes[], purpose_code, duration}` → 201
- `GET /api/v1/consents/{id}` → 200

**Data** — `consent`, `consent_scope`, `consent.evidence_ref`

**Rules**
- `BR-CON-001.1` Consent is an affirmative action: no pre-ticked boxes, no bundling of unrelated purposes, no consent by continuing.
- `BR-CON-001.2` Every read or disclosure of customer financial data resolves a live consent; there is no code path that reads it without one.
- `BR-CON-001.3` `consent_id` is a **non-null** column on `connection`, `passport_metric_source`, `passport_share` and `disclosure_log`.
- `BR-CON-001.4` The grant records what the customer was shown: terms version, scope list, purpose text and the capture channel.

**Exceptions**
- `EX-CON-001.1` Data access without a consent reference → `CONSENT_REQUIRED`, no data returned, attempt audited.
- `EX-CON-001.2` Scope requested exceeds what was granted → `PERMISSION_DENIED`, and the excess is logged as a control event.

**Events** — `consent.created`, `consent.granted`
**Audit** — grant recorded with actor, channel and terms version.

**Story `US-CON-001`** — As a customer, I want my data shared externally only when I have actively agreed, so that nothing about my finances leaves the platform without my say-so.
*Given* a flow requiring external sharing, *when* I have not consented, *then* no data is shared and the flow tells me consent is needed.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CON-001-1 | POS | Consent grant enables the scoped access |
| TC-CON-001-2 | NEG | Access without consent refused and audited |
| TC-CON-001-3 | NEG | Access beyond granted scope refused |
| TC-CON-001-4 | SEC | No code path reads financial data without a consent reference |
| TC-CON-001-5 | AUD | Grant records terms version and capture channel |

---

### BFR-CON-002 — Consent identifies data categories `P1`

**Acceptance (URS):** Consent screen lists specific data scopes before approval.

**Screens** — Consent request listing each scope in plain language with an example of what it includes.

**Workflow**
1. The requesting flow declares required scopes from the controlled scope catalogue.
2. The screen renders each scope with a localised plain-language description.
3. Where the flow permits partial consent, the customer may exclude optional scopes.

**API** — `GET /api/v1/consent-scopes` → 200 catalogue; `POST /api/v1/consents` with explicit `scopes[]`.

**Data** — `consent_scope(data_category, included)`

**Rules**
- `BR-CON-002.1` Scopes come from a controlled catalogue; a flow cannot invent a free-text scope.
- `BR-CON-002.2` Scope descriptions are localisation keys, available in all supported languages (URS §18).
- `BR-CON-002.3` Optional scopes are visually distinguished from those required for the flow to function.
- `BR-CON-002.4` Excluding an optional scope must still leave a working flow, or the scope is not optional.

**Exceptions**
- `EX-CON-002.1` Unknown scope requested → `VALIDATION_FAILED`; the consent screen never renders.

**Events** — `consent.granted` carries the scope list.
**Audit** — granted and excluded scopes both recorded.

**Story `US-CON-002`** — As a customer, I want to see exactly which categories of my data are covered before I agree, so that I am not consenting to something vague.
*Given* a consent request, *when* I view it, *then* each data category is listed in my language with an explanation, and I can exclude optional ones.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CON-002-1 | POS | All requested scopes displayed before approval |
| TC-CON-002-2 | POS | Optional scope can be excluded and the flow still works |
| TC-CON-002-3 | NEG | Unknown scope rejected |
| TC-CON-002-4 | POS | Descriptions render in rw, en and fr |

---

### BFR-CON-003 — Consent identifies purpose `P1`

**Acceptance (URS):** Purpose is displayed and persisted with consent record.

**Screens** — Consent request with a prominent purpose statement; Consent detail showing the purpose as agreed.

**Workflow**
1. The flow supplies a `purpose_code` from the controlled purpose catalogue.
2. The purpose is displayed before approval and persisted verbatim with the grant.
3. Every subsequent use of the consent is checked against that purpose.

**API** — `POST /api/v1/consents` requires `purpose_code`; `GET /api/v1/consents/{id}` returns the purpose as agreed.

**Data** — `consent.purpose_code`, `consent.purpose_text_key`

**Rules**
- `BR-CON-003.1` Purpose is mandatory; a consent without one cannot be created.
- `BR-CON-003.2` Data used under a consent may only serve the stated purpose — purpose limitation is enforced, not merely documented.
- `BR-CON-003.3` A new purpose requires a new consent; an existing grant is never silently reinterpreted.
- `BR-CON-003.4` The purpose text shown at grant time is retained even if the catalogue wording later changes (`CON-010`).

**Exceptions**
- `EX-CON-003.1` Use of consented data for a different purpose → `PERMISSION_DENIED`, logged as a control event.

**Events** — `consent.granted`
**Audit** — purpose recorded at grant; purpose mismatches audited.

**Story `US-CON-003`** — As a customer, I want to know why my data is being requested, so that I can judge whether the purpose is acceptable.
*Given* a consent for prequalification, *when* the data is later needed for a different purpose, *then* a new consent is required.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CON-003-1 | POS | Purpose displayed and persisted |
| TC-CON-003-2 | NEG | Use for a different purpose refused |
| TC-CON-003-3 | POS | Original purpose text preserved after a catalogue reword |
| TC-CON-003-4 | AUD | Purpose mismatch audited |

---

### BFR-CON-004 — Consent records duration `P1`

**Acceptance (URS):** Start and expiry timestamps are retained.

**Screens** — Consent request showing the duration in plain language; Consent dashboard showing "expires in N days".

**Workflow**
1. Duration comes from the flow's configured maximum, and may be shortened by the customer where the flow permits.
2. `granted_at` and `expires_at` are stored.
3. At expiry, status becomes `EXPIRED` and dependent access stops.

**API** — `POST /api/v1/consents` with `duration`; responses include `granted_at`, `expires_at`.

**Data** — `consent.granted_at`, `consent.expires_at`, `consent.status`

**Rules**
- `BR-CON-004.1` Every consent has an expiry; perpetual consent is not offered.
- `BR-CON-004.2` Maximum durations are configuration per consent type (`GOV-001`).
- `BR-CON-004.3` Expiry is evaluated at use time, not by a background job alone, so a lapsed consent cannot be used between sweeps.
- `BR-CON-004.4` Renewal is a new consent record, never an extension of the old one.

**Exceptions**
- `EX-CON-004.1` Use after expiry → `CONSENT_REVOKED` (expired variant), no data returned.
- `EX-CON-004.2` Requested duration above the configured maximum → `VALIDATION_FAILED`.

**Events** — `consent.expired`
**Audit** — grant and expiry both recorded.

**Story `US-CON-004`** — As a customer, I want my consent to have a defined end date, so that permission I gave once does not last forever.
*Given* a consent that has expired, *when* a service attempts to use it, *then* access is refused at the point of use.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CON-004-1 | POS | Start and expiry stored and displayed |
| TC-CON-004-2 | NEG | Use after expiry refused at use time |
| TC-CON-004-3 | NEG | Duration beyond configured maximum refused |
| TC-CON-004-4 | POS | Renewal creates a new record, old one retained |

---

### BFR-CON-005 — Customers revoke consent `P1`

**Acceptance (URS):** Future collection stops after successful revocation.

**Screens** — Consent dashboard ▸ Revoke, with a clear statement of what will stop and what will be retained.

**Workflow**
1. Customer selects a consent and confirms revocation.
2. `revoked_at` is set; `consent.revoked` is published.
3. `connect-svc` cancels scheduling and in-flight syncs; `passport-svc` revokes dependent shares; other consumers stop processing.
4. The customer sees confirmation of exactly what stopped.

**API**
- `POST /api/v1/consents/{id}/revoke` `{reason?}` → 200
- `GET /api/v1/consents?status=ACTIVE` → 200

**Data** — `consent.revoked_at`, `consent.status = REVOKED`

**Rules**
- `BR-CON-005.1` Revocation takes effect immediately at the point of use — not on the next scheduled sweep.
- `BR-CON-005.2` Revocation cascades: dependent connections and Passport shares are stopped or revoked in the same operation.
- `BR-CON-005.3` Revocation never fails silently; if a dependent cannot be stopped, the operation reports partial completion and raises an incident.
- `BR-CON-005.4` The customer is told plainly what stops and what is retained (bridging to `CON-006`).

**Exceptions**
- `EX-CON-005.1` Revocation of an already-revoked consent → idempotent 200, no error.
- `EX-CON-005.2` In-flight sync at revocation → cancelled; any partially retrieved data from that run is discarded.

**Events** — `consent.revoked`
**Audit** — revocation actor, time, reason and the cascade performed.

**Story `US-CON-005`** — As a customer, I want to withdraw my consent and have collection actually stop, so that withdrawing permission means something in practice.
*Given* a connected account, *when* I revoke its consent, *then* no further data is retrieved from that source.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CON-005-1 | POS | Revocation stops future syncs |
| TC-CON-005-2 | POS | Dependent Passport shares revoked in the same operation |
| TC-CON-005-3 | IDM | Repeat revocation is idempotent |
| TC-CON-005-4 | CON | In-flight sync cancelled, partial data discarded |
| TC-CON-005-5 | AUD | Revocation and cascade audited |

---

### BFR-CON-006 — Revocation does not delete legally retained records `P1`

**Acceptance (URS):** System differentiates retention obligations from future processing permission.

**Screens** — Revocation confirmation explicitly distinguishing "what stops" from "what we must keep, and why".

**Workflow**
1. Revocation sets a *processing permission* flag.
2. The retention engine evaluates records separately, against legal obligations (`BFR-STD-006`).
3. Records under an obligation remain; records with no obligation follow the disposal schedule.

**API** — `GET /api/v1/consents/{id}/effects` → 200 `{stopped[], retained[{class, retention_reason}]}`

**Data** — `consent.status` (permission) vs `retention_policy` (obligation) — two separate mechanisms.

**Rules**
- `BR-CON-006.1` Revoking consent never triggers deletion of financial, AML, audit or complaint records.
- `BR-CON-006.2` Permission and retention are independent flags in independent tables and are tested independently.
- `BR-CON-006.3` The customer receives a reasoned explanation naming the retention basis, not a generic statement.
- `BR-CON-006.4` A deletion request is a separate workflow (URS §17) and is likewise evaluated against obligations.

**Exceptions**
- `EX-CON-006.1` Deletion request for records under obligation → accepted, and answered with the obligation and the date it lapses.

**Events** — `consent.revoked`
**Audit** — the retention determination is itself recorded.

**Story `US-CON-006`** — As a compliance officer, I want revocation to stop future processing without deleting records we are obliged to keep, so that we honour the customer's choice without breaching retention duties.
*Given* a revoked consent, *when* I query the customer's transaction history, *then* it is still present, while no new data is being collected.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CON-006-1 | POS | Revocation stops processing; retained records survive |
| TC-CON-006-2 | NEG | Revocation does not delete transactions, audit or AML records |
| TC-CON-006-3 | POS | Customer sees what is retained and why |
| TC-CON-006-4 | AUD | Retention determination recorded |

---

### BFR-CON-007 — Customers view active consent `P1`

**Acceptance (URS):** Dashboard displays provider, purpose, scope and expiry.

**Screens** — Privacy ▸ Active permissions: one card per consent showing recipient, purpose, scopes, granted date, expiry and a revoke action.

**Workflow**
1. Customer opens the privacy dashboard.
2. All active consents are listed with their full detail.
3. Each card links to its disclosure history (`CON-009`) and offers revocation (`CON-005`).

**API** — `GET /api/v1/consents?status=ACTIVE` → 200

**Data** — `consent`, `consent_scope`, `partner`

**Rules**
- `BR-CON-007.1` The dashboard is authoritative — every active consent appears, with no hidden or system-internal grants excluded from view.
- `BR-CON-007.2` Recipients are shown by legal name, not by internal identifier.
- `BR-CON-007.3` The list is usable on a constrained connection: paginated, small payload (`NFR-007`).

**Exceptions**
- `EX-CON-007.1` A consent whose recipient partner has been offboarded still displays, marked inactive (`PRT-010`).

**Events** — none
**Audit** — dashboard access is logged (it exposes the customer's permission map).

**Story `US-CON-007`** — As a customer, I want one place showing everyone who currently has permission to see my data and why, so that I stay in control.
*Given* several active consents, *when* I open the privacy dashboard, *then* I see recipient, purpose, scopes and expiry for each.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CON-007-1 | POS | All active consents listed with full detail |
| TC-CON-007-2 | PRM | A customer sees only their own consents |
| TC-CON-007-3 | POS | Offboarded recipient still displayed, marked inactive |
| TC-CON-007-4 | API | Payload small enough for the low-bandwidth profile |

---

### BFR-CON-008 — Customers view historical consent `P2`

**Acceptance (URS):** Granted, expired and revoked consent records remain viewable where appropriate.

**Screens** — Privacy ▸ History with status filter and date range.

**Workflow**
1. Customer switches the dashboard to history.
2. Expired, revoked and superseded consents are listed with their outcome and dates.

**API** — `GET /api/v1/consents?status=EXPIRED,REVOKED,SUPERSEDED&from=&to=` → 200

**Data** — `consent` (all statuses retained)

**Rules**
- `BR-CON-008.1` Historical consents are never purged while the underlying retention obligation runs.
- `BR-CON-008.2` History shows why a consent ended: expired, revoked by the customer, or superseded by a new version.
- `BR-CON-008.3` Historical entries are read-only in every interface.

**Exceptions**
- `EX-CON-008.1` History request beyond the retention horizon → empty result with an explanation, not an error.

**Events** — none
**Audit** — access logged.

**Story `US-CON-008`** — As a customer, I want to see permissions I gave in the past and how they ended, so that I have a complete record of my own decisions.
*Given* a consent I revoked last year, *when* I view history, *then* I see it with its revocation date and reason.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CON-008-1 | POS | Expired, revoked and superseded consents all visible |
| TC-CON-008-2 | POS | Reason for ending shown |
| TC-CON-008-3 | SEC | History is read-only |
| TC-CON-008-4 | PRM | Only the owning customer can view |

---

### BFR-CON-009 — Consent sharing is logged `P1`

**Acceptance (URS):** Each disclosure records recipient, scope, purpose and timestamp.

**Screens** — Privacy ▸ Data access history: every disclosure with who, what, why and when.

**Workflow**
1. Every outbound disclosure of customer data writes a `disclosure_log` row **before** the response is released.
2. The customer's data-access history reads from that log.
3. Abnormal disclosure volume feeds security monitoring (URS §21).

**API**
- `GET /api/v1/privacy/disclosures?from=&to=` → 200
- internal: disclosure logging is middleware on partner-facing responses, not a per-endpoint concern.

**Data** — `disclosure_log` (append-only)

**Rules**
- `BR-CON-009.1` If the disclosure log write fails, the disclosure does not happen — they share a transaction.
- `BR-CON-009.2` The log records recipient, data categories actually returned (not merely requested), purpose and correlation ID.
- `BR-CON-009.3` The log is append-only and visible to the customer.
- `BR-CON-009.4` Mass-access patterns raise a security alert (URS §21, `FPS-006`).

**Exceptions**
- `EX-CON-009.1` Log write failure → `INTERNAL_ERROR`, no data disclosed.

**Events** — `passport.accessed` for Passport reads; disclosure entries for all others.
**Audit** — the log is itself the audit for disclosures, mirrored to `audit_event`.

**Story `US-CON-009`** — As a customer, I want a record of every time my data was actually shared, so that I can verify my permissions were honoured.
*Given* a partner read my Passport, *when* I open data-access history, *then* I see who read it, which sections, why and when.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CON-009-1 | POS | Disclosure produces a complete log entry |
| TC-CON-009-2 | ERR | Log write failure prevents the disclosure |
| TC-CON-009-3 | POS | Log records categories actually returned |
| TC-CON-009-4 | SEC | Log is append-only |
| TC-CON-009-5 | INT | Abnormal volume raises a security alert |

---

### BFR-CON-010 — Consent is versioned `P1`

**Acceptance (URS):** Changed terms require new version and appropriate renewed acceptance.

**Screens** — "Our permissions terms have changed" prompt showing what changed; Re-accept.

**Workflow**
1. Consent terms are a versioned artefact with an effective date.
2. A material change creates a new version; existing grants remain bound to the version they accepted.
3. At next use — or proactively — affected customers are asked to accept the new version.
4. Until they do, processing continues only within the old version's scope, or stops if the old version is withdrawn.

**API**
- `GET /api/v1/consent-terms/current?type=` → 200
- `POST /api/v1/consents/{id}/reaccept` `{terms_version_id}` → 200

**Data** — `consent_terms_version`, `consent.terms_version_id`

**Rules**
- `BR-CON-010.1` A consent is permanently bound to the terms version accepted; a later change never retroactively widens it.
- `BR-CON-010.2` Material changes require renewed acceptance; immaterial ones (typo, translation fix) are recorded but do not.
- `BR-CON-010.3` The materiality determination is recorded with the version and is itself approved (`GOV-008`).
- `BR-CON-010.4` The customer is shown what changed, not only that something changed.

**Exceptions**
- `EX-CON-010.1` Processing under a superseded version beyond its permitted window → `CONSENT_REQUIRED`.

**Events** — `consent.terms.versioned`, `consent.granted` (on re-acceptance)
**Audit** — version creation, materiality decision and each re-acceptance.

**Story `US-CON-010`** — As a customer, I want to be asked again when the terms of my permission materially change, so that my old agreement is not stretched to cover something new.
*Given* a material terms change, *when* I have not re-accepted, *then* processing stays within what I originally agreed.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CON-010-1 | POS | New version requires re-acceptance for material change |
| TC-CON-010-2 | NEG | Old grant not widened by a new version |
| TC-CON-010-3 | POS | Immaterial change does not force re-acceptance |
| TC-CON-010-4 | AUD | Materiality decision approved and audited |
| TC-CON-010-5 | POS | Change summary displayed to the customer |
