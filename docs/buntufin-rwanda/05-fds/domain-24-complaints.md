# BFR-FDS-24 — Domain 24: Complaints and Disputes (`CMP`)

**Context:** Support (`support-svc`) · **Epic:** `EPIC-CMP` — Every customer can be heard, on the clock, with a recorded outcome
**Wave:** W6 · **Depends on:** `PAY`, `PRT`, `GOV` · **Parameterised:** `Q-05` (SLA durations)

---

### BFR-CMP-001 — Customer submits complaint `P1`

**Acceptance (URS):** Complaint receives unique reference.

**Screens** — Help ▸ Raise an issue (category, description, attachments); Confirmation with the reference; My issues list.

**Workflow**
1. The customer raises a complaint, optionally from within a transaction (which attaches the reference automatically).
2. A unique human-readable reference is issued and shown immediately.
3. The SLA clock starts (`CMP-005`) and the complaint is queued for assignment.

**API** — `POST /api/v1/complaints` → 201 `{reference, sla_due_at}`; `GET /api/v1/complaints` → 200.

**Data** — `complaint(reference UNIQUE, category_id, channel, description, status, sla_due_at)`

**Rules**
- `BR-CMP-001.1` A reference is issued at creation and shown to the customer immediately — never later by email only.
- `BR-CMP-001.2` Complaints can be raised through app, web, USSD and assisted channels, and the channel is recorded.
- `BR-CMP-001.3` A complaint can be raised even by a restricted or suspended customer — access to redress is never withdrawn as part of a restriction.
- `BR-CMP-001.4` Free-text and attachments are treated as untrusted input: sanitised, size-limited and scanned.

**Exceptions**
- `EX-CMP-001.1` Submission failure → the customer is given an alternative channel; a complaint is never silently lost.
- `EX-CMP-001.2` Duplicate submission (same customer, subject, short window) → linked to the existing complaint rather than creating a second.

**Events** — `complaint.created`
**Audit** — creation with channel and actor.

**Story `US-CMP-001`** — As a customer with a problem, I want to raise it and get a reference immediately, so that I know it exists and can follow it up.
*Given* a problem, *when* I submit a complaint, *then* I receive a unique reference straight away and can see its due date.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CMP-001-1 | POS | Complaint created with a unique reference shown immediately |
| TC-CMP-001-2 | POS | Restricted customer can still complain |
| TC-CMP-001-3 | POS | Duplicate links to the existing complaint |
| TC-CMP-001-4 | SEC | Free text and attachments sanitised and scanned |
| TC-CMP-001-5 | POS | Raiseable through every supported channel |

---

### BFR-CMP-002 — Configurable complaint categories `P2`

**Acceptance (URS):** New category can be added administratively.

**Screens** — Admin ▸ Complaint categories (add, rename, deprecate, map to routing and SLA).

**Workflow**
1. Categories are reference data with routing and SLA attributes.
2. A new category is added administratively and becomes selectable immediately.
3. Deprecated categories stop being offered but keep resolving historically.

**API** — `GET /api/v1/complaint-categories` → 200; `POST /api/admin/v1/complaint-categories` → 201.

**Data** — `complaint_category(code, name_key, routing_role, sla_hours, is_active)`

**Rules**
- `BR-CMP-002.1` Categories are data, not code.
- `BR-CMP-002.2` Category names are localisation keys, available in all supported languages.
- `BR-CMP-002.3` Each category maps to a routing target and an SLA (`CMP-005`).
- `BR-CMP-002.4` Regulatory reporting categories are maintained separately from customer-facing wording, so reporting stays stable while the wording improves (`CMP-010`).

**Exceptions**
- `EX-CMP-002.1` Deleting a category in use → refused; deprecation offered.

**Events** — `complaint.category.changed`
**Audit** — category changes audited.

**Story `US-CMP-002`** — As a support manager, I want to add complaint categories administratively, so that the taxonomy reflects what customers actually report.
*Given* a new category, *when* I add it, *then* it becomes selectable with its routing and SLA, without a release.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CMP-002-1 | POS | New category usable without deployment |
| TC-CMP-002-2 | POS | Routing and SLA applied from the category |
| TC-CMP-002-3 | NEG | In-use category cannot be deleted |
| TC-CMP-002-4 | POS | Names render in all supported languages |

---

### BFR-CMP-003 — Complaint may link to transaction `P1`

**Acceptance (URS):** Relevant payment/transfer reference can be attached.

**Screens** — Transaction ▸ "Report a problem with this"; Complaint detail showing the linked transaction.

**Workflow**
1. Raising from a transaction attaches its reference automatically.
2. Raising separately allows selection from recent transactions.
3. The linked transaction's detail is available to the handling agent immediately.

