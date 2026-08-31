# BFR-REL-001 — Sandbox Release Gates and Evidence Pack

**Realises URS §29 and §30 Step 15.**

> "Sandbox pilot shall not launch until the following are demonstrated." — URS §29

This document turns that sentence into sixteen gates, each with a named owner,
the evidence that satisfies it, and the specific tests or artefacts that produce
that evidence. A gate is **demonstrated**, not asserted: every row below points
at something a reviewer can open.

---

## 1. Gate status at baseline

| | Count |
|---|---:|
| Gates defined | 16 |
| Gates with evidence produced | 0 — design baseline only |
| Gates blocked on an open question | 9 |

Nothing in this document is claimed as met. The programme is at the end of URS
§30 Step 6; Steps 7–15 produce the evidence.

---

## 2. The sixteen gates

### G-01 Identity and KYC
**Owner:** Head of Compliance
**Requirements:** `BFR-ID-001…010`, `BFR-USR-001/002/007`
**Evidence required**
- `E2E-ONBOARD` suite passing end to end
- KYC decision records showing provider provenance for a sample of cases (`ID-009`)
- Tier configuration active with no `PLACEHOLDER` values (`ID-006`)
- Duplicate detection demonstrated on a seeded duplicate (`ID-008`)
- Manual review queue exercised, including an override with reason (`ID-005`)

**Blocked on:** `Q-03` (permitted documents), `Q-04` (tier limits), `Q-19` (IVP contract)

### G-02 Consent
**Owner:** Data Protection Officer
**Requirements:** `BFR-CON-001…010`
**Evidence required**
- `E2E-CONSENT` suite passing, including revocation halting collection
- Demonstration that revocation does **not** delete retained records (`TC-CON-006-2`)
- Disclosure log populated for every partner disclosure in a test window (`CON-009`)
- Consent dashboard showing recipient, purpose, scope and expiry (`CON-007`)

**Blocked on:** the data-protection determination behind `S-10` / `Q-14`

### G-03 Ledger integrity
**Owner:** Finance Controller
**Requirements:** `BFR-LED-001…010`
**Evidence required**
- `E2E-LEDGER` suite passing
- Database grant listing showing no `UPDATE`/`DELETE` on `journal`, `journal_line` (`TC-LED-002-1/2`)
- Concurrency test: N parallel postings, all balanced, no partial rows (`TC-LED-001-4`)
- Static analysis report showing no floating-point on monetary paths (`TC-LED-005-1`)
- Integrity job report over all journals showing zero imbalance (`TC-LED-009-3`)

**Blocked on:** `Q-01`, `Q-02` (legal meaning of the ledger), `Q-11` (currency scale)

### G-04 Payment integrity
**Owner:** Head of Payments
**Requirements:** `BFR-PAY-001…010`, `BFR-NFR-004`
**Evidence required**
- `E2E-PAY` suite passing
- Idempotency proof: N concurrent identical submissions produce exactly one debit (`TC-PAY-009-2`)
- Demonstration that a failed payment never displayed as completed (`TC-PAY-008-1`)
- Fee displayed before authorisation for every payment type (`TC-PAY-006-1`)

**Blocked on:** `Q-12` (fee model), `Q-23` (rail contract)

### G-05 Financial data provenance
**Owner:** Head of Product (Passport)
**Requirements:** `BFR-OF-005/006/009`, `BFR-CAT-008/009`, `BFR-FP-003/008/009`
**Evidence required**
- `E2E-PASSPORT` suite passing
- Every metric in a sample Passport resolving to its sources, consents and retrieval times (`FP-008`)
- Reproduction of a metric from stored inputs and version, matching exactly (`TC-FP-004-6`)
- Demonstration that a model change did not rewrite history (`TC-CAT-009-1/2`)

**Blocked on:** `Q-09` (Passport as regulated credit information), `Q-15`, `Q-16`

