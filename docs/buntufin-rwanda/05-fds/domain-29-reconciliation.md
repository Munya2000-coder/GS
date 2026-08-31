# BFR-FDS-29 — Domain 29: Reconciliation and Settlement (`REC`)

**Context:** Reconciliation (`recon-svc`) · **Epic:** `EPIC-REC` — Prove that what we recorded is what actually happened
**Wave:** W6 (but exercised from W3) · **Depends on:** `LED`, `PRT` · **Blocking:** `Q-02` (whose books are authoritative)

---

### BFR-REC-001 — External monetary partners reconciled `P1`

**Acceptance (URS):** Internal and partner records can be compared.

**Screens** — Reconciliation ▸ Runs (partner, period, status, counts); Run detail with matched and exception breakdown.

**Workflow**
1. Partner settlement files or API extracts are ingested on a schedule.
2. Records are normalised into a common settlement model.
3. A reconciliation run compares them to ledger journals for the period.
4. Results are matched or become exceptions (`REC-002`…`REC-006`).

**API** — `POST /api/admin/v1/reconciliation/runs` `{partner_id, period}` → 202; `GET .../runs/{id}` → 200.

**Data** — `settlement_file`, `settlement_record`, `recon_run`, `recon_match`, `recon_exception`

**Rules**
- `BR-REC-001.1` Every partner that moves money is reconciled on a defined frequency — reconciliation is scheduled, not ad hoc.
- `BR-REC-001.2` Reconciliation is read-only against the ledger; it raises exceptions, it never corrects the ledger itself (`LED-002`).
- `BR-REC-001.3` A run is idempotent: re-running a period does not duplicate matches or exceptions.
- `BR-REC-001.4` Runs are complete: every internal and partner record in the period is accounted for as matched or as an exception, with no silent remainder.

**Exceptions**
- `EX-REC-001.1` Settlement file missing for a scheduled period → the run is flagged missing and alerted; it is never treated as a clean run.
- `EX-REC-001.2` Malformed file → rejected atomically with row-level feedback; nothing partially ingested.

**Events** — `recon.run.completed`
**Audit** — run parameters, counts and outcomes audited.

**Story `US-REC-001`** — As a finance controller, I want internal records reconciled to every partner, so that we can prove our ledger matches reality.
*Given* a settlement period, *when* the run completes, *then* every record on both sides is either matched or raised as an exception.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-REC-001-1 | POS | Run compares internal and partner records |
| TC-REC-001-2 | IDM | Re-running a period does not duplicate results |
| TC-REC-001-3 | NEG | Missing file flagged, not treated as clean |
| TC-REC-001-4 | NEG | Malformed file rejected atomically |
| TC-REC-001-5 | POS | Every record accounted for; no silent remainder |

---

### BFR-REC-002 — Matched records identified `P1`

**Acceptance (URS):** Matching criteria produce MATCHED status.

**Screens** — Run detail ▸ Matched records with the matching rule applied.

**Workflow**
1. Matching runs in tiers: exact partner reference, then amount plus date plus counterparty, then fuzzy within a tolerance window.
2. Each match records which rule produced it and its confidence.

**API** — `GET /api/admin/v1/reconciliation/runs/{id}/matches` → 200.

**Data** — `recon_match(settlement_record_id, journal_id, rule_applied, confidence)`

**Rules**
- `BR-REC-002.1` Exact reference matching is preferred; fuzzy matching is a fallback and is always labelled as such.
- `BR-REC-002.2` A fuzzy match above the review threshold is confirmed by a human before being treated as final.
- `BR-REC-002.3` One-to-one matching is enforced: a settlement record and a journal each match at most once in a run.
- `BR-REC-002.4` The matching rule and its version are recorded, so a past reconciliation is explainable.

**Exceptions**
- `EX-REC-002.1` Ambiguous match (one record, several candidates) → exception, not an arbitrary pick.

**Events** — none
**Audit** — match confirmations audited.

