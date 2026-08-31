# BFR-FDS-20 — Domain 20: FX and Routing Engine (`FX`)

**Context:** FX & Routing (`fx-routing-svc`) · **Epic:** `EPIC-FX` — Route selection that is explainable and not margin-driven
**Wave:** W5 · **Depends on:** `PRT`, `GOV` · **Blocking:** `Q-13` · **Contract-pending:** `Q-24`

---

### BFR-FX-001 — FX quotes from configurable providers `P1`

**Acceptance (URS):** Provider-specific response maps into standard quote model.

**Screens** — Admin ▸ FX providers with health and rate freshness.

**Workflow**
1. The routing service asks eligible providers for a rate via `FXQuoteAdapter`.
2. Each adapter maps the provider response into the standard `FxQuote` model.
3. The customer quote is composed from the selected provider's rate plus the configured margin and fees.

**API** — internal `POST /internal/fx/quote`; `GET /api/admin/v1/fx/providers` → 200.

**Data** — `fx_quote(provider_id, rate, rate_scale, ...)`

**Rules**
- `BR-FX-001.1` No provider-specific type or field name appears outside its adapter.
- `BR-FX-001.2` Every quote records which provider produced its rate, and when the rate was obtained.
- `BR-FX-001.3` Adding a provider is an adapter plus configuration; the quote model does not change.
- `BR-FX-001.4` A provider's rate is never used beyond the freshness window it declares.

**Exceptions**
- `EX-FX-001.1` No provider returns a usable rate → no quote is issued and the corridor reports temporarily unavailable; a stale rate is never substituted.

**Events** — `transfer.quote.created`
**Audit** — provider, raw response reference and latency retained.

**Story `US-FX-001`** — As a platform owner, I want FX providers behind an adapter, so that we can add or change rate sources without touching the quote model.
*Given* a second FX provider, *when* it is configured, *then* its rates flow into the same quote model with no core change.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FX-001-1 | POS | Provider response maps into the standard quote model |
| TC-FX-001-2 | INT | Second provider added by configuration only |
| TC-FX-001-3 | NEG | Stale rate never substituted |
| TC-FX-001-4 | POS | Provider and retrieval time recorded on the quote |

---

### BFR-FX-002 — Multiple routes evaluated `P2`

**Acceptance (URS):** Routing service can compare eligible routes.

**Screens** — Admin ▸ Route decision detail showing every candidate and why each was included or excluded.

**Workflow**
1. All configured routes for the corridor are enumerated.
2. Each is evaluated for eligibility (`FX-003`, `FX-004`, `FX-006`).
3. Eligible routes are scored by the routing policy (`FX-010`); the selection and its rationale are recorded.

**API** — internal; `GET /api/admin/v1/routes/decisions/{id}` → 200.

**Data** — `route_decision`, `route_candidate(eligible, exclusion_reason, score)`

**Rules**
- `BR-FX-002.1` Every candidate is recorded, including excluded ones and the reason for exclusion.
- `BR-FX-002.2` Evaluation is deterministic: the same inputs and policy version produce the same selection.
- `BR-FX-002.3` A single-route corridor still produces a decision record, so the evidence trail is uniform.
- `BR-FX-002.4` Route evaluation never blocks longer than its configured budget; a timeout excludes that candidate rather than failing the quote.

**Exceptions**
- `EX-FX-002.1` No eligible route → no quote; the customer is told the corridor is temporarily unavailable.

**Events** — `route.decision.made`
**Audit** — full candidate set and rationale retained.

**Story `US-FX-002`** — As an operations analyst, I want to see every route considered and why each was excluded, so that a routing outcome can be explained rather than assumed.
*Given* a transfer, *when* I inspect its route decision, *then* I see all candidates, their eligibility and the selection rationale.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FX-002-1 | POS | All candidates recorded with eligibility |
| TC-FX-002-2 | POS | Same inputs produce the same selection |
| TC-FX-002-3 | POS | Single-route corridor still produces a decision record |
| TC-FX-002-4 | ERR | Candidate timeout excludes it without failing the quote |

---

### BFR-FX-003 — Route eligibility considers corridor permissions `P1`

**Acceptance (URS):** Disallowed corridor/provider combination is excluded.

**Screens** — Admin ▸ Corridor ▸ permitted providers.

**Workflow**
1. Corridor configuration lists which providers may serve it.
2. Any provider not permitted is excluded with `CORRIDOR_NOT_PERMITTED`.

**API** — internal eligibility evaluation.

**Data** — corridor permitted-provider list in configuration; `route_candidate.exclusion_reason`

