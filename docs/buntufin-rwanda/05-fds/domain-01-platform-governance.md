# BFR-FDS-01 — Domain 01: Platform Governance (`GOV`)

**Context:** Configuration (`config-svc`) · **Epic:** `EPIC-GOV` — Controlled, auditable, country-aware platform configuration
**Wave:** W1 Foundation · **Depends on:** audit-svc, identity-svc (roles)
**Consumed by:** all 29 other domains

> This domain exists so that no other domain contains a hard-coded regulatory
> value. 61 requirements elsewhere in the URS say "configurable"; every one of
> them resolves here.

---

### BFR-GOV-001 — Configurable country-specific regulatory rules `P1`

**Acceptance (URS):** Regulatory limits can be changed through controlled configuration without changing source code.
**Component:** `config-svc` / Resolution engine

**Screens** — Admin ▸ Configuration ▸ Registry (searchable list); Config detail (current value, version history, effective dates); Change request form.

**Workflow**
1. Administrator searches the registry by key, scope or owning domain.
2. Opens a key, sees current resolved value per scope plus full version history.
3. Proposes a new value with an effective date and a justification.
4. Regulated keys route to approval (`GOV-008`); non-regulated activate on their effective date.
5. On activation the resolution cache is invalidated platform-wide.

**API**
- `GET /api/admin/v1/config?key=&scope_type=&scope_ref=` → 200 registry list
- `GET /api/admin/v1/config/{config_id}` → 200 with version history
- `POST /api/admin/v1/config/{config_id}/versions` → 201 `DRAFT`/`PENDING_APPROVAL`
- `GET /api/admin/v1/config/resolve?key=&country=&product=&tier=&corridor=&cohort=` → 200 resolved value + the version that produced it

**Data** — `platform_config`, `config_version`

**Rules**
- `BR-GOV-001.1` No service reads a regulatory threshold from code, environment variables or its own tables — only from `config-svc`.
- `BR-GOV-001.2` Every resolution returns the `config_version_id` that produced it, and callers persist it on any decision that depended on it.
- `BR-GOV-001.3` A key's `data_type` is enforced on write; a type mismatch is rejected.
- `BR-GOV-001.4` Resolution precedence is fixed: emergency suspension → cohort → country → product → tier → corridor → global default.

**Exceptions**
- `EX-GOV-001.1` Unknown key → `VALIDATION_FAILED`, no partial write.
- `EX-GOV-001.2` No version effective at the resolution instant → `INTERNAL_ERROR` with the key named; the calling operation fails closed rather than defaulting.
- `EX-GOV-001.3` Value still `PLACEHOLDER` in pre-production or production → resolution succeeds in lower environments, fails the release gate above them.

**Events** — `config.version.proposed`, `config.version.activated`
**Audit** — every proposal, approval, activation and emergency change writes `audit_event` with before/after (`GOV-010`).

**Story `US-GOV-001`** — As a compliance administrator, I want to change a regulatory limit through controlled configuration, so that we can respond to a rule change without a software release.
*Given* an active regulated key, *when* I propose a new value with a future effective date and it is approved, *then* the old value applies until that date and the new value applies from it, and both remain retrievable.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOV-001-1 | POS | Change a limit via config; new limit enforced with no deployment |
| TC-GOV-001-2 | NEG | Wrong data type for key is rejected |
| TC-GOV-001-3 | PRM | User without `config.propose` cannot create a version |
| TC-GOV-001-4 | AUD | Activation writes audit with old and new value |
| TC-GOV-001-5 | API | Resolve endpoint returns the deciding `config_version_id` |
| TC-GOV-001-6 | ERR | Missing effective version fails closed, does not silently default |

---

### BFR-GOV-002 — Distinguish BuntuFin services from regulated partner services `P1`

**Acceptance (URS):** Each financial product identifies the legal service provider presented to the customer.
**Component:** `config-svc` / Product catalogue + `partner-svc`

**Screens** — Every product surface (savings, financing, transfer, payment) shows a provider attribution block; Product detail ▸ "Who provides this?"; Admin ▸ Products ▸ provider binding.

