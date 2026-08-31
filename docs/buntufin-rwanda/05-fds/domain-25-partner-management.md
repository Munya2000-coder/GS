# BFR-FDS-25 — Domain 25: Partner Management (`PRT`)

**Context:** Partners (`partner-svc`) · **Epic:** `EPIC-PRT` — Controlled, scoped, revocable partner access
**Wave:** W4/W6 · **Depends on:** `GOV`, `USR` · **Consumed by:** `CAP`, `CAF`, `XB`, `FX`, `SAV`, `GOAL`, `REC`

---

### BFR-PRT-001 — Partner organisation profiles `P1`

**Acceptance (URS):** Name, type, status and regulatory references can be stored.

**Screens** — Admin ▸ Partners (list, detail, create); Partner detail with capabilities, users, credentials, health.

**Workflow**
1. A partner is created in `DRAFT` with its legal name, type and regulatory references.
2. Due diligence evidence is attached.
3. Activation requires approval (`PRT-009`).

**API** — `POST /api/admin/v1/partners` → 201; `GET /api/admin/v1/partners/{id}` → 200.

**Data** — `partner(legal_name, trading_name, partner_type, regulatory_reference, jurisdiction, status)`

**Rules**
- `BR-PRT-001.1` The legal name and regulatory reference are mandatory before activation — they are what customers are shown (`GOV-002`).
- `BR-PRT-001.2` A partner's record is the single source of provider identity across every product surface.
- `BR-PRT-001.3` Changes to legal identity or regulatory references are regulated changes requiring approval (`GOV-008`).
- `BR-PRT-001.4` Due diligence evidence is stored encrypted with restricted, audited access.

**Exceptions**
- `EX-PRT-001.1` Activation without a regulatory reference → refused (where the partner type requires one).

**Events** — `partner.created`
**Audit** — creation and every profile change.

**Story `US-PRT-001`** — As a compliance officer, I want each partner's legal identity and regulatory references recorded, so that what we show customers about who provides a product is accurate.
*Given* a partner record, *when* a product names its provider, *then* the name shown comes from this record.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PRT-001-1 | POS | Partner created with name, type, status and references |
| TC-PRT-001-2 | NEG | Activation without a required regulatory reference refused |
| TC-PRT-001-3 | PRM | Legal identity changes require approval |
| TC-PRT-001-4 | SEC | Due diligence evidence encrypted and access audited |

---

### BFR-PRT-002 — Configurable partner capability `P1`

**Acceptance (URS):** Partner can be enabled for lending, payments, savings, etc. independently.

**Screens** — Partner ▸ Capabilities matrix with independent toggles per capability and corridor.

**Workflow**
1. Capabilities (lending, payment rail, savings provider, cross-border, FX, biller, Passport recipient) are enabled independently.
2. Every integration checks the specific capability before using the partner.
3. Capability changes are approved and audited.

**API** — `PUT /api/admin/v1/partners/{id}/capabilities` → 200.

**Data** — `partner_capability(capability, enabled, scope, effective_from)`

**Rules**
- `BR-PRT-002.1` Capabilities are independent — enabling a partner for payments never implies lending.
- `BR-PRT-002.2` Every consuming service checks the specific capability, not merely that the partner is active.
- `BR-PRT-002.3` Capability scope may be narrowed by corridor or product.
- `BR-PRT-002.4` Enabling a capability is a regulated change requiring approval.

**Exceptions**
- `EX-PRT-002.1` Operation against an unenabled capability → `PERMISSION_DENIED`, audited as a configuration or integration defect.

**Events** — `partner.capability.changed`
**Audit** — capability changes with approver.

**Story `US-PRT-002`** — As a compliance officer, I want partner capabilities enabled independently, so that a partner approved for payments cannot start receiving lending applications.
*Given* a partner enabled only for payments, *when* a lending submission is attempted to them, *then* it is refused.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PRT-002-1 | POS | Capabilities enabled independently |
| TC-PRT-002-2 | NEG | Operation against an unenabled capability refused |
| TC-PRT-002-3 | POS | Capability scope narrowable by corridor |
| TC-PRT-002-4 | PRM | Capability change requires approval |

