# BFR-DAT-001 — Entity Relationship Model

**Realises URS §30 Step 3.** Entities are grouped by bounded context
(`BFR-ARC-004`). No foreign key crosses a context boundary: cross-context links
are held as reference identifiers, shown in the diagrams as dashed edges.

Field-level definitions are in `BFR-DAT-002`.

---

## 1. Governance, identity, consent, audit

```mermaid
erDiagram
  PLATFORM_CONFIG ||--o{ CONFIG_VERSION : "versioned by"
  CONFIG_VERSION ||--o{ LIMIT_RULE : defines
  CONFIG_VERSION ||--o{ FEATURE_FLAG : defines
  PRODUCT ||--o{ PRODUCT_VERSION : "versioned by"
  PRODUCT_VERSION }o--|| PARTNER : "legal provider"
  COHORT ||--o{ COHORT_MEMBER : contains

  CUSTOMER ||--o| BUSINESS_CUSTOMER : "may own"
  CUSTOMER ||--o{ USER_ACCOUNT : "authenticates as"
  USER_ACCOUNT ||--o{ ROLE_ASSIGNMENT : holds
  ROLE ||--o{ ROLE_ASSIGNMENT : "granted via"
  ROLE ||--o{ ROLE_PERMISSION : grants
  CUSTOMER ||--o{ KYC_CASE : "subject of"
  KYC_CASE ||--o{ IDENTITY_EVIDENCE : evidenced_by
  CUSTOMER ||--o{ CUSTOMER_STATUS_HISTORY : "status over time"
  BUSINESS_CUSTOMER ||--o{ BUSINESS_DELEGATION : "authorises"

  CUSTOMER ||--o{ CONSENT : grants
  CONSENT ||--o{ CONSENT_SCOPE : covers
  CONSENT }o--|| CONSENT_TERMS_VERSION : "accepted version"
  CONSENT ||--o{ DISCLOSURE_LOG : "evidences"

  AUDIT_EVENT }o..|| USER_ACCOUNT : actor
```

---

## 2. Ledger, payments, reconciliation

```mermaid
erDiagram
  CURRENCY ||--o{ LEDGER_ACCOUNT : denominates
  LEDGER_ACCOUNT ||--o{ JOURNAL_LINE : "posted to"
  JOURNAL ||--|{ JOURNAL_LINE : contains
  JOURNAL ||--o| JOURNAL : "reverses"
  LEDGER_ACCOUNT ||--o{ HOLD : "held against"
  HOLD }o--o| JOURNAL : "released by"

  PAYMENT ||--o{ PAYMENT_STATUS_HISTORY : transitions
  PAYMENT }o--o| BENEFICIARY : "pays"
  PAYMENT }o--o| QR_TOKEN : "initiated by"
  PAYMENT ||--o| RECEIPT : produces
  IDEMPOTENCY_KEY ||--o| PAYMENT : "guards"
  PAYMENT }o..|| JOURNAL : "correlated to"

  SETTLEMENT_FILE ||--o{ SETTLEMENT_RECORD : contains
  RECON_RUN ||--o{ RECON_MATCH : produces
  RECON_RUN ||--o{ RECON_EXCEPTION : produces
  RECON_EXCEPTION ||--o{ RECON_EXCEPTION_NOTE : annotated_by
  SETTLEMENT_RECORD }o..o| JOURNAL : "matched to"
```

---

## 3. Open finance, insight, Financial Passport

```mermaid
erDiagram
  INSTITUTION ||--o{ CONNECTION : "connected via"
  CONNECTION ||--o{ CONNECTED_ACCOUNT : exposes
  CONNECTION ||--o{ SYNC_RUN : "synced by"
  CONNECTED_ACCOUNT ||--o{ IMPORTED_TRANSACTION : contains
  CONNECTION }o..|| CONSENT : "authorised by"

  IMPORTED_TRANSACTION ||--o{ CLASSIFICATION : "classified by"
  CLASSIFICATION }o--|| CLASSIFICATION_MODEL : "produced by"
  IMPORTED_TRANSACTION ||--o{ CATEGORY_CORRECTION : "corrected by"
  CATEGORY ||--o{ CLASSIFICATION : assigns
  CATEGORY ||--o{ CATEGORY : "child of"

  PASSPORT ||--o{ PASSPORT_METRIC : contains
  PASSPORT_METRIC ||--|{ PASSPORT_METRIC_SOURCE : "derived from"
  PASSPORT_METRIC ||--o{ METRIC_REASON_CODE : explained_by
  PASSPORT_METRIC }o--|| ALGORITHM_VERSION : "calculated by"
  PASSPORT ||--o{ PASSPORT_SHARE : shared_via
  PASSPORT_SHARE ||--o{ SHARE_SCOPE : includes
  PASSPORT_SHARE ||--o{ SHARE_ACCESS_LOG : accessed_in
  PASSPORT_SHARE }o..|| PARTNER : "shared with"

  HEALTH_ASSESSMENT ||--o{ HEALTH_DIMENSION : contains
  HEALTH_DIMENSION ||--o{ HEALTH_REASON_CODE : explained_by
  HEALTH_ASSESSMENT }o--|| ALGORITHM_VERSION : "calculated by"
```