**Workflow**
1. A product version is created and **must** be bound to a `partner` acting as legal provider.
2. Client surfaces fetch the product descriptor, which always includes provider name, provider type and regulatory reference where held.
3. UI components refuse to render a financial product whose descriptor lacks a provider.

**API**
- `GET /api/v1/products/{product_code}` → 200 including `legal_provider {partner_id, display_name, provider_type, regulatory_reference, disclosure_text_key}`
- `POST /api/admin/v1/products/{id}/versions` → 400 if `legal_provider_partner_id` absent

**Data** — `product`, `product_version.legal_provider_partner_id` **NOT NULL**, `partner`

**Rules**
- `BR-GOV-002.1` A product version cannot be activated without a legal provider.
- `BR-GOV-002.2` Where BuntuFin is itself the provider, this is an explicit configured value, never a default or an absence.
- `BR-GOV-002.3` Provider attribution appears on the product screen, the confirmation screen and the receipt/export.
- `BR-GOV-002.4` Changing a product's legal provider is a regulated change requiring approval (`GOV-008`).

**Exceptions**
- `EX-GOV-002.1` Missing provider on activation → `VALIDATION_FAILED`.
- `EX-GOV-002.2` Provider suspended (`PRT-003`) → product hidden from new transactions with `FEATURE_DISABLED`.

**Events** — `product.version.activated`
**Audit** — provider binding changes recorded with actor, approver and reason.

**Story `US-GOV-002`** — As a customer, I want to see which licensed institution actually provides a financial product, so that I know who I am dealing with and who is accountable.
*Given* any financial product, *when* I view it, *then* the legal provider is displayed before I can proceed.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOV-002-1 | POS | Product descriptor returns provider; UI renders attribution |
| TC-GOV-002-2 | NEG | Product version without provider cannot activate |
| TC-GOV-002-3 | SEC | Provider field cannot be overridden by a client-supplied parameter |
| TC-GOV-002-4 | AUD | Provider change audited with approver |
| TC-GOV-002-5 | INT | Suspended provider removes product from customer catalogue |

---

### BFR-GOV-003 — Product-version history `P1`

**Acceptance (URS):** Every product configuration change records version, author, approver and effective date.
**Component:** `config-svc` / Versioned artefact pattern

**Screens** — Admin ▸ Products ▸ Version history (diff view between versions).

**Workflow**
1. Any product change creates a new `product_version` rather than mutating the current one.
2. The version records author, approver, effective window and a machine-readable diff.
3. Historical versions remain queryable for any past date.

**API**
- `GET /api/admin/v1/products/{id}/versions` → 200 list
- `GET /api/admin/v1/products/{id}/versions/{version}` → 200 detail
- `GET /api/admin/v1/products/{id}/as-of?at=2026-05-01T00:00:00Z` → 200 the version in force at that instant

**Data** — `product_version(version, effective_from, effective_to, author_id, approver_id, status, diff)`

**Rules**
- `BR-GOV-003.1` Product versions are append-only; no update path exists.
- `BR-GOV-003.2` Version numbers are monotonic per product.
- `BR-GOV-003.3` Effective windows for a product never overlap.
- `BR-GOV-003.4` Any decision that used a product (a payment, an offer, a savings instruction) persists the `product_version_id` it used, so the decision remains reproducible.

**Exceptions**
- `EX-GOV-003.1` Overlapping effective window → `VALIDATION_FAILED` naming the conflicting version.

**Events** — `product.version.created`, `product.version.activated`
**Audit** — full before/after diff retained.

**Story `US-GOV-003`** — As an auditor, I want to see exactly which product terms were in force on a given date and who approved them, so that I can assess a past transaction against the rules that actually applied.
*Given* a transaction from three months ago, *when* I open its product reference, *then* I see the exact version used, its author, approver and effective date.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOV-003-1 | POS | Change creates new version with author/approver/effective date |
| TC-GOV-003-2 | NEG | Overlapping effective windows rejected |
| TC-GOV-003-3 | POS | `as-of` query returns the historically correct version |
| TC-GOV-003-4 | AUD | Version history immutable and complete |
| TC-GOV-003-5 | INT | A payment persists and can resolve its product version |

---

### BFR-GOV-004 — Feature flags by country `P1`

**Acceptance (URS):** A feature can be enabled in Rwanda while disabled elsewhere.
**Component:** `config-svc` / Flag resolution