**Rules**
- `BR-FX-003.1` Permission is explicit allow-listing; a provider is not eligible merely because it is capable.
- `BR-FX-003.2` Permission changes are regulated configuration changes (`GOV-008`).
- `BR-FX-003.3` Exclusion for permission reasons is recorded, so a "why wasn't provider X used" question is answerable.
- `BR-FX-003.4` A partner's own capability flags must also permit the operation (`PRT-002`).

**Exceptions**
- `EX-FX-003.1` All providers excluded on permission → no quote; operations alerted, since this usually indicates a misconfiguration.

**Events** — none
**Audit** — permission changes audited.

**Story `US-FX-003`** — As a compliance officer, I want only explicitly permitted providers to serve a corridor, so that a transfer cannot be routed through an unapproved channel.
*Given* a provider not permitted on a corridor, *when* routing evaluates, *then* it is excluded and the reason is recorded.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FX-003-1 | NEG | Unpermitted provider excluded |
| TC-FX-003-2 | POS | Exclusion reason recorded |
| TC-FX-003-3 | PRM | Permission change requires approval |
| TC-FX-003-4 | INT | Partner capability flags also enforced |

---

### BFR-FX-004 — Route eligibility considers transaction limits `P1`

**Acceptance (URS):** Route exceeding provider/customer limit is excluded.

**Screens** — Admin ▸ route decision showing limit-based exclusions.

**Workflow**
1. Each candidate is checked against provider limits, corridor limits and the customer's own limits.
2. Any breach excludes the candidate with `LIMIT_EXCEEDED`.
3. If all candidates are excluded on limits, the customer is told which limit binds.

**API** — internal; the customer-facing error names the binding limit.

**Data** — `limit_rule` (`GOV-006`), `route_candidate.exclusion_reason`

**Rules**
- `BR-FX-004.1` Both provider-side and customer-side limits are evaluated.
- `BR-FX-004.2` The most restrictive binding limit is reported to the customer, with the remaining headroom.
- `BR-FX-004.3` Limits are evaluated against the send amount in a consistent currency.
- `BR-FX-004.4` Pending transfers count against limits until they fail or complete (`GOV-006`).

**Exceptions**
- `EX-FX-004.1` All routes excluded on limits → `LIMIT_EXCEEDED` naming the binding limit, no quote issued.

**Events** — none
**Audit** — exclusions recorded.

**Story `US-FX-004`** — As a compliance officer, I want routes exceeding a limit excluded automatically, so that no transfer is routed through a channel that cannot lawfully carry it.
*Given* an amount above a provider's limit, *when* routing evaluates, *then* that provider is excluded and, if none remain, the customer is told which limit binds.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FX-004-1 | NEG | Over-limit route excluded |
| TC-FX-004-2 | POS | Binding limit reported with headroom |
| TC-FX-004-3 | CON | Pending transfers count against limits |
| TC-FX-004-4 | DEC | Limit comparison exact in minor units |

---

### BFR-FX-005 — Route decision recorded `P1`

**Acceptance (URS):** Chosen provider, rationale inputs and timestamps available.

**Screens** — Admin ▸ Transfer ▸ Routing tab.

**Workflow**
1. The decision records the selected provider, the policy version, the inputs and the timestamp.
2. It is linked to the transfer and the quote.
3. It is immutable.

**API** — `GET /api/admin/v1/transfers/{id}/route-decision` → 200.

**Data** — `route_decision(selected_partner_id, policy_version, inputs, evaluated_at)` append-only

**Rules**
- `BR-FX-005.1` Every executed transfer has exactly one route decision record.
- `BR-FX-005.2` The record is immutable and includes the inputs, so the decision can be replayed.
- `BR-FX-005.3` A re-route (after a failure) creates a new decision linked to the original.
- `BR-FX-005.4` The record is available to compliance without needing engineering support.

**Exceptions**
- `EX-FX-005.1` Missing route decision on an executed transfer → integrity alert; this should be impossible.

**Events** — `route.decision.made`
**Audit** — the record itself; mirrored to audit.

**Story `US-FX-005`** — As a compliance officer, I want every routing decision recorded with its rationale, so that route selection can be reviewed after the fact.
*Given* an executed transfer, *when* I inspect its routing, *then* I see the chosen provider, the policy version, the inputs and the time.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FX-005-1 | POS | Decision recorded with provider, inputs and timestamp |
| TC-FX-005-2 | SEC | Record immutable |
| TC-FX-005-3 | POS | Replay from inputs reproduces the decision |
| TC-FX-005-4 | POS | Re-route creates a linked new decision |

---

### BFR-FX-006 — Provider outage affects route eligibility `P1`

**Acceptance (URS):** Unhealthy route is excluded or transaction held.