**Story `US-REC-002`** — As a reconciliation analyst, I want matches produced by explicit rules, so that I can trust an automatic match and review the uncertain ones.
*Given* a settlement record with an exact reference, *when* the run executes, *then* it matches its journal and records the rule used.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-REC-002-1 | POS | Exact reference produces MATCHED |
| TC-REC-002-2 | POS | Fuzzy match labelled and reviewable |
| TC-REC-002-3 | NEG | Ambiguous match becomes an exception |
| TC-REC-002-4 | NEG | One-to-one matching enforced |
| TC-REC-002-5 | POS | Rule and version recorded |

---

### BFR-REC-003 — Amount mismatch identified `P1`

**Acceptance (URS):** Difference is flagged with expected and actual values.

**Screens** — Exception detail showing internal amount, partner amount, difference and currency.

**Workflow**
1. A record matching on reference but differing in amount creates an `AMOUNT_MISMATCH` exception.
2. Both amounts and the difference are shown.
3. Fee-version differences are a common cause and are checked first (`PRT-008`).

**API** — `GET .../exceptions?type=AMOUNT_MISMATCH` → 200.

**Data** — `recon_exception(type, expected_minor, actual_minor, difference_minor, currency)`

**Rules**
- `BR-REC-003.1` Both values and the difference are recorded in minor units — never a rounded or percentage summary (`LED-005`).
- `BR-REC-003.2` No tolerance is applied by default; where a partner's contract defines one, it is configuration and is stated on the exception.
- `BR-REC-003.3` The exception references the fee version in force at the transaction time, since fee mismatches are a frequent cause (`PRT-008`).
- `BR-REC-003.4` Resolution never edits the ledger; it posts a correcting entry (`LED-003`) or accepts the partner's figure with a documented reason.

**Exceptions**
- `EX-REC-003.1` Systematic mismatch across many records → escalated as a partner integration issue rather than resolved record by record.

**Events** — `recon.exception.created`
**Audit** — exception creation and resolution audited.

**Story `US-REC-003`** — As a reconciliation analyst, I want amount differences flagged with both figures, so that I can see immediately whether it is a fee, a rounding or a real break.
*Given* a matched reference with different amounts, *when* the run executes, *then* an exception records both amounts and the exact difference.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-REC-003-1 | POS | Mismatch flagged with expected, actual and difference |
| TC-REC-003-2 | DEC | Difference exact in minor units |
| TC-REC-003-3 | NEG | No implicit tolerance applied |
| TC-REC-003-4 | POS | Fee version referenced on the exception |
| TC-REC-003-5 | NEG | Resolution never edits the ledger |

---

### BFR-REC-004 — Missing internal records identified `P1`

**Acceptance (URS):** Partner-only transaction creates exception.

**Screens** — Exception list ▸ "Partner has it, we do not" with the partner record detail.

**Workflow**
1. A partner record with no internal counterpart creates a `MISSING_INTERNAL` exception.
2. Investigation determines whether it is a timing difference, a lost transaction, or activity BuntuFin did not initiate.

**API** — `GET .../exceptions?type=MISSING_INTERNAL` → 200.

**Data** — `recon_exception(type = MISSING_INTERNAL, settlement_record_id)`

**Rules**
- `BR-REC-004.1` This is the highest-severity exception class: money moved that BuntuFin has no record of.
- `BR-REC-004.2` Cutoff timing differences are eliminated first by checking the adjacent period.
- `BR-REC-004.3` `UNKNOWN` adapter outcomes seed expected exceptions here, so a timed-out submission is anticipated rather than a surprise (`BFR-STD-003`).
- `BR-REC-004.4` A genuine missing internal record triggers an incident, not merely a ticket.

**Exceptions**
- `EX-REC-004.1` Found in the adjacent period → resolved as a timing difference with the linkage recorded.
- `EX-REC-004.2` Not explicable → incident raised; potential unauthorised partner activity is escalated to security and compliance.

**Events** — `recon.exception.created` with high severity.
**Audit** — investigation and resolution audited.