---

### BFR-PRT-003 — Partner status controls availability `P1`

**Acceptance (URS):** Suspended partner cannot receive new transactions.

**Screens** — Partner ▸ status with reason; Suspended-partner banner in admin; customer surfaces hide the partner's products.

**Workflow**
1. Status changes to `SUSPENDED` take effect immediately across every consuming service.
2. New transactions, submissions and Passport reads are refused.
3. In-flight items follow their recovery path; existing customer balances with the partner are unaffected.

**API** — `POST /api/admin/v1/partners/{id}/status` `{status, reason}` → 200.

**Data** — `partner.status`, `partner_status_history`

**Rules**
- `BR-PRT-003.1` Status is checked at execution time by every consumer, not cached beyond its configured freshness.
- `BR-PRT-003.2` Suspension stops new activity but never deletes or reverses existing records (`PRT-010`).
- `BR-PRT-003.3` A reason is mandatory and the change is alerted to operations.
- `BR-PRT-003.4` Customers holding products with a suspended partner are informed appropriately (`SAV-009`).

**Exceptions**
- `EX-PRT-003.1` In-flight transaction at suspension → completes or follows recovery; it is never abandoned.
- `EX-PRT-003.2` Suspended partner attempting API access → `PERMISSION_DENIED`, audited.

**Events** — `partner.suspended`, `partner.reinstated`
**Audit** — status changes with actor and reason.

**Story `US-PRT-003`** — As an operations manager, I want suspending a partner to stop new activity immediately, so that we can react to a problem without a deployment.
*Given* a suspended partner, *when* a new transaction to them is attempted, *then* it is refused, while in-flight items are completed or recovered.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PRT-003-1 | POS | Suspension blocks new transactions immediately |
| TC-PRT-003-2 | POS | In-flight items complete or recover |
| TC-PRT-003-3 | NEG | Suspension deletes nothing |
| TC-PRT-003-4 | SEC | Suspended partner's API access refused |
| TC-PRT-003-5 | NEG | Status change without reason refused |

---

### BFR-PRT-004 — Organisation-scoped partner access `P1`

**Acceptance (URS):** User cannot access another partner's data.

**Screens** — Partner portal shows only that partner's data, with no cross-organisation navigation.

**Workflow**
1. Every partner token carries an immutable `partner_id`.
2. Every partner API query is filtered by that scope server-side.
3. Cross-scope attempts return `404` and raise a security event.

**API** — all `/api/partner/v1/**` routes are scope-filtered.

**Data** — scope enforced at the query layer for every partner-accessible entity.

**Rules**
- `BR-PRT-004.1` Scope is applied server-side at the data-access layer, so no endpoint can forget it.
- `BR-PRT-004.2` Identifiers are unguessable UUIDs, so scope is not the only protection against enumeration.
- `BR-PRT-004.3` Cross-scope attempts return `404`, not `403`, so existence is not disclosed.
- `BR-PRT-004.4` Every partner API access is logged with the partner and user (URS §14).

**Exceptions**
- `EX-PRT-004.1` Cross-scope attempt → `404`, security event, pattern monitored (URS §21).

**Events** — security event on cross-scope attempts.
**Audit** — all partner API access logged.

**Story `US-PRT-004`** — As a partner institution, I want certainty that no other partner can see my data, so that I can integrate without commercial risk.
*Given* a partner user, *when* they request another partner's resource by id, *then* it is not found and the attempt is recorded.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PRT-004-1 | SEC | Cross-partner access returns 404 |
| TC-PRT-004-2 | SEC | Scope enforced at the data-access layer on every endpoint |
| TC-PRT-004-3 | SEC | Identifiers not enumerable |
| TC-PRT-004-4 | AUD | All partner access logged |

---

### BFR-PRT-005 — Partner-specific API credentials `P1`