**Screens** — Admin ▸ Feature flags ▸ matrix of feature × country with state.

**Workflow**
1. Administrator sets a flag's state for a country scope.
2. Every request resolves flags for the caller's country context.
3. A disabled feature is absent from the client's capability manifest and rejected server-side if called directly.

**API**
- `GET /api/v1/capabilities` → 200 the resolved flag set for the authenticated principal
- `PUT /api/admin/v1/flags/{key}?scope_type=COUNTRY&scope_ref=RW` → 200

**Data** — `feature_flag(key, scope_type, scope_ref, enabled)`

**Rules**
- `BR-GOV-004.1` Flags are enforced **server-side**; hiding UI is presentation, not control.
- `BR-GOV-004.2` A flag's default is `disabled` — a new capability is off until explicitly enabled.
- `BR-GOV-004.3` Every feature gated by a BLOCKING open question (`BFR-ANA-002`) has a flag, and it ships disabled.

**Exceptions**
- `EX-GOV-004.1` Call to a disabled feature → `FEATURE_DISABLED` (403), audited.

**Events** — `feature.flag.changed`
**Audit** — flag changes recorded with actor and reason.

**Story `US-GOV-004`** — As a product administrator, I want features enabled per country, so that a capability lawful in Rwanda is not exposed in a market where it is not yet permitted.
*Given* a feature enabled for RW only, *when* a non-RW principal calls its endpoint, *then* the call is rejected with `FEATURE_DISABLED` and audited.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOV-004-1 | POS | Feature on in RW, off elsewhere |
| TC-GOV-004-2 | NEG | Direct API call to disabled feature rejected server-side |
| TC-GOV-004-3 | SEC | Client cannot self-declare its country to bypass the flag |
| TC-GOV-004-4 | AUD | Flag change audited |

---

### BFR-GOV-005 — Feature flags by sandbox cohort `P1`

**Acceptance (URS):** Admin can enable functionality for selected pilot users only.
**Component:** `config-svc` / Cohort membership

**Screens** — Admin ▸ Cohorts (create, add/remove members, view size); Flag matrix with cohort column.

**Workflow**
1. Administrator creates a cohort and adds customers (individually or by import).
2. A flag is scoped to that cohort.
3. Resolution checks cohort membership before country default.

**API**
- `POST /api/admin/v1/cohorts` → 201; `POST /api/admin/v1/cohorts/{id}/members` → 201
- `DELETE /api/admin/v1/cohorts/{id}/members/{customer_id}` → 204

**Data** — `cohort`, `cohort_member(customer_id, added_by, added_at, removed_at)`

**Rules**
- `BR-GOV-005.1` Cohort membership is administered, never self-service (`S-03`).
- `BR-GOV-005.2` Cohort scope overrides country scope in resolution precedence.
- `BR-GOV-005.3` Removing a member takes effect on the next request; no cached grant survives.
- `BR-GOV-005.4` Cohort size is reportable for sandbox participation KPIs (`RPT-001`).

**Exceptions**
- `EX-GOV-005.1` Non-member calls a cohort-gated feature → `FEATURE_DISABLED`.

**Events** — `cohort.member.added`, `cohort.member.removed`
**Audit** — membership changes audited with actor.

**Story `US-GOV-005`** — As a sandbox administrator, I want to enable a capability for selected pilot users only, so that we can test under supervision without exposing the whole customer base.
*Given* a cohort-gated feature, *when* a non-member attempts it, *then* it is rejected; *when* a member attempts it, *then* it succeeds.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOV-005-1 | POS | Cohort member gets the feature |
| TC-GOV-005-2 | NEG | Non-member rejected |
| TC-GOV-005-3 | POS | Removal takes effect immediately (cache invalidation) |
| TC-GOV-005-4 | PRM | Only cohort-admin role can change membership |
| TC-GOV-005-5 | AUD | Membership changes audited |

---

### BFR-GOV-006 — Configurable transaction limits `P1`

**Acceptance (URS):** Limits can be configured by product, customer tier, currency and corridor.
**Component:** `config-svc` / Limit rules + limit evaluation service