**Story `US-REC-004`** — As a finance controller, I want partner-only transactions flagged immediately, so that money moving without our record is treated as the serious event it is.
*Given* a partner record with no internal match, *when* the run completes, *then* a high-severity exception exists and, if unexplained, an incident is raised.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-REC-004-1 | POS | Partner-only record creates an exception |
| TC-REC-004-2 | POS | Adjacent-period check resolves timing differences |
| TC-REC-004-3 | POS | UNKNOWN adapter outcomes appear here as expected |
| TC-REC-004-4 | INT | Unexplained case raises an incident |

---

### BFR-REC-005 — Missing partner records identified `P1`

**Acceptance (URS):** Internal-only transaction creates exception.

**Screens** — Exception list ▸ "We have it, partner does not" with the internal record detail.

**Workflow**
1. An internal journal with no partner counterpart creates a `MISSING_PARTNER` exception.
2. Investigation determines whether it is timing, a failed submission recorded as successful, or a partner reporting gap.

**API** — `GET .../exceptions?type=MISSING_PARTNER` → 200.

**Data** — `recon_exception(type = MISSING_PARTNER, journal_id)`

**Rules**
- `BR-REC-005.1` Cutoff timing is eliminated first by checking the adjacent period.
- `BR-REC-005.2` A confirmed missing partner record means the platform may have told a customer something completed that did not — this is treated as a customer-impact issue, not only an accounting one (`PAY-008`).
- `BR-REC-005.3` Resolution may require reversing an internal posting through a linked correction (`LED-003`), never by deletion.
- `BR-REC-005.4` Repeated occurrences with one partner feed partner health and performance review (`PRT-006`).

**Exceptions**
- `EX-REC-005.1` Customer was told a payment completed but the partner has no record → treated as a customer-impact incident with proactive contact.

**Events** — `recon.exception.created`
**Audit** — investigation and resolution audited.

**Story `US-REC-005`** — As a finance controller, I want internal-only transactions flagged, so that we discover before the customer does that something we recorded never actually happened.
*Given* an internal journal with no partner record, *when* the run completes, *then* an exception exists and, if confirmed, is handled as a customer-impact incident.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-REC-005-1 | POS | Internal-only record creates an exception |
| TC-REC-005-2 | POS | Adjacent-period check resolves timing |
| TC-REC-005-3 | REV | Resolution by linked reversal, never deletion |
| TC-REC-005-4 | INT | Confirmed case raises a customer-impact incident |

---

### BFR-REC-006 — Duplicate settlement records detected `P1`

**Acceptance (URS):** Duplicate partner reference creates exception.

**Screens** — Exception list ▸ duplicates with all occurrences shown.

**Workflow**
1. A partner reference appearing more than once in a period, or matching more than one journal, creates a `DUPLICATE` exception.
2. Investigation determines whether it is a partner file re-send, a genuine double-payment, or a reference collision.

**API** — `GET .../exceptions?type=DUPLICATE` → 200.

**Data** — `recon_exception(type = DUPLICATE, references[])`

**Rules**
- `BR-REC-006.1` Duplicates are never silently deduplicated — a genuine double-payment and a re-sent file look identical at first and must be distinguished by investigation.
- `BR-REC-006.2` File-level re-sends are detected by file hash before record-level processing (`REC-009`).
- `BR-REC-006.3` A confirmed double-payment is corrected through a linked reversal and, where a customer was affected, through the complaint process.
- `BR-REC-006.4` Reference collisions across partners are impossible by construction, since matching is scoped per partner.

**Exceptions**
- `EX-REC-006.1` Whole file re-sent → detected at ingestion by hash and skipped, with the skip recorded (`REC-009`).

**Events** — `recon.exception.created`
**Audit** — duplicate detection and resolution audited.