### G-06 Audit logging
**Owner:** Head of Security
**Requirements:** `BFR-NFR-006`, `BFR-ADM-010`, `BFR-GOV-010`, `BFR-USR-010`
**Evidence required**
- Audit conformance test applied to every write path, passing
- Hash-chain verification job report (`TC-ADM-010-4`)
- Database grant listing showing no `UPDATE`/`DELETE` on `audit_event`
- Demonstration that an audit write failure rolls back its action (`TC-ADM-010-5`)
- Sample showing sensitive **reads** audited, not only writes (`TC-AML-010-3`)

**Blocked on:** nothing — this gate is achievable now

### G-07 AML baseline
**Owner:** MLRO
**Requirements:** `BFR-AML-001…010`
**Evidence required**
- `E2E-AML` suite passing
- Screening results carrying list source and version (`TC-AML-001-1`)
- Monitoring rules active with documented thresholds, no `PLACEHOLDER`
- Case lifecycle exercised through escalation to a disposition (`AML-008`, `AML-009`)
- Role partition proven: support role cannot reach any AML endpoint (`TC-USR-006-1`)

**Blocked on:** `Q-06` (reporting obligations), `Q-07` (list sources), `Q-17` (thresholds)

### G-08 Fraud baseline
**Owner:** Head of Fraud
**Requirements:** `BFR-FRD-001…010`
**Evidence required**
- `E2E-FRAUD` suite passing
- Step-up demonstrably blocking a transaction at the state machine (`TC-FRD-006-2`)
- Risk assessments reproducible from stored signals and rule-set version (`TC-FRD-005-2`)
- Demonstration that no fraud action deletes a financial record (`TC-FRD-010-1`)

**Blocked on:** `Q-18` (thresholds)

### G-09 Customer complaints
**Owner:** Head of Customer Operations
**Requirements:** `BFR-CMP-001…010`
**Evidence required**
- `E2E-COMPLAINT` suite passing
- SLA clock configured with approved durations, no `PLACEHOLDER`
- Customer-initiated escalation demonstrated (`TC-CMP-009-1`)
- Closure without a resolution category proven impossible (`TC-CMP-008-1/2`)

**Blocked on:** `Q-05` (SLA durations)

### G-10 Sandbox reporting
**Owner:** Head of Regulatory Affairs
**Requirements:** `BFR-RPT-001…010`
**Evidence required**
- `E2E-REPORT` suite passing
- A complete KPI pack generated for a test period, in the approved format
- Reproducibility demonstrated: the same period re-run yields identical figures
- Definition versions printed on every report (`RPT-002`)

**Blocked on:** the regulator's reporting template (part of `Q-06`)

### G-11 Security testing
**Owner:** Head of Security
**Requirements:** `BFR-NFR-001/002/003`, URS §21
**Evidence required**
- Penetration test report with findings remediated or accepted with justification
- CI evidence: secret scanning, SAST, dependency and image scanning all gating
- TLS configuration scan across all production endpoints (`TC-NFR-001-1`)
- Encryption-at-rest confirmation for every production data store (`TC-NFR-002-1`)
- Security monitoring detections demonstrated for each URS §21 signal

**Blocked on:** nothing structurally; requires the environment to exist

### G-12 Reconciliation
**Owner:** Finance Controller
**Requirements:** `BFR-REC-001…010`
**Evidence required**
- `E2E-RECON` suite passing, covering each exception type
- A completed reconciliation run per money-moving partner, with every record matched or excepted (`REC-001`)
- Exception workflow exercised through to an audited resolution (`REC-007`, `REC-008`)
- Source file integrity demonstrated by hash (`REC-009`)

**Blocked on:** `Q-02` (whose books are authoritative), partner file formats