**Screens** — Admin ▸ Limits ▸ matrix (product × tier × currency × corridor); customer app shows the applicable limit and remaining headroom.

**Workflow**
1. Administrator defines a limit rule on any combination of dimensions.
2. Before authorising any money movement, the initiating service calls the limit evaluator with `(customer, product, amount, currency, corridor)`.
3. The evaluator aggregates prior qualifying activity in the window and returns allow/deny plus remaining headroom.

**API**
- `POST /api/admin/v1/limits` → 201 (regulated: requires approval)
- `GET /api/v1/limits/applicable?product=&currency=&corridor=` → 200 limit + remaining headroom
- Internal: `POST /internal/limits/evaluate`

**Data** — `limit_rule(product_id, tier, currency_code, corridor, limit_type, value_minor, config_version_id)`

**Rules**
- `BR-GOV-006.1` Limit evaluation is server-side and mandatory on every money-moving path.
- `BR-GOV-006.2` Where multiple rules match, the **most restrictive** applies, and the deciding rule is recorded on the transaction.
- `BR-GOV-006.3` Aggregation windows are computed in the customer's local day/month, using the canonical stored UTC timestamps.
- `BR-GOV-006.4` A pending or held amount counts against the limit until it fails or is released, so a customer cannot exceed a limit through concurrent requests.
- `BR-GOV-006.5` Limit values are `PLACEHOLDER` until `Q-04` is answered.

**Exceptions**
- `EX-GOV-006.1` Limit breach → `LIMIT_EXCEEDED` with the limit type and remaining headroom, no funds moved.
- `EX-GOV-006.2` No rule matches → fail closed with `INTERNAL_ERROR`; an unlimited default is never assumed.

**Events** — `limit.rule.changed`, `limit.breached` (to compliance for pattern analysis)
**Audit** — rule changes audited; breaches logged with customer, product and amount.

**Story `US-GOV-006`** — As a compliance officer, I want transaction limits configured by product, tier, currency and corridor, so that regulatory limits are enforced consistently everywhere money moves.
*Given* a tier-2 daily limit, *when* a customer's cumulative day total would exceed it, *then* the transaction is refused with `LIMIT_EXCEEDED` and nothing is debited.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOV-006-1 | POS | Transaction within limit succeeds |
| TC-GOV-006-2 | NEG | Transaction exceeding daily limit refused, no debit |
| TC-GOV-006-3 | CON | Concurrent transactions cannot jointly exceed the limit |
| TC-GOV-006-4 | POS | Most restrictive rule wins when several match |
| TC-GOV-006-5 | ERR | No matching rule fails closed |
| TC-GOV-006-6 | DEC | Aggregation is exact in minor units |
| TC-GOV-006-7 | AUD | Deciding rule recorded on the transaction |

---

### BFR-GOV-007 — Effective dates for regulated configuration `P1`

**Acceptance (URS):** Future rule changes can be scheduled and previous values remain auditable.
**Component:** `config-svc` / Effective-dated resolution

**Screens** — Config detail ▸ timeline view showing past, current and scheduled values.

**Workflow**
1. A change is created with `effective_from` in the future.
2. It sits `APPROVED` but not `ACTIVE` until that instant.
3. At the effective instant, resolution begins returning the new value; the previous version is closed with `effective_to`, not deleted.

**API**
- `POST /api/admin/v1/config/{id}/versions` with `effective_from`
- `GET /api/admin/v1/config/{id}/timeline` → 200 past/current/scheduled
- `DELETE /api/admin/v1/config/{id}/versions/{version}` → 204 **only** while still scheduled and unapproved

**Data** — `config_version(effective_from, effective_to, status)`

**Rules**
- `BR-GOV-007.1` Resolution is always "the version effective at instant T", never "the latest row".
- `BR-GOV-007.2` A scheduled change may be cancelled before it takes effect; an active one may only be superseded.
- `BR-GOV-007.3` Superseded values remain readable indefinitely.
- `BR-GOV-007.4` A transaction records the config version it used, so a later change never alters the interpretation of a past transaction.

**Exceptions**
- `EX-GOV-007.1` `effective_from` in the past on a regulated key → `VALIDATION_FAILED` (backdating a regulated rule is not permitted).
- `EX-GOV-007.2` Cancelling an already-effective version → `STATE_TRANSITION_INVALID`.