**Story `US-REC-006`** — As a reconciliation analyst, I want duplicates flagged rather than removed, so that a genuine double-payment is never hidden by automatic deduplication.
*Given* a repeated partner reference, *when* the run executes, *then* an exception lists every occurrence for investigation.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-REC-006-1 | POS | Duplicate reference creates an exception |
| TC-REC-006-2 | NEG | Duplicates never silently deduplicated |
| TC-REC-006-3 | POS | File re-send detected by hash at ingestion |
| TC-REC-006-4 | REV | Confirmed double-payment corrected by reversal |

---

### BFR-REC-007 — Exception investigation workflow `P1`

**Acceptance (URS):** Exception can be assigned, annotated and resolved.

**Screens** — Exception queue with severity and ageing; Exception detail with both records, notes and resolution actions.

**Workflow**
1. Exceptions are assigned by rule or manually.
2. Analysts annotate as they investigate.
3. Resolution requires a resolution type and, where money moves, an approved corrective action.

**API** — `POST .../exceptions/{id}/assign` → 200; `POST .../notes` → 201; `POST .../resolve` → 200.

**Data** — `recon_exception(status, assignee_id)`, `recon_exception_note`

**Rules**
- `BR-REC-007.1` Every exception has an owner; unassigned exceptions are escalated automatically.
- `BR-REC-007.2` Ageing exceptions escalate on a configured schedule — an unresolved break must not simply persist.
- `BR-REC-007.3` Notes are append-only.
- `BR-REC-007.4` Corrective postings follow the ledger reversal path with approval where configured (`ADM-009`).
- `BR-REC-007.5` Open exception counts and ages are reported to management (`ADM-002`).

**Exceptions**
- `EX-REC-007.1` Exception unresolved beyond its threshold → escalated to finance leadership and reported.

**Events** — `recon.exception.assigned`, `recon.exception.resolved`
**Audit** — assignment, notes and resolution audited.

**Story `US-REC-007`** — As a reconciliation analyst, I want an exception workflow with ownership and ageing, so that breaks are actually worked rather than accumulating.
*Given* an open exception, *when* it ages past its threshold, *then* it escalates automatically.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-REC-007-1 | POS | Exception assigned, annotated and resolved |
| TC-REC-007-2 | POS | Unassigned and ageing exceptions escalate |
| TC-REC-007-3 | SEC | Notes append-only |
| TC-REC-007-4 | PRM | Corrective posting requires approval |

---

### BFR-REC-008 — Resolution audited `P1`

**Acceptance (URS):** Reason and corrective action recorded.

**Screens** — Exception ▸ Resolve with resolution type, reason and any corrective posting reference.

**Workflow**
1. Resolution records the type, the reason, the actor and any corrective posting.
2. The record is immutable.

**API** — `POST .../exceptions/{id}/resolve` `{resolution_type, reason, corrective_journal_id?}` → 200.

**Data** — `recon_exception(resolution_type, resolution_reason, resolved_by, resolved_at, corrective_journal_id)`

**Rules**
- `BR-REC-008.1` A reason is mandatory; "resolved" without an explanation is not permitted.
- `BR-REC-008.2` Resolution types come from a controlled list, so resolution patterns are analysable.
- `BR-REC-008.3` Where a corrective posting was made, its journal id is recorded on the exception, linking the break to its fix (`LED-007`).
- `BR-REC-008.4` Resolutions are immutable; a mistaken resolution is corrected by reopening, which is itself recorded.
- `BR-REC-008.5` Resolution patterns are reviewed periodically to find systemic causes.

**Exceptions**
- `EX-REC-008.1` Resolution without a reason → refused.
- `EX-REC-008.2` Resolution claiming a corrective posting that does not exist → refused.

**Events** — `recon.exception.resolved`
**Audit** — full resolution record.

**Story `US-REC-008`** — As an auditor, I want every reconciliation break's resolution documented, so that I can see how differences were explained and corrected.
*Given* a resolved exception, *when* I inspect it, *then* I see the resolution type, the reason, who resolved it and any corrective posting.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-REC-008-1 | POS | Resolution records type, reason and actor |
| TC-REC-008-2 | NEG | Resolution without a reason refused |
| TC-REC-008-3 | POS | Corrective journal linked |
| TC-REC-008-4 | SEC | Resolution immutable; reopening recorded |