**Screens** — Admin ▸ Provider health dashboard with current state and recent error rates.

**Workflow**
1. Adapters report success, failure and latency; a circuit breaker maintains health state.
2. An unhealthy provider is excluded from routing.
3. If no healthy provider remains, transfers are held rather than routed into a failing channel.

**API** — `GET /api/admin/v1/providers/health` → 200.

**Data** — `provider_health(state, error_rate, last_success_at, opened_at)`

**Rules**
- `BR-FX-006.1` Health is measured from real call outcomes, not only from a heartbeat endpoint.
- `BR-FX-006.2` An unhealthy provider is excluded automatically, without waiting for an operator.
- `BR-FX-006.3` Recovery is gradual (half-open), so a flapping provider does not immediately take full volume.
- `BR-FX-006.4` With no healthy route, transfers are held and the customer told, rather than being submitted into a failing channel.

**Exceptions**
- `EX-FX-006.1` All providers unhealthy → corridor reports temporarily unavailable; queued transfers hold; operations paged.

**Events** — `provider.health.changed`
**Audit** — health transitions recorded.

**Story `US-FX-006`** — As an operations manager, I want failing providers taken out of routing automatically, so that customers are not sent into a channel we already know is broken.
*Given* a provider whose error rate breaches its threshold, *when* routing evaluates, *then* it is excluded until it recovers.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FX-006-1 | POS | Unhealthy provider excluded automatically |
| TC-FX-006-2 | POS | Half-open recovery limits volume |
| TC-FX-006-3 | NEG | No healthy route holds transfers, does not submit them |
| TC-FX-006-4 | INT | Health derived from real call outcomes |

---

### BFR-FX-007 — Rate fixed after valid quote acceptance `P1`

**Acceptance (URS):** Execution rejects expired/invalidated quote.

**Screens** — Accepted quote shows the locked rate and its execution deadline.

**Workflow**
1. Acceptance binds the transfer to that quote.
2. Execution re-validates the quote's validity and integrity.
3. Any change requires an explicit customer re-quote — never a silent reprice.

**API** — execution returns `QUOTE_EXPIRED` for an expired or invalidated quote.

**Data** — `fx_quote` immutable once issued; `transfer.fx_quote_id`

**Rules**
- `BR-FX-007.1` A quote is immutable; there is no update path for a rate.
- `BR-FX-007.2` The customer's rate cannot change after valid acceptance without an explicit re-quote they see and accept.
- `BR-FX-007.3` A provider withdrawing a rate invalidates the quote; the customer is offered a re-quote or a refund — the platform does not absorb or impose the difference silently.
- `BR-FX-007.4` Execution validates that the quote belongs to this transfer and this customer.

**Exceptions**
- `EX-FX-007.1` Provider withdraws the rate after acceptance → transfer held, customer offered re-quote or refund (interacts with `Q-14`).
- `EX-FX-007.2` Quote/transfer mismatch → refused and logged as a security event.

**Events** — `transfer.quote.invalidated`
**Audit** — invalidations and re-quotes recorded.

**Story `US-FX-007`** — As a sender, I want the rate I accepted to be the rate applied, so that what I agreed to is what happens.
*Given* an accepted quote, *when* execution occurs within its validity, *then* the accepted rate applies exactly.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FX-007-1 | POS | Accepted rate applied at execution |
| TC-FX-007-2 | NEG | Expired or invalidated quote rejected |
| TC-FX-007-3 | SEC | Quote cannot be reused across transfers or customers |
| TC-FX-007-4 | NEG | No silent reprice; re-quote is explicit |

---

### BFR-FX-008 — Deterministic FX rounding `P1`

**Acceptance (URS):** Same inputs and quote produce same amount calculation.

**Screens** — n/a (a calculation guarantee, surfaced through consistent figures).

**Workflow**
1. The quote persists its rate, scale, rounding mode and the order of operations.
2. Execution recomputes from the persisted quote and must reproduce the stored amounts exactly.
3. A mismatch halts execution.

**API** — quote responses include `rate_scale` and `rounding_mode`.

**Data** — `fx_quote.rounding_mode`, `rate_scale`, both amounts stored

**Rules**
- `BR-FX-008.1` Rounding mode, precision and the order of operations are attributes **of the quote**, so a replay is exact.
- `BR-FX-008.2` All arithmetic is in minor units (`LED-005`).
- `BR-FX-008.3` Fee application order relative to conversion is fixed and recorded — it materially changes the result.
- `BR-FX-008.4` Recomputation at execution must match the stored amounts; a mismatch is an integrity failure, not a rounding tolerance.

**Exceptions**
- `EX-FX-008.1` Recomputation mismatch → execution halted, incident raised. There is no tolerance band.