**Events** — `config.version.scheduled`, `config.version.activated`
**Audit** — scheduling, cancellation and activation all audited.

**Story `US-GOV-007`** — As a compliance administrator, I want to schedule a rule change for a future date, so that the platform switches to the new rule at the moment it comes into force, with the old rule still auditable.
*Given* a change scheduled for the 1st, *when* the 1st arrives, *then* the new value applies from that instant and transactions before it still resolve to the old value.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOV-007-1 | POS | Scheduled change activates at the effective instant |
| TC-GOV-007-2 | NEG | Backdating a regulated key rejected |
| TC-GOV-007-3 | POS | Historical resolution returns the value in force then |
| TC-GOV-007-4 | AUD | Previous value remains retrievable after supersession |

---

### BFR-GOV-008 — Approval required for material configuration changes `P1`

**Acceptance (URS):** Maker cannot approve own regulated configuration change.
**Component:** `config-svc` / Maker-checker

**Screens** — Admin ▸ Approvals queue; Change detail with diff, proposer, justification; Approve/Reject with reason.

**Workflow**
1. Proposer submits a change to a key flagged `is_regulated`.
2. The change enters `PENDING_APPROVAL` and appears in the approvals queue for holders of the approver role.
3. An approver other than the proposer approves or rejects with a reason.
4. Approval moves the version to `APPROVED`; activation follows its effective date.

**API**
- `POST /api/admin/v1/config/{id}/versions/{version}/approve` → 200
- `POST /api/admin/v1/config/{id}/versions/{version}/reject` → 200 (reason required)
- `GET /api/admin/v1/approvals?status=PENDING` → 200

**Data** — `config_version(author_id, approver_id, status)` with **CHECK `approver_id <> author_id`**

**Rules**
- `BR-GOV-008.1` The database constraint, not only the application, prevents self-approval.
- `BR-GOV-008.2` The approver must hold the approver role for that key's owning domain.
- `BR-GOV-008.3` Rejection requires a reason and returns the version to `DRAFT`.
- `BR-GOV-008.4` A change cannot take effect while `PENDING_APPROVAL`, whatever its effective date.
- `BR-GOV-008.5` Emergency suspension (`GOV-009`) is the sole single-actor exception, and is time-boxed and separately audited.

**Exceptions**
- `EX-GOV-008.1` Self-approval attempt → `PERMISSION_DENIED`, audited as a control-breach attempt.
- `EX-GOV-008.2` Approval by a role without authority for that domain → `PERMISSION_DENIED`.

**Events** — `config.version.approved`, `config.version.rejected`
**Audit** — proposer, approver, timestamps, justification and diff all retained.

**Story `US-GOV-008`** — As a regulator, I want material configuration changes to require a second authorised person, so that no individual can unilaterally change a regulatory control.
*Given* a regulated change I proposed, *when* I attempt to approve it myself, *then* it is refused and the attempt is audited.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOV-008-1 | POS | Second approver activates the change |
| TC-GOV-008-2 | NEG | Self-approval refused at application layer |
| TC-GOV-008-3 | SEC | Self-approval refused at database layer even if the application check is bypassed |
| TC-GOV-008-4 | PRM | Approver without domain authority refused |
| TC-GOV-008-5 | NEG | Pending change does not take effect on its effective date |
| TC-GOV-008-6 | AUD | Attempted self-approval audited |

---

### BFR-GOV-009 — Emergency feature suspension `P1`

**Acceptance (URS):** Authorised admin can disable a product/corridor without taking down entire platform.
**Component:** `config-svc` / Kill switch

**Screens** — Admin ▸ Emergency controls (prominent, confirmation-gated, reason mandatory); Active suspensions banner visible to all admin users.

**Workflow**
1. An authorised administrator selects the target (product, corridor, partner, feature) and supplies a reason.
2. Suspension takes effect immediately, ahead of all other resolution precedence.
3. In-flight transactions already past authorisation complete or follow their recovery path; no new ones are accepted.
4. Suspension is time-boxed; continuing it beyond the configured window requires a maker-checker change.