---

## 4. Savings, circles, business

```mermaid
erDiagram
  SAVINGS_GOAL ||--o{ SAVINGS_CONTRIBUTION : funded_by
  SAVINGS_RULE ||--o{ SAVINGS_CONTRIBUTION : triggers
  SAVINGS_RULE }o--o| SAVINGS_GOAL : targets
  SAVINGS_RULE ||--o{ SAVINGS_RULE_STATUS_HISTORY : transitions
  SAVINGS_CONTRIBUTION }o..|| JOURNAL : "posted as"

  CIRCLE ||--|{ CIRCLE_RULE_VERSION : governed_by
  CIRCLE ||--o{ CIRCLE_MEMBER : has
  CIRCLE_MEMBER ||--o{ RULE_ACCEPTANCE : accepts
  CIRCLE ||--o{ CIRCLE_CYCLE : runs
  CIRCLE_CYCLE ||--o{ CONTRIBUTION_SCHEDULE : schedules
  CONTRIBUTION_SCHEDULE ||--o{ CIRCLE_CONTRIBUTION : fulfilled_by
  CIRCLE ||--o{ PAYOUT_ORDER : sequences
  CIRCLE_CYCLE ||--o| CIRCLE_PAYOUT : pays
  CIRCLE ||--o{ PROPOSAL : governs
  PROPOSAL ||--o{ VOTE : receives
  PROPOSAL ||--o{ APPROVAL : requires
  CIRCLE ||--o{ CIRCLE_INVITATION : invites

  MERCHANT ||--o{ MERCHANT_QR : publishes
  MERCHANT ||--o{ MERCHANT_SALE : records
  MERCHANT ||--o{ MERCHANT_EXPENSE : records
  MERCHANT ||--o{ PRODUCT_ITEM : catalogues
  PRODUCT_ITEM ||--o{ STOCK_MOVEMENT : "stock changed by"
  MERCHANT ||--o{ SUPPLIER : "buys from"
  SUPPLIER ||--o{ MERCHANT_EXPENSE : "paid via"
  MERCHANT_SALE }o--o| PRODUCT_ITEM : "sells"
  MERCHANT }o..|| BUSINESS_CUSTOMER : "operated by"
```

---

## 5. Capital marketplace, cross-border, FX

```mermaid
erDiagram
  FUNDING_REQUEST ||--o{ APPLICATION : "submitted as"
  APPLICATION }o--|| PARTNER : "sent to"
  APPLICATION ||--o{ APPLICATION_STATUS_HISTORY : transitions
  APPLICATION ||--o{ APPLICATION_DOCUMENT : evidenced_by
  APPLICATION ||--o{ INFORMATION_REQUEST : "provider asks"
  APPLICATION ||--o{ OFFER : receives
  OFFER ||--o| OFFER_ACCEPTANCE : accepted_by
  APPLICATION ||--o| DECISION : decided_by
  APPLICATION ||--o| DISBURSEMENT : disbursed_by
  APPLICATION ||--o{ REPAYMENT_STATUS : "reported by provider"
  FUNDING_REQUEST }o..o| PASSPORT_SHARE : "supported by"

  TRANSFER ||--o{ TRANSFER_STATUS_HISTORY : transitions
  TRANSFER }o--|| FX_QUOTE : "priced by"
  TRANSFER ||--o{ ALLOCATION : "splits into"
  ALLOCATION }o--o| BILLER : "pays"
  ALLOCATION }o--o| GOAL : "contributes to"
  GOAL ||--o{ GOAL_CONTRIBUTION : funded_by
  TRANSFER ||--o{ RECOVERY_ACTION : "recovered by"
  TRANSFER }o..|| SCREENING_RESULT : "screened by"

  FX_QUOTE }o--|| ROUTE_DECISION : "routed by"
  ROUTE_DECISION ||--o{ ROUTE_CANDIDATE : evaluated
  ROUTE_CANDIDATE }o--|| PARTNER : "offered by"
  PROVIDER_HEALTH }o--|| PARTNER : monitors
```

---

## 6. Compliance, support, partners, notification, reporting