**Acceptance (URS):** Credentials can be rotated/revoked separately.

**Screens** — Partner ▸ Credentials (issue, rotate, revoke) with last-used and IP allowlist.

**Workflow**
1. Credentials are issued per partner and, where useful, per integration.
2. Rotation issues a new credential with an overlap window, then revokes the old.
3. Revocation is immediate.

**API** — `POST /api/admin/v1/partners/{id}/credentials` → 201 (secret shown once); `POST .../rotate` → 200; `DELETE .../{cid}` → 204.

**Data** — `api_credential(credential_type, identifier, secret_handle, status, ip_allowlist, last_used_at)`

**Rules**
- `BR-PRT-005.1` The secret is displayed once at issue and stored only as a vault handle or hash (`NFR-003`).
- `BR-PRT-005.2` Credentials are per partner and independently revocable — revoking one partner's credential never affects another's.
- `BR-PRT-005.3` Rotation supports an overlap window so integrations can switch without downtime.
- `BR-PRT-005.4` Unused credentials beyond a configured period are flagged for review.
- `BR-PRT-005.5` Credential use from an unexpected IP or geography raises a security alert (URS §21).

**Exceptions**
- `EX-PRT-005.1` Revoked credential used → `AUTHENTICATION_REQUIRED`, security event raised.

**Events** — `partner.credential.issued`, `partner.credential.revoked`
**Audit** — issue, rotation, revocation and unusual use.

**Story `US-PRT-005`** — As a security officer, I want partner credentials individually rotatable and revocable, so that one partner's compromise never forces a platform-wide reset.
*Given* a compromised credential, *when* it is revoked, *then* it stops working immediately and no other partner is affected.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PRT-005-1 | POS | Credential issued, rotated and revoked independently |
| TC-PRT-005-2 | SEC | Secret shown once, never retrievable afterwards |
| TC-PRT-005-3 | POS | Rotation overlap avoids downtime |
| TC-PRT-005-4 | SEC | Revoked credential rejected immediately |
| TC-PRT-005-5 | SEC | Unusual credential use alerts |

---

### BFR-PRT-006 — Partner connection health monitored `P1`

**Acceptance (URS):** Current integration status visible to operations.

**Screens** — Admin ▸ Partner health dashboard: availability, latency, error rate, last successful call, open incidents.

**Workflow**
1. Every adapter call reports its outcome and latency.
2. Health is aggregated per partner and per capability.
3. Degradation alerts operations and feeds routing eligibility (`FX-006`).

**API** — `GET /api/admin/v1/partners/health` → 200.

**Data** — `provider_health` per partner and capability.

**Rules**
- `BR-PRT-006.1` Health is derived from real traffic, not only synthetic checks.
- `BR-PRT-006.2` Health is tracked per capability — a partner can be healthy for payments and failing for status callbacks.
- `BR-PRT-006.3` Degradation feeds routing automatically (`FX-006`) rather than waiting for a human.
- `BR-PRT-006.4` Health history is retained for partner performance review.

**Exceptions**
- `EX-PRT-006.1` No traffic in the window → status `UNKNOWN`, not `HEALTHY`; a synthetic check is scheduled.

**Events** — `partner.health.changed`
**Audit** — health transitions recorded.

**Story `US-PRT-006`** — As an operations manager, I want live partner integration health, so that I learn about a partner problem from the dashboard rather than from customers.
*Given* a partner whose error rate rises, *when* I view the health dashboard, *then* the degradation is visible per capability and routing has already adjusted.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PRT-006-1 | POS | Health derived from real traffic |
| TC-PRT-006-2 | POS | Health tracked per capability |
| TC-PRT-006-3 | INT | Degradation affects routing automatically |
| TC-PRT-006-4 | NEG | No traffic yields UNKNOWN, not HEALTHY |

---

### BFR-PRT-007 — Configurable partner webhook endpoints `P2`

**Acceptance (URS):** Verified endpoint can receive approved events.