**API**
- `POST /api/admin/v1/emergency/suspend` `{target_type, target_ref, reason}` → 200
- `POST /api/admin/v1/emergency/resume` → 200 (requires second approver)
- `GET /api/admin/v1/emergency/active` → 200

**Data** — `feature_flag(suspended_at, suspended_by, suspension_reason, suspension_expires_at)`

**Rules**
- `BR-GOV-009.1` Suspension is granular: one product, corridor or partner, never the whole platform.
- `BR-GOV-009.2` Single-actor for speed — but loudly audited, alerted to security and compliance, and time-boxed.
- `BR-GOV-009.3` **Resuming** requires two people; only stopping is single-actor.
- `BR-GOV-009.4` Suspension never deletes or reverses existing financial records.
- `BR-GOV-009.5` Customers attempting a suspended capability receive a clear, non-alarming message, not a generic error.

**Exceptions**
- `EX-GOV-009.1` Transaction against a suspended target → `FEATURE_DISABLED` with a plain-language reason key.
- `EX-GOV-009.2` Suspension without a reason → `VALIDATION_FAILED`.

**Events** — `feature.suspended`, `feature.resumed`
**Audit** — actor, target, reason, duration; alert raised to security and compliance.

**Story `US-GOV-009`** — As an operations manager, I want to suspend a single corridor immediately when a partner fails, so that customers stop being exposed to it without shutting down the platform.
*Given* an incident on one corridor, *when* I suspend it, *then* new transfers on that corridor are refused while every other corridor continues normally.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOV-009-1 | POS | Suspending one corridor leaves others working |
| TC-GOV-009-2 | NEG | Suspension without reason rejected |
| TC-GOV-009-3 | PRM | Unauthorised role cannot suspend |
| TC-GOV-009-4 | PRM | Resume requires a second approver |
| TC-GOV-009-5 | INT | In-flight authorised transactions follow their recovery path, not silent loss |
| TC-GOV-009-6 | AUD | Suspension audited and alerted |

---

### BFR-GOV-010 — All regulatory configuration auditable `P1`

**Acceptance (URS):** Who, what, when, old value and new value are retrievable.
**Component:** `config-svc` → `audit-svc`

**Screens** — Admin ▸ Configuration ▸ Audit trail (filter by key, actor, date); export.

**Workflow**
1. Every configuration mutation writes an audit event inside the same transaction as the change.
2. The event captures actor, action, target key and scope, before value, after value, reason and correlation ID.
3. Auditors query and export the trail; they cannot alter it.

**API**
- `GET /api/admin/v1/audit?target_type=CONFIG&target_id=&from=&to=` → 200
- `POST /api/admin/v1/audit/export` → 202 job → CSV/XLSX (`RPT-010`)

**Data** — `audit_event` (append-only, hash-chained)

**Rules**
- `BR-GOV-010.1` If the audit write fails, the configuration change fails — they share a transaction.
- `BR-GOV-010.2` Audit records are never editable or deletable by any application role (`NFR-006`).
- `BR-GOV-010.3` Values in audit are masked per policy where a config value is itself sensitive, but the fact and actor of the change are never masked.
- `BR-GOV-010.4` The audit export is itself audited (`ADM-004`, URS §21 large-export monitoring).

**Exceptions**
- `EX-GOV-010.1` Attempt to modify an audit record → `PERMISSION_DENIED` at application layer and denied at database layer.

**Events** — none additional (audit is the record)
**Audit** — self-evidencing; hash chain verified by a scheduled integrity job.

**Story `US-GOV-010`** — As an auditor, I want a complete, tamper-evident record of every regulatory configuration change, so that I can prove what the platform's rules were at any past moment and who changed them.
*Given* a configuration change made last month, *when* I query the audit trail, *then* I see actor, timestamp, old value, new value and the approval, and I cannot alter any of it.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-GOV-010-1 | POS | Config change produces complete audit record |
| TC-GOV-010-2 | AUD | Old and new values both retrievable |
| TC-GOV-010-3 | SEC | Audit modification denied at database level |
| TC-GOV-010-4 | SEC | Hash chain detects tampering |
| TC-GOV-010-5 | ERR | Audit write failure rolls back the configuration change |
| TC-GOV-010-6 | API | Export produces the approved format and is itself audited |