**API** — `POST /api/v1/complaints` with `transaction_ref`; `GET /api/admin/v1/complaints/{id}` includes the transaction summary.

**Data** — `complaint.transaction_ref`

**Rules**
- `BR-CMP-003.1` The customer never has to type a transaction reference when raising from the transaction itself.
- `BR-CMP-003.2` The agent sees the transaction's lifecycle and ledger references without leaving the complaint (`ADM-005`, `LED-007`).
- `BR-CMP-003.3` A customer can only link their own transactions.
- `BR-CMP-003.4` Linking never alters the transaction.

**Exceptions**
- `EX-CMP-003.1` Linking another customer's transaction → `404`.

**Events** — none
**Audit** — link recorded.

**Story `US-CMP-003`** — As a customer, I want to complain about a specific payment directly from it, so that support knows exactly which transaction I mean.
*Given* a problematic payment, *when* I report it from the transaction, *then* the complaint carries its reference automatically.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CMP-003-1 | POS | Transaction reference attached automatically |
| TC-CMP-003-2 | PRM | Cannot link another customer's transaction |
| TC-CMP-003-3 | POS | Agent sees the full transaction lifecycle |
| TC-CMP-003-4 | NEG | Linking does not alter the transaction |

---

### BFR-CMP-004 — Complaint may link to partner `P2`

**Acceptance (URS):** Institution/provider reference retained.

**Screens** — Complaint detail showing the partner and who is handling it; Admin ▸ complaints by partner.

**Workflow**
1. Where a complaint concerns a partner's product or decision, the partner reference is attached.
2. Referral to the partner is tracked; BuntuFin's record stays open until the outcome is known (`CAF-010`).

**API** — `POST /api/v1/complaints` with `partner_id`; `GET /api/admin/v1/complaints?partner_id=` → 200.

**Data** — `complaint.partner_id`, referral tracking fields

**Rules**
- `BR-CMP-004.1` Referral does not close BuntuFin's record.
- `BR-CMP-004.2` The customer is always told who is handling their complaint and how to escalate.
- `BR-CMP-004.3` Partner complaint volumes and outcomes are reportable and feed partner monitoring (`PRT-006`, `RPT-009`).
- `BR-CMP-004.4` Only the information necessary for the partner to investigate is shared, under the existing consent (`CON-001`).

**Exceptions**
- `EX-CMP-004.1` Partner unresponsive → escalated internally and reflected in partner monitoring.

**Events** — `complaint.referred`
**Audit** — referral, what was shared and the outcome.

**Story `US-CMP-004`** — As a customer with a problem about a partner's product, I want BuntuFin to keep tracking it, so that I am not passed away and forgotten.
*Given* a complaint referred to a partner, *when* I check its status, *then* it is still open with BuntuFin and shows who is handling it.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CMP-004-1 | POS | Partner reference retained and displayed |
| TC-CMP-004-2 | NEG | Referral does not close the BuntuFin record |
| TC-CMP-004-3 | SEC | Only necessary information shared with the partner |
| TC-CMP-004-4 | POS | Partner volumes reportable |

---

### BFR-CMP-005 — SLA tracking `P1`

**Acceptance (URS):** Due date calculated from configured rules.

**Screens** — Complaint shows its due date; Admin queue sorted by SLA risk with breach indicators.

**Workflow**
1. On creation, the SLA due date is computed from the category's configured rules.
2. The clock pauses only for defined reasons (awaiting customer information), and the pause is recorded.
3. Approaching and breached SLAs escalate (`CMP-009`).

**API** — complaint responses include `sla_due_at`, `sla_status`.

**Data** — `sla_clock(started_at, due_at, paused_intervals[], breached_at)`

**Rules**
- `BR-CMP-005.1` SLA durations are configuration; values remain `PLACEHOLDER` until `Q-05` is answered.
- `BR-CMP-005.2` The clock pauses only for defined, recorded reasons — it can never be paused to conceal a breach.
- `BR-CMP-005.3` Breaches are recorded permanently and reported, not cleared on resolution.
- `BR-CMP-005.4` The customer sees the due date, so the commitment is visible to them, not only internally.

**Exceptions**
- `EX-CMP-005.1` Breach → escalation triggered automatically (`CMP-009`) and the customer is updated.

**Events** — `complaint.sla.at_risk`, `complaint.sla.breached`
**Audit** — clock pauses and breaches audited.

**Story `US-CMP-005`** — As a customer, I want to know by when my complaint will be answered, so that the commitment is explicit rather than open-ended.
*Given* a new complaint, *when* it is created, *then* I see its due date, and any pause in the clock is recorded with a reason.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CMP-005-1 | POS | Due date computed from configuration |
| TC-CMP-005-2 | POS | Pause only for defined recorded reasons |
| TC-CMP-005-3 | NEG | Breach cannot be cleared by pausing retrospectively |
| TC-CMP-005-4 | POS | Breach recorded permanently and reported |
| TC-CMP-005-5 | NEG | Placeholder SLA values block the release gate |