**Screens** — Partner ▸ Webhooks (URL, events, secret, verification status, delivery history).

**Workflow**
1. The partner configures an endpoint and subscribes to approved event types.
2. The endpoint is verified by a challenge before activation.
3. Deliveries are signed, retried on failure, and recorded.

**API** — `POST /api/partner/v1/webhooks` → 201; `POST .../verify` → 200; `GET .../deliveries` → 200.

**Data** — `webhook_endpoint(url, event_types[], secret_handle, verification_status, status)`

**Rules**
- `BR-PRT-007.1` An endpoint must be verified before it receives any event.
- `BR-PRT-007.2` Payloads are signed; the partner must verify the signature (URS §14).
- `BR-PRT-007.3` Only approved event types can be subscribed, and only for the partner's own scope (`PRT-004`).
- `BR-PRT-007.4` Payloads contain references and non-sensitive facts, never full customer data (`BFR-STD-002`).
- `BR-PRT-007.5` Repeated delivery failures suspend the endpoint and alert both parties.
- `BR-PRT-007.6` Endpoint URLs are validated against internal address ranges to prevent server-side request forgery.

**Exceptions**
- `EX-PRT-007.1` Verification fails → endpoint stays inactive; no events are sent.
- `EX-PRT-007.2` Delivery failures beyond the threshold → endpoint suspended, events queued per policy.

**Events** — `partner.webhook.verified`, `partner.webhook.suspended`
**Audit** — configuration changes and delivery outcomes.

**Story `US-PRT-007`** — As a partner, I want to receive signed event notifications at my verified endpoint, so that I can react to events without polling.
*Given* an unverified endpoint, *when* an event occurs, *then* nothing is delivered until verification succeeds.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PRT-007-1 | POS | Verified endpoint receives subscribed events |
| TC-PRT-007-2 | NEG | Unverified endpoint receives nothing |
| TC-PRT-007-3 | SEC | Payloads signed and verifiable |
| TC-PRT-007-4 | SEC | Internal address ranges rejected as endpoints |
| TC-PRT-007-5 | SEC | Payload contains no full customer data |
| TC-PRT-007-6 | POS | Repeated failures suspend the endpoint and alert |

---

### BFR-PRT-008 — Partner fee configurations versioned `P1`

**Acceptance (URS):** Historical fee basis remains reproducible.

**Screens** — Partner ▸ Fees ▸ version history with effective dates.

**Workflow**
1. Fee configurations are versioned with effective dates (`GOV-007`).
2. Every transaction records the fee version it used.
3. Past fees are reproducible for reconciliation and dispute.

**API** — `POST /api/admin/v1/partners/{id}/fees` → 201 (approval required); `GET .../fees?as_of=` → 200.

**Data** — `partner_fee_version(definition, version, effective_from, effective_to, author_id, approver_id)`

**Rules**
- `BR-PRT-008.1` Fee versions are append-only with non-overlapping effective windows.
- `BR-PRT-008.2` Every transaction persists the fee version applied (`PAY-006`).
- `BR-PRT-008.3` A fee change is a regulated change requiring approval.
- `BR-PRT-008.4` Reconciliation uses the fee version in force at the transaction time, not the current one (`REC-003`).

**Exceptions**
- `EX-PRT-008.1` Overlapping effective windows → rejected.
- `EX-PRT-008.2` Transaction whose fee version cannot be resolved → reconciliation exception, not a silent recomputation.

**Events** — `partner.fee.versioned`
**Audit** — fee changes with approver.

**Story `US-PRT-008`** — As a finance controller, I want partner fees versioned, so that a transaction from six months ago can be reconciled against the fees that actually applied then.
*Given* a fee change last month, *when* I reconcile an older transaction, *then* the older fee version is used.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PRT-008-1 | POS | Fee version recorded on transactions |
| TC-PRT-008-2 | POS | Historical reconciliation uses the version in force then |
| TC-PRT-008-3 | NEG | Overlapping windows rejected |
| TC-PRT-008-4 | PRM | Fee change requires approval |