**Events** — none
**Audit** — quote calculation attributes retained.

**Story `US-FX-008`** — As a finance controller, I want FX arithmetic to be exactly reproducible, so that a transfer can be recomputed months later and match to the last minor unit.
*Given* a stored quote, *when* its calculation is replayed, *then* the result matches exactly.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FX-008-1 | DEC | Replay reproduces stored amounts exactly |
| TC-FX-008-2 | DEC | Rounding mode and order persisted and applied |
| TC-FX-008-3 | DEC | Fee/conversion order fixed and recorded |
| TC-FX-008-4 | ERR | Mismatch halts execution with no tolerance band |

---

### BFR-FX-009 — Manual routing disablement `P1`

**Acceptance (URS):** Operations can disable provider/corridor.

**Screens** — Admin ▸ Routing ▸ disable provider or corridor with a mandatory reason; active disablements banner.

**Workflow**
1. An authorised operator disables a provider or a provider-corridor pair with a reason.
2. Routing excludes it immediately.
3. Re-enabling requires a second approver (`GOV-009` pattern).

**API** — `POST /api/admin/v1/routes/disable` → 200; `POST /api/admin/v1/routes/enable` → 200 (second approver).

**Data** — routing disablement flags in configuration.

**Rules**
- `BR-FX-009.1` Disablement is immediate and requires no deployment.
- `BR-FX-009.2` A reason is mandatory; the action is audited and alerted.
- `BR-FX-009.3` Re-enabling requires a second person — stopping is fast, restarting is deliberate.
- `BR-FX-009.4` In-flight transfers already submitted follow their normal course; disablement affects new routing only.

**Exceptions**
- `EX-FX-009.1` Disabling the last route on a corridor → permitted, with an explicit warning that the corridor becomes unavailable.

**Events** — `route.disabled`, `route.enabled`
**Audit** — actor, target, reason, duration.

**Story `US-FX-009`** — As an operations manager, I want to remove a provider from routing immediately, so that I can respond to a problem faster than a deployment allows.
*Given* a disabled provider, *when* routing evaluates, *then* it is excluded, and re-enabling requires a second approver.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FX-009-1 | POS | Disablement excludes the provider immediately |
| TC-FX-009-2 | NEG | Disablement without a reason refused |
| TC-FX-009-3 | PRM | Re-enable requires a second approver |
| TC-FX-009-4 | POS | In-flight transfers unaffected |
| TC-FX-009-5 | AUD | Action audited and alerted |

---

### BFR-FX-010 — Routing not optimised solely for BuntuFin margin `P1`

**Acceptance (URS):** Routing policy supports customer/regulatory criteria and is documented.

**Screens** — Admin ▸ Routing policy (documented criteria and weights); Customer-facing explanation of how routing is decided.

**Workflow**
1. The routing policy is versioned configuration with documented criteria.
2. Criteria may include landed amount to the recipient, speed, reliability, corridor compliance and provider health.
3. The policy version is recorded on every decision.

**API** — `GET /api/admin/v1/routing-policy` → 200; `GET /api/v1/routing-explanation` → 200 (plain-language, customer-facing).

**Data** — routing policy in `config_version`; `route_decision.policy_version`

**Rules**
- `BR-FX-010.1` **BuntuFin margin is not an input to the routing score.** The policy schema does not accept a margin term, and a test asserts its absence — mirroring `CAP-009`.
- `BR-FX-010.2` The policy is documented, versioned and approved (`GOV-008`).
- `BR-FX-010.3` A plain-language explanation of routing criteria is available to customers.
- `BR-FX-010.4` The policy version applied is recorded on every decision, so past routing can be explained.
- `BR-FX-010.5` Where two routes are materially equivalent for the customer, a documented tie-break applies and is recorded.

**Exceptions**
- `EX-FX-010.1` Attempt to configure a margin term as a routing input → rejected by schema validation and alerted.

**Events** — none
**Audit** — policy changes approved and audited.

**Story `US-FX-010`** — As a regulator, I want routing decided on customer and compliance criteria rather than on BuntuFin's margin, so that customers are not routed to whichever channel is most profitable for the platform.
*Given* the routing policy, *when* I inspect its inputs, *then* margin is not among them, and the applied policy version is recorded on every decision.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-FX-010-1 | SEC | Policy schema rejects a margin term |
| TC-FX-010-2 | POS | Documented criteria drive selection |
| TC-FX-010-3 | POS | Policy version recorded on every decision |
| TC-FX-010-4 | POS | Customer-facing explanation available |
| TC-FX-010-5 | POS | Tie-break documented and recorded |