---

### BFR-CMP-006 — Customer sees complaint status `P2`

**Acceptance (URS):** OPEN/INVESTIGATING/etc. shown in plain language.

**Screens** — My issues list with plain-language status and last update; Complaint detail with a timeline.

**Workflow**
1. Status changes are recorded and surfaced to the customer.
2. Statuses are shown in plain language in the customer's own language.
3. Each update says what happens next.

**API** — `GET /api/v1/complaints/{id}` → 200 with `status`, `status_text_key`, `history[]`.

**Data** — `complaint.status`, status history

**Rules**
- `BR-CMP-006.1` Internal workflow states map to customer-facing plain language; internal jargon is never shown.
- `BR-CMP-006.2` Every status change is visible to the customer within the configured time.
- `BR-CMP-006.3` Status uses icon and text, not colour alone (URS §20).
- `BR-CMP-006.4` The customer can see the full history of their complaint, not only its current state.

**Exceptions**
- `EX-CMP-006.1` Internal-only state (for example fraud referral) → shown to the customer as a neutral "under investigation", without disclosing the fraud dimension.

**Events** — `complaint.status.changed`
**Audit** — status changes audited.

**Story `US-CMP-006`** — As a customer, I want to see where my complaint stands in language I understand, so that I do not have to chase for information.
*Given* an investigating complaint, *when* I open it, *then* I see its plain-language status and what happens next.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CMP-006-1 | POS | Status shown in plain language, all supported languages |
| TC-CMP-006-2 | SEC | Internal-only detail not disclosed |
| TC-CMP-006-3 | POS | Icon and text used, not colour alone |
| TC-CMP-006-4 | POS | Full history visible to the customer |

---

### BFR-CMP-007 — Staff record investigation activity `P1`

**Acceptance (URS):** Notes and actions are timestamped.

**Screens** — Complaint ▸ internal notes timeline; Add note (internal or customer-visible).

**Workflow**
1. Agents record notes and actions as they investigate.
2. Notes are marked internal or customer-visible.
3. All entries are timestamped and attributed.

**API** — `POST /api/admin/v1/complaints/{id}/notes` `{body, visibility}` → 201.

**Data** — `complaint_note(author_id, body, visibility, created_at)` append-only

**Rules**
- `BR-CMP-007.1` Notes are append-only; corrections are new notes.
- `BR-CMP-007.2` Visibility is explicit at creation, so an internal note is never accidentally shown to the customer.
- `BR-CMP-007.3` A customer's data-access request may include customer-visible notes; internal notes follow the applicable rules on internal records.
- `BR-CMP-007.4` Notes referencing another customer's data are prohibited by policy and by masking.

**Exceptions**
- `EX-CMP-007.1` Attempt to edit or delete a note → `PERMISSION_DENIED`, audited.

**Events** — none
**Audit** — note creation audited.

**Story `US-CMP-007`** — As a support agent, I want to record what I did and when, so that whoever picks up the case next has the full picture.
*Given* an investigation, *when* I add notes, *then* they persist with my name and the time and cannot be altered.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CMP-007-1 | POS | Notes persist with author and timestamp |
| TC-CMP-007-2 | SEC | Notes cannot be edited or deleted |
| TC-CMP-007-3 | SEC | Internal notes never shown to the customer |
| TC-CMP-007-4 | PRM | Only assigned or authorised staff can add notes |

---

### BFR-CMP-008 — Resolution records outcome `P1`

**Acceptance (URS):** Case cannot close without resolution category.

**Screens** — Resolve complaint ▸ resolution category (controlled list), outcome summary, any remedy applied.

**Workflow**
1. Resolution requires a category from the controlled list plus a summary.
2. Any remedy (refund, correction, apology, explanation) is recorded and linked to its transaction where applicable.
3. The customer is notified of the outcome.

**API** — `POST /api/admin/v1/complaints/{id}/resolve` `{resolution_category_id, summary, remedy?}` → 200.

**Data** — `complaint.resolution_category_id`; **CHECK: closure requires it**

**Rules**
- `BR-CMP-008.1` The constraint is enforced at the database level, not only in the application.
- `BR-CMP-008.2` Resolution categories are controlled, so outcomes are analysable for regulatory reporting (`CMP-010`).
- `BR-CMP-008.3` A financial remedy is executed through the normal ledger path with a linked reference — never as an untraceable adjustment (`LED-003`).
- `BR-CMP-008.4` The customer is notified with the outcome and the route to escalate if dissatisfied.