---

### BFR-PRT-009 — Onboarding requires approval before activation `P1`

**Acceptance (URS):** Draft partner cannot process production transactions.

**Screens** — Partner onboarding checklist; Approval panel with due diligence evidence.

**Workflow**
1. A partner is created in `DRAFT` and completes an onboarding checklist.
2. Approval by an authorised role, distinct from the creator, moves it to `ACTIVE`.
3. Only then can credentials be used against production.

**API** — `POST /api/admin/v1/partners/{id}/approve` → 200 (approver ≠ creator).

**Data** — `partner.status`, approval record.

**Rules**
- `BR-PRT-009.1` The creator cannot approve their own partner onboarding (`GOV-008` pattern).
- `BR-PRT-009.2` A `DRAFT` partner's credentials do not work against production, even if issued.
- `BR-PRT-009.3` The onboarding checklist (contract, due diligence, technical certification, capability scope) must be complete before approval.
- `BR-PRT-009.4` Approval records who approved, when, and on what evidence.

**Exceptions**
- `EX-PRT-009.1` Draft partner API call → `PERMISSION_DENIED`, audited.
- `EX-PRT-009.2` Self-approval attempt → refused and audited as a control-breach attempt.

**Events** — `partner.approved`, `partner.activated`
**Audit** — approval with evidence references.

**Story `US-PRT-009`** — As a compliance officer, I want partners activated only after independent approval, so that no partner can start processing before due diligence is complete.
*Given* a draft partner, *when* their credentials are used in production, *then* the call is refused.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PRT-009-1 | NEG | Draft partner cannot process production transactions |
| TC-PRT-009-2 | NEG | Self-approval refused |
| TC-PRT-009-3 | NEG | Approval blocked while the checklist is incomplete |
| TC-PRT-009-4 | AUD | Approval recorded with evidence |

---

### BFR-PRT-010 — Offboarding preserves historical records `P1`

**Acceptance (URS):** Deactivation does not remove past transaction evidence.

**Screens** — Partner ▸ Offboard with a pre-check of open items; Offboarded partners remain viewable, marked inactive.

**Workflow**
1. Offboarding pre-checks open transactions, applications, complaints and reconciliation exceptions.
2. On offboarding, new activity stops and users and credentials are disabled.
3. All historical records — transactions, decisions, fees, complaints — remain intact and queryable.

**API** — `POST /api/admin/v1/partners/{id}/offboard` → 200; historical queries continue to resolve the partner.

**Data** — `partner.status = OFFBOARDED`; no deletion anywhere.

**Rules**
- `BR-PRT-010.1` Offboarding is a status change; no partner-related record is ever deleted.
- `BR-PRT-010.2` Historical transactions still resolve the partner's name for display and reporting.
- `BR-PRT-010.3` Open items must be resolved or explicitly transferred before offboarding completes.
- `BR-PRT-010.4` Customers holding products with the partner are handled per the wind-down plan and informed (`SAV-009`, `CAF-006`).
- `BR-PRT-010.5` Partner data retention follows the schedule, independent of offboarding (`BFR-STD-006`).

**Exceptions**
- `EX-PRT-010.1` Offboarding with open items → refused, with the items listed.

**Events** — `partner.offboarded`
**Audit** — offboarding with the open-item check result.

**Story `US-PRT-010`** — As an auditor, I want a departed partner's historical records intact, so that past transactions remain explainable after the relationship ends.
*Given* an offboarded partner, *when* I open a transaction from a year ago, *then* the partner is still named and the record is complete.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-PRT-010-1 | POS | Offboarding stops new activity |
| TC-PRT-010-2 | NEG | No partner-related record deleted |
| TC-PRT-010-3 | POS | Historical transactions still resolve the partner |
| TC-PRT-010-4 | NEG | Offboarding refused while open items remain |
| TC-PRT-010-5 | POS | Customers with live products informed per the wind-down plan |