### G-13 Business continuity
**Owner:** Head of Engineering
**Requirements:** URS §22, §23
**Evidence required**
- Documented recovery procedures for all seven URS §22 scenarios
- Executed drill reports: database failover, provider outage, queue failure, restore-and-verify
- Backup monitoring evidence and a periodic restore test result (URS §23)
- RTO/RPO targets agreed with the business and measured in the drills

**Blocked on:** `Q-14` (data location) for the region-outage arrangement

### G-14 Partner readiness
**Owner:** Head of Partnerships
**Requirements:** `BFR-PRT-001…010`
**Evidence required**
- Every live partner `ACTIVE` with independent approval recorded (`PRT-009`)
- Capabilities scoped and credentials issued per partner (`PRT-002`, `PRT-005`)
- Cross-partner isolation proven (`TC-PRT-004-1`)
- Partner health monitoring live (`PRT-006`)
- Signed contracts and technical certification for every production adapter

**Blocked on:** `Q-19`–`Q-28` (all partner contracts)

### G-15 Incident handling
**Owner:** Head of Engineering
**Requirements:** URS §21, §22
**Evidence required**
- Incident management process documented with severity definitions and an on-call rota
- Security alerts routed into it and demonstrated end to end
- At least one incident simulation with a written post-incident review
- Escalation paths to compliance and to the regulator defined

**Blocked on:** nothing — achievable now

### G-16 Data protection controls
**Owner:** Data Protection Officer
**Requirements:** URS §16, §17, `BFR-NFR-002`, `BFR-ADM-004`
**Evidence required**
- Retention schedule configured per data class with legal bases recorded
- Data-subject rights workflows exercised: access, correction, export, objection, deletion
- Role-based masking demonstrated across admin surfaces (`TC-ADM-004-1`)
- Evidence that deletion does not occur where a retention obligation remains (`TC-CON-006-2`)

**Blocked on:** the retention periods behind `Q-01`, `Q-06` and the data-protection determination

---

## 3. Cross-cutting release checks

These run in addition to the sixteen gates, and fail the promotion to
pre-production or production automatically.

| Check | Fails when | Requirement |
|---|---|---|
| **Placeholder check** | Any configuration key still holds a `PLACEHOLDER` value | `BFR-ANA-002` |
| **Traceability gate** | Any P1 requirement lacks a passing test, or a route lacks `x-urs-requirements` | `NFR-010` |
| **Blocking-question check** | A feature flag is on for a requirement whose BLOCKING question is unresolved | `BFR-ANA-002` |
| **Secret scan** | Any credential detected in the repository or its history | `NFR-003` |
| **Float check** | Any floating-point type on a monetary path | `LED-005` |
| **Status-string check** | Any free-text transaction status outside the declared enums | URS §5 |
| **Localisation completeness** | Any user-facing key missing from `rw`, `en` or `fr` | URS §18 |
| **Critical suite** | Any `E2E-*` critical flow suite failing | `NFR-009` |

## 4. Sign-off

Sandbox launch requires all sixteen gates demonstrated, all cross-cutting checks
passing, and every BLOCKING question in `BFR-ANA-002` resolved or its feature
flag off.

| Role | Name | Gates owned | Signature | Date |
|---|---|---|---|---|
| Head of Compliance / MLRO | | G-01, G-07 | | |
| Data Protection Officer | | G-02, G-16 | | |
| Finance Controller | | G-03, G-12 | | |
| Head of Payments | | G-04 | | |
| Head of Product (Passport) | | G-05 | | |
| Head of Security | | G-06, G-11 | | |
| Head of Fraud | | G-08 | | |
| Head of Customer Operations | | G-09 | | |
| Head of Regulatory Affairs | | G-10 | | |
| Head of Engineering | | G-13, G-15 | | |
| Head of Partnerships | | G-14 | | |

**No P1 requirement enters production without successful traceability or a
documented authorised exception** (URS §27). The exceptions register is in
[`BFR-RTM-001`](../07-traceability/BFR-RTM-001-traceability-matrix.md) §7 and is
empty at baseline.