**Exceptions**
- `EX-CMP-008.1` Closure without a resolution category → refused by application and database.
- `EX-CMP-008.2` Customer disputes the resolution → reopened or escalated (`CMP-009`), never simply re-closed.

**Events** — `complaint.resolved`
**Audit** — resolution, remedy and actor.

**Story `US-CMP-008`** — As a customer, I want a recorded outcome to my complaint, so that I know what was decided and what to do if I disagree.
*Given* a complaint, *when* it is closed without a resolution category, *then* closure is refused.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CMP-008-1 | NEG | Closure without resolution category refused |
| TC-CMP-008-2 | SEC | Database constraint enforces it |
| TC-CMP-008-3 | POS | Financial remedy posts through the ledger with a link |
| TC-CMP-008-4 | POS | Customer notified with escalation route |
| TC-CMP-008-5 | POS | Reopening supported and recorded |

---

### BFR-CMP-009 — Escalation supported `P1`

**Acceptance (URS):** Overdue or serious complaint can move to higher level.

**Screens** — Complaint ▸ Escalate; Escalation queue; customer-facing "escalate my complaint" action.

**Workflow**
1. Escalation is triggered by an agent, by the customer, or automatically on SLA breach or severity.
2. The complaint routes to the configured higher level; ownership transfers.
3. Escalation history is retained.

**API** — `POST /api/admin/v1/complaints/{id}/escalate` → 200; `POST /api/v1/complaints/{id}/escalate` → 200 (customer-initiated).

**Data** — `complaint_escalation(from, to_role, reason, escalated_at)`

**Rules**
- `BR-CMP-009.1` The **customer** can escalate, not only staff — otherwise escalation depends on the party being complained about.
- `BR-CMP-009.2` SLA breach escalates automatically (`CMP-005`).
- `BR-CMP-009.3` Escalation targets a role, so it never depends on one person's availability.
- `BR-CMP-009.4` The customer is told about any external redress route where one applies (`Q-05`).

**Exceptions**
- `EX-CMP-009.1` Escalation at the highest internal level → the external redress route is provided.

**Events** — `complaint.escalated`
**Audit** — escalations recorded with trigger and reason.

**Story `US-CMP-009`** — As a dissatisfied customer, I want to escalate my complaint myself, so that I am not dependent on the goodwill of whoever is handling it.
*Given* an unresolved complaint, *when* I escalate it, *then* it moves to a higher level and the escalation is recorded.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CMP-009-1 | POS | Customer-initiated escalation works |
| TC-CMP-009-2 | POS | SLA breach escalates automatically |
| TC-CMP-009-3 | POS | Escalation targets a role |
| TC-CMP-009-4 | POS | External redress route provided at the top level |
| TC-CMP-009-5 | AUD | Escalation history retained |

---

### BFR-CMP-010 — Complaint reporting supports regulatory metrics `P1`

**Acceptance (URS):** Volumes, categories and resolution times exportable.

**Screens** — Admin ▸ Complaint reporting: volumes by category, channel, partner, outcome, resolution time distribution, SLA performance.

**Workflow**
1. The reporting service builds complaint metrics from complaint events.
2. Reports are generated per period and exported in approved formats (`RPT-010`).
3. The report definition version is printed on every output.

**API** — `POST /api/admin/v1/reports/complaints` → 202; `GET .../reports/{id}` → 200.

**Data** — reporting read models over complaint data.

**Rules**
- `BR-CMP-010.1` Reporting uses stable regulatory categories, insulated from customer-facing wording changes (`CMP-002`).
- `BR-CMP-010.2` Resolution time is measured on the same basis as the SLA, including pauses, and the basis is stated.
- `BR-CMP-010.3` SLA breaches are reported, not suppressed.
- `BR-CMP-010.4` Reports are reproducible: the same period and definition version produce the same figures.
- `BR-CMP-010.5` Report generation and export are audited (`ADM-004`, URS §21).

**Exceptions**
- `EX-CMP-010.1` Period with no complaints → a nil report is produced, not an absent one.

**Events** — `report.generated`
**Audit** — generation and export audited.

**Story `US-CMP-010`** — As a compliance officer, I want complaint volumes, categories and resolution times exportable, so that regulatory reporting is a routine extract rather than a manual exercise.
*Given* a reporting period, *when* I generate the complaints report, *then* I get volumes, categories, resolution times and SLA performance in an approved format.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CMP-010-1 | POS | Report produces volumes, categories, resolution times |
| TC-CMP-010-2 | POS | Reproducible for the same period and version |
| TC-CMP-010-3 | NEG | SLA breaches not suppressed |
| TC-CMP-010-4 | POS | Nil report produced for an empty period |
| TC-CMP-010-5 | AUD | Generation and export audited |
