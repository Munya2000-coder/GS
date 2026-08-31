# BFR-STD-006 — Data Retention and Customer Data Rights

**Realises URS §16 and §17**, and requirements `CON-006`, `NFR-002`, `NFR-006`.

> Retention **periods** are a legal determination and are held as configuration,
> seeded with `PLACEHOLDER` values pending legal confirmation
> (`BFR-ANA-002` Q-01, Q-06, and the data protection question in `S-10`/`Q-14`).
> The **mechanism** below is built and testable now.

## 1. Retention schedule (URS §16)

Each data class has a `retention_policy` row: `class`, `retention_period`,
`legal_basis_ref`, `disposal_method`, `review_frequency`, `owner_role`.

| Data class | Contents | Disposal | Requirement |
|---|---|---|---|
| Customer identity | `customer`, `identity_document` | Anonymise non-retained fields; retain the identity spine while any retention obligation runs | `ID-003`, `CON-006` |
| KYC evidence | `kyc_case`, `identity_evidence`, provider raw responses | Secure deletion from object store; the decision record survives longer than the raw evidence | `ID-009` |
| Financial transactions | `journal`, `journal_line`, `payment`, `transfer` | **Never deleted while any financial-record obligation runs**; disposal only by approved, audited process | `LED-002` |
| Consent | `consent`, `consent_scope`, `disclosure_log` | Retained independently of revocation — revocation stops processing, it does not erase the record | `CON-006`, `CON-009` |
| Passport calculations | `passport_metric`, `passport_metric_source`, shares and access logs | Metrics may expire and be superseded; the access log is retained as evidence | `FP-009`, `FPS-006` |
| Audit | `audit_event` | Longest retention of any class; disposal requires dual approval and is itself audited | `NFR-006` |
| AML | screening results, alerts, cases, notes | Retained per the AML retention period; never deleted while a case is open | `AML-010` |
| Fraud | risk events, alerts, dispositions | Retained for rule improvement (`FRD-009`) | `FRD-009` |
| Complaints | complaints, notes, SLA history | Retained per consumer-protection obligation | `CMP-010` |
| Partner records | partner profiles, credentials metadata, fee versions | Preserved on offboarding — deactivation never deletes history | `PRT-010` |
| System logs | application, access and security logs | Time-boxed; security-relevant logs retained longer | URS §21 |

### Binding rules

1. **Deletion never occurs where a legal or regulatory retention obligation
   remains** (URS §16). The retention engine evaluates *every* applicable
   obligation and takes the longest.
2. **Revocation ≠ erasure** (`CON-006`). Revoking consent stops future
   processing and future collection; it does not trigger deletion of records
   held under a retention obligation. The two are separate flags on separate
   tables, and the distinction is tested (`TC-CON-006-*`).
3. **Legal hold** overrides every disposal schedule; a record under hold cannot
   be disposed of by any automated path.
4. Disposal runs are themselves audited: what class, how many records, under
   which policy version, approved by whom.

## 2. Customer data rights (URS §17)

Workflows owned by `support-svc`, entity `data_request`:

| Right | Workflow | Requirement |
|---|---|---|
| Data access request | Assemble the customer's held data across contexts into a controlled export | URS §17 |
| Correction request | Route to the owning context; for imported financial data, correction is an **overlay**, never an edit of the source record | `CAT-003`, `FH-009`, `OF-006` |
| Consent withdrawal | Delegates to `consent-svc`; halts collection and revokes dependent shares | `CON-005`, `FPS-007` |
| Objection / restriction of processing | Sets a processing restriction that the calculation engines honour | URS §17 |
| Data export | Machine-readable export of the customer's own data | `FPS-009`, URS §17 |
| Deletion request | Evaluated against retention obligations; where deletion cannot be performed, the customer receives a reasoned response naming the obligation | URS §16/§17 |

### Mandatory request attributes (URS §17)

`reference` (unique, customer-visible), `status`, `owner` (assigned staff role),
`submitted_at`, `due_at` (from configured SLA), `resolution`, plus an
append-only note trail. Requests are reportable in aggregate (`RPT-009`).

## 3. Data protection controls

| Control | Implementation | Requirement |
|---|---|---|
| Encryption in transit | TLS on every endpoint, internal and external | `NFR-001` |
| Encryption at rest | Storage-level encryption plus column-level encryption for identity fields, document numbers and contact details | `NFR-002` |
| Key management | Managed KMS; keys rotated on schedule; no key material in source or config files | `NFR-003` |
| Masking | Role-based, applied server-side before serialisation; masked in logs, events and exports | `ADM-004` |
| Minimisation | Passport shares carry only the selected sections (`FPS-002`); events carry references, not payloads |
| Purpose limitation | Every read of customer financial data resolves a consent purpose (`CON-003`) |
| Non-production data | Production data is not routinely copied downward; synthetic or anonymised data is used (URS §24) |
| Data location | Determined by `Q-14`; the architecture supports a single-region-in-country deployment without redesign |