---

### BFR-REC-009 — Settlement file source integrity retained `P1`

**Acceptance (URS):** Original received source/file reference is preserved.

**Screens** — Run detail ▸ Source file with name, hash, received time and ingestion result.

**Workflow**
1. A received file is stored unmodified in encrypted object storage with its hash.
2. Ingestion parses a copy; the original is never altered.
3. Every settlement record links back to its source file and line.

**API** — `GET .../runs/{id}/source` → 200 (metadata; content by authorised, audited download).

**Data** — `settlement_file(filename, sha256, received_at, object_ref, ingest_status)`; `settlement_record.source_line`

**Rules**
- `BR-REC-009.1` The original file is retained unmodified — reconciliation evidence must be traceable to what the partner actually sent.
- `BR-REC-009.2` The file hash detects both re-sends (`REC-006`) and tampering.
- `BR-REC-009.3` Every settlement record cites its source file and line, so any figure can be traced to its origin.
- `BR-REC-009.4` Files are encrypted at rest with restricted, audited access (`NFR-002`).
- `BR-REC-009.5` Files follow the retention schedule (`BFR-STD-006`).

**Exceptions**
- `EX-REC-009.1` Hash matches a previously ingested file → skipped as a re-send, recorded rather than silently ignored.
- `EX-REC-009.2` Hash mismatch against a partner-supplied checksum → rejected and alerted as a potential integrity issue.

**Events** — `settlement.file.received`
**Audit** — receipt, ingestion and every access to the original.

**Story `US-REC-009`** — As an auditor, I want the partner's original file retained and hashed, so that every reconciled figure can be traced to exactly what was received.
*Given* a settlement record, *when* I trace it, *then* I reach its source file and line, and the file's hash proves it is unaltered.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-REC-009-1 | POS | Original file retained unmodified with its hash |
| TC-REC-009-2 | POS | Records trace to file and line |
| TC-REC-009-3 | POS | Re-send detected by hash and recorded |
| TC-REC-009-4 | SEC | File encrypted; access restricted and audited |
| TC-REC-009-5 | NEG | Checksum mismatch rejected and alerted |

---

### BFR-REC-010 — Reconciliation reports exportable `P2`

**Acceptance (URS):** Operations can export unresolved/resolved exceptions.

**Screens** — Reconciliation ▸ Reports with filters and export.

**Workflow**
1. Reports cover run summaries, open exceptions by age and severity, and resolved exceptions by type.
2. Exports follow the standard reporting rules (`RPT-010`).

**API** — `POST /api/admin/v1/reconciliation/reports` → 202; export as `RPT-010`.

**Data** — reconciliation read models.

**Rules**
- `BR-REC-010.1` Open exception ageing is reported, since the age of a break matters as much as its existence.
- `BR-REC-010.2` Reports are reproducible for a given period and definition version (`RPT-010`).
- `BR-REC-010.3` Exports carry the period, definition version and generation time.
- `BR-REC-010.4` Exports are audited and volume-alerted.
- `BR-REC-010.5` Reconciliation status forms part of the sandbox release-gate evidence (`BFR-REL-001`).

**Exceptions**
- `EX-REC-010.1` Report requested for a period with no completed run → refused with an explanation, not an empty file implying a clean period.

**Events** — `report.generated`
**Audit** — generation and export audited.

**Story `US-REC-010`** — As an operations manager, I want reconciliation exceptions exportable with their ages, so that I can evidence control effectiveness to the regulator.
*Given* a period, *when* I export the reconciliation report, *then* open and resolved exceptions are included with ages and resolution types.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-REC-010-1 | POS | Open and resolved exceptions exportable |
| TC-REC-010-2 | POS | Ageing included |
| TC-REC-010-3 | POS | Reproducible for a period |
| TC-REC-010-4 | NEG | No completed run refuses rather than implying a clean period |
| TC-REC-010-5 | AUD | Export audited |