```mermaid
erDiagram
  SCREENING_RESULT }o--|| SCREENING_LIST_VERSION : "checked against"
  MONITORING_RULE ||--o{ ALERT : raises
  RISK_EVENT ||--o{ ALERT : raises
  ALERT }o--|| CASE : "grouped into"
  CASE ||--o{ CASE_NOTE : documented_by
  CASE ||--o| DISPOSITION : closed_with
  CASE ||--o{ CASE_ESCALATION : escalated_by
  RISK_EVENT ||--o{ STEP_UP_CHALLENGE : requires

  COMPLAINT ||--o{ COMPLAINT_NOTE : documented_by
  COMPLAINT ||--o| SLA_CLOCK : tracked_by
  COMPLAINT ||--o{ COMPLAINT_ESCALATION : escalated_by
  COMPLAINT }o--o| PARTNER : "concerns"
  COMPLAINT_CATEGORY ||--o{ COMPLAINT : categorises
  DATA_REQUEST ||--o{ DATA_REQUEST_NOTE : documented_by

  PARTNER ||--o{ PARTNER_CAPABILITY : enabled_for
  PARTNER ||--o{ PARTNER_USER : employs
  PARTNER ||--o{ API_CREDENTIAL : authenticates_with
  PARTNER ||--o{ WEBHOOK_ENDPOINT : notified_at
  PARTNER ||--o{ PARTNER_FEE_VERSION : "priced by"
  PARTNER ||--o{ PARTNER_STATUS_HISTORY : transitions

  TEMPLATE ||--o{ NOTIFICATION : renders
  NOTIFICATION ||--o{ DELIVERY_RECEIPT : "delivery reported by"
  CUSTOMER ||--o{ NOTIFICATION_PREFERENCE : sets

  REPORT_DEFINITION ||--o{ REPORT_RUN : executed_as
  REPORT_RUN ||--o{ REPORT_EXPORT : produces
```

---

## 7. Structural rules applied across the model

| Rule | Requirement | Implementation |
|---|---|---|
| Money is never a floating-point type | `LED-005` | `amount_minor BIGINT NOT NULL` + `currency_code CHAR(3)` on every monetary column; `scale` resolved from `CURRENCY` |
| Financial history is append-only | `LED-002`, `CIR-008`, `FRD-010`, `NFR-006` | `JOURNAL`, `JOURNAL_LINE`, `AUDIT_EVENT`, `*_STATUS_HISTORY`, `SHARE_ACCESS_LOG`, `DISCLOSURE_LOG` have no `UPDATE`/`DELETE` grant for the application role |
| Every derived number cites its version | `FP-009`, `CAT-008`, `FH-010` | `algorithm_version_id` / `model_version` is `NOT NULL` on `PASSPORT_METRIC`, `CLASSIFICATION`, `HEALTH_DIMENSION` |
| Every use of customer financial data cites consent | `CON-001/009`, `FP-008`, `CAP-005` | `consent_id` is `NOT NULL` on `CONNECTION`, `PASSPORT_METRIC_SOURCE`, `DISCLOSURE_LOG`, `PASSPORT_SHARE` |
| Every product names its legal provider | `GOV-002`, `SAV-009`, `CAP-002` | `PRODUCT_VERSION.legal_provider_partner_id` is `NOT NULL` |
| State changes are recorded, not overwritten | §5, `PAY-007`, `XB-009`, `CAP-010` | `*_STATUS_HISTORY` table per stateful entity, with `from_state`, `to_state`, `reason`, `actor`, `occurred_at` |
| Nothing regulated is un-versioned | `GOV-003/007`, `CON-010`, `CIR-005`, `PRT-008` | Shared `versioned_artefact` pattern: `(version, effective_from, effective_to, author_id, approver_id, status)` |
| Imported data keeps its origin | `OF-006` | `IMPORTED_TRANSACTION.source_system`, `.external_transaction_id`, `.raw_reference`, `.source_quality` all mandatory |
| Soft delete is not used for financial entities | `LED-002`, `PRT-010` | Deactivation is a status change; rows persist |

## 8. Reference data

| Table | Contents | Source of truth |
|---|---|---|
| `CURRENCY` | code, name, minor-unit scale, rounding default | Configuration — seeded per `Q-11` |
| `CATEGORY` | hierarchical transaction taxonomy | Configuration (`CAT-002`) |
| `COMPLAINT_CATEGORY` | complaint taxonomy | Configuration (`CMP-002`) |
| `DISPOSITION_TYPE` | permitted case outcomes | Configuration (`AML-009`, `FRD-008`) |
| `PURPOSE_CODE` | funding and remittance purposes | Configuration (`CAP-004`, `GOAL-001`) — corridor codes pending `Q-10` |
| `INSTITUTION` | connectable banks, MNOs, SACCOs | Partner management (`PRT-001`) |
| `BILLER` | approved institutions for direct payment | Partner management (`GOAL-006`) — pending `Q-27` |
| `ROLE`, `ROLE_PERMISSION` | RBAC matrix | Configuration (`USR-004`, `USR-006`) |
