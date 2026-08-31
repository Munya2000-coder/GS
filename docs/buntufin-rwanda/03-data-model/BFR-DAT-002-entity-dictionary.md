# BFR-DAT-002 — Data Dictionary

**Realises URS §30 Step 3**, and the mandated structures in URS §6 (Passport
metric and source), §10 (normalised account) and §11 (standard transaction).

Conventions used throughout:

- `id` — UUID v7 primary key unless stated.
- `*_minor` — `BIGINT`, monetary value in currency minor units (`LED-005`).
- `*_at` — `TIMESTAMPTZ`, stored in UTC; display localised (URS §18).
- `created_at`, `created_by` on every table; `updated_at`, `updated_by` **only**
  on tables that are legitimately mutable (never on append-only tables).
- Enumerations are database enums or FK to reference tables, never free text
  (URS §5: "Claude shall not use arbitrary free-text transaction status").

---

## 1. Configuration context (`GOV`)

### `platform_config`
| Field | Type | Constraint | Requirement |
|---|---|---|---|
| `id` | UUID | PK | |
| `config_key` | TEXT | UNIQUE, dotted namespace e.g. `kyc.tier2.daily_limit` | `GOV-001` |
| `data_type` | ENUM | `MONEY, INTEGER, DECIMAL, BOOLEAN, STRING, JSON, DURATION` | |
| `scope_type` | ENUM | `GLOBAL, COUNTRY, PRODUCT, TIER, CORRIDOR, COHORT` | `GOV-006` |
| `is_regulated` | BOOLEAN | `true` ⇒ maker-checker required | `GOV-008` |
| `owner_role` | TEXT | role permitted to propose changes | `USR-006` |

### `config_version`
| Field | Type | Constraint | Requirement |
|---|---|---|---|
| `id` | UUID | PK | |
| `config_id` | UUID | FK `platform_config` | |
| `scope_ref` | TEXT | e.g. `RW`, `corridor:RW-KE`, `cohort:pilot-1` | `GOV-004/005` |
| `value` | JSONB | typed per `data_type` | |
| `previous_value` | JSONB | nullable, for audit readability | `GOV-010` |
| `version` | INTEGER | monotonic per (config, scope_ref) | `GOV-003` |
| `effective_from` | TIMESTAMPTZ | NOT NULL, may be future-dated | `GOV-007` |
| `effective_to` | TIMESTAMPTZ | nullable | `GOV-007` |
| `status` | ENUM | `DRAFT, PENDING_APPROVAL, APPROVED, ACTIVE, SUPERSEDED, REJECTED` | `GOV-008` |
| `author_id` | UUID | NOT NULL | `GOV-003` |
| `approver_id` | UUID | NOT NULL when `is_regulated`; **CHECK `approver_id <> author_id`** | `GOV-008` |
| `is_placeholder` | BOOLEAN | `true` blocks pre-production release | `BFR-ANA-002` |

*Append-only. Superseding creates a new row.*

### `feature_flag` / `limit_rule`
`feature_flag`: `key`, `scope_type`, `scope_ref`, `enabled`, `suspended_at`,
`suspended_by`, `suspension_reason` (`GOV-004/005/009`).
`limit_rule`: `product_id`, `tier`, `currency_code`, `corridor`, `limit_type`
(`PER_TXN, DAILY, WEEKLY, MONTHLY, BALANCE_CAP, COUNT_DAILY`), `value_minor`,
`config_version_id` (`GOV-006`).

### `product` / `product_version`
`product_version` carries `legal_provider_partner_id` **NOT NULL**
(`GOV-002`), `terms_document_ref`, `version`, `effective_from`, `author_id`,
`approver_id` (`GOV-003`).

---

## 2. Identity context (`USR`, `ID`)

### `customer`
| Field | Type | Constraint | Requirement |
|---|---|---|---|
| `id` | UUID | PK — the BuntuID | `USR-001` |
| `customer_type` | ENUM | `INDIVIDUAL, BUSINESS` | `USR-001/002` |
| `msisdn` | TEXT | UNIQUE, E.164, verified before activation | `ID-001` |
| `msisdn_verified_at` | TIMESTAMPTZ | NOT NULL before `status = ACTIVE` | `ID-001` |
| `email` | TEXT | **nullable** | `ID-002` |
| `legal_name` | TEXT | encrypted at rest | `ID-003`, `NFR-002` |
| `date_of_birth` | DATE | encrypted at rest | `ID-003` |
| `country_code` | CHAR(2) | | `GOV-004` |
| `preferred_language` | ENUM | `RW, EN, FR` | URS §18 |
| `kyc_tier` | INTEGER | FK to tier config | `ID-006/007` |
| `kyc_status` | ENUM | `UNVERIFIED, PENDING, MANUAL_REVIEW, VERIFIED, EXPIRED, REJECTED` | `ID-005/010` |
| `status` | ENUM | `PENDING, ACTIVE, SUSPENDED, RESTRICTED, CLOSED` | `USR-007` |

### `customer_status_history`
Append-only: `customer_id`, `from_status`, `to_status`, `reason` (NOT NULL),
`actor_id`, `occurred_at` (`USR-007`, `ADM-007/008`).

### `identity_document`
`customer_id`, `document_type` (FK to configured permitted types — pending
`Q-03`), `document_number` (encrypted, hashed for matching), `issuing_country`,
`expiry_date`, `status` (`ID-003`, `ID-010`).

### `kyc_case` / `identity_evidence`
`kyc_case`: `customer_id`, `tier_requested`, `decision`
(`AUTO_PASS, AUTO_FAIL, MANUAL_REVIEW, MANUAL_PASS, MANUAL_FAIL`),
`decided_by`, `decided_at`, `duplicate_of_customer_id` (nullable, `ID-008`).
`identity_evidence` (append-only, `ID-009`): `kyc_case_id`, `provider_id`,
`provider_reference`, `check_type`, `outcome`, `raw_response_ref` (object store
pointer, encrypted), `retrieved_at`.

### `user_account`, `role`, `role_assignment`
`role_assignment` is append-only with `granted_by`, `granted_at`, `revoked_by`,
`revoked_at`, `reason` NOT NULL (`USR-010`). `business_delegation`:
`business_customer_id`, `delegate_user_id`, `permissions[]`, `granted_by`,
`expires_at` (`USR-008`).

---

## 3. Consent context (`CON`)

### `consent`
| Field | Type | Constraint | Requirement |
|---|---|---|---|
| `id` | UUID | PK | `CON-001` |
| `customer_id` | UUID | NOT NULL | |
| `consent_type` | ENUM | `DATA_CONNECTION, PASSPORT_SHARE, PARTNER_SUBMISSION, MARKETING` | `CON-002` |
| `purpose_code` | TEXT | NOT NULL, from reference data | `CON-003` |
| `purpose_text_key` | TEXT | localisation key shown to customer | `CON-003`, §18 |
| `terms_version_id` | UUID | NOT NULL | `CON-010` |
| `granted_at` | TIMESTAMPTZ | NOT NULL | `CON-004` |
| `expires_at` | TIMESTAMPTZ | NOT NULL | `CON-004` |
| `revoked_at` | TIMESTAMPTZ | nullable | `CON-005` |
| `revocation_reason` | TEXT | nullable | `CON-005` |
| `status` | ENUM | `ACTIVE, EXPIRED, REVOKED, SUPERSEDED` | `CON-007/008` |
| `evidence_ref` | TEXT | how the action was captured (screen, version, IP/device) | `CON-001` |

*Rows are never deleted on revocation — `CON-006` requires retention obligations
to be independent of processing permission.*

### `consent_scope`
`consent_id`, `data_category` (e.g. `ACCOUNT_BALANCE`, `TRANSACTION_HISTORY`,
`IDENTITY_STATUS`, `PASSPORT_INCOME`), `included` BOOLEAN (`CON-002`,
`FPS-002`).

### `disclosure_log` *(append-only)*
`consent_id`, `recipient_partner_id`, `data_category`, `purpose_code`,
`disclosed_at`, `request_correlation_id`, `actor` (`CON-009`, `FPS-006`).

---

## 4. Open finance context (`OF`) — URS §10 and §11

### `connected_account` — realises URS §10 verbatim
| URS §10 field | Column | Type | Requirement |
|---|---|---|---|
| `account_id` | `id` | UUID PK | |
| `customer_id` | `customer_id` | UUID NOT NULL | |
| `institution_id` | `institution_id` | UUID NOT NULL | `OF-002/003/004` |
| `external_account_reference` | `external_account_reference` | TEXT NOT NULL | `OF-006` |
| `account_type` | `account_type` | ENUM `BANK, MOBILE_MONEY, SACCO, WALLET, CARD` | `OF-004` |
| `currency` | `currency_code` | CHAR(3) NOT NULL | `LED-006` |
| `display_name` | `display_name` | TEXT | |
| `masked_identifier` | `masked_identifier` | TEXT NOT NULL | `ADM-004`, `NFR-002` |
| `current_balance` | `current_balance_minor` | BIGINT | `LED-005` |
| `available_balance` | `available_balance_minor` | BIGINT | `LED-005` |
| `balance_timestamp` | `balance_at` | TIMESTAMPTZ | `OF-007` |
| `connection_status` | `connection_status` | ENUM `ACTIVE, DEGRADED, FAILED, DISCONNECTED, CONSENT_REVOKED` | `OF-007/010` |
| `last_successful_sync` | `last_successful_sync_at` | TIMESTAMPTZ | `OF-007` |
| `consent_id` | `consent_id` | UUID **NOT NULL** | `CON-001`, `OF-010` |

**Credentials are never stored in plaintext (URS §10).** `connection` holds
`credential_handle` — an opaque reference into the secret manager — and never
the secret itself (`NFR-003`).

### `imported_transaction` — realises URS §11 verbatim
| URS §11 field | Column | Notes | Requirement |
|---|---|---|---|
| `transaction_id` | `id` | UUID PK | |
| `account_id` | `connected_account_id` | NOT NULL | |
| `external_transaction_id` | `external_transaction_id` | part of dedup key | `OF-009` |
| `transaction_type` | `transaction_type` | ENUM | `OF-005` |
| `direction` | `direction` | ENUM `CREDIT, DEBIT` | |
| `amount` | `amount_minor` | BIGINT | `LED-005` |
| `currency` | `currency_code` | CHAR(3) | `LED-006` |
| `posted_at` | `posted_at` | TIMESTAMPTZ | |
| `value_date` | `value_date` | DATE | |
| `description` | `description` | TEXT | |
| `counterparty` | `counterparty_name`, `counterparty_ref` | | `CAT-007` |
| `merchant` | `merchant_name` | | |
| `merchant_category` | `merchant_category_code` | | `CAT-001` |
| `system_category` | `system_category_id` | FK `category`, machine-assigned | `CAT-001` |
| `customer_category` | `customer_category_id` | FK `category`, nullable — **never overwrites** `system_category` | `CAT-003` |
| `category_confidence` | `category_confidence` | NUMERIC(4,3) | `CAT-001/010` |
| `channel` | `channel` | ENUM | `CAT-005` |
| `location` | `location` | JSONB | |
| `status` | `status` | ENUM | |
| `source_system` | `source_system` | TEXT NOT NULL | `OF-006` |
| `source_quality` | `source_quality` | ENUM `VERIFIED_API, FILE_IMPORT, DERIVED, SELF_REPORTED` | `OF-006`, `BIZ-010` |
| `raw_reference` | `raw_reference` | TEXT NOT NULL, pointer to raw payload | `OF-006` |
| `created_at` | `created_at` | TIMESTAMPTZ | |

**Unique index** `(connected_account_id, external_transaction_id)` where the
external id is non-null — the mechanical enforcement of `OF-009`.

### `sync_run`
`connection_id`, `started_at`, `finished_at`, `status`
(`SUCCESS, PARTIAL, FAILED`), `records_fetched`, `records_imported`,
`records_deduplicated`, `error_code`, `error_detail` (`OF-007/008`).

---

## 5. Insight context (`CAT`, `FH`)

`classification` *(append-only)*: `imported_transaction_id`, `category_id`,
`confidence`, `model_version_id` NOT NULL, `classified_at`, `is_current`
(`CAT-001/008/009/010`).
`category_correction` *(append-only)*: `imported_transaction_id`,
`from_category_id`, `to_category_id`, `corrected_by`, `corrected_at`, `reason`
(`CAT-003`, `FH-009`).
`classification_model`: `model_id`, `version`, `type` (`RULE, ML`), `owner`,
`purpose`, `approved_inputs`, `prohibited_inputs`, `training_data_ref`,
`validation_record_ref`, `deployed_at`, `performance_metrics`,
`fairness_assessment_ref`, `explainability_approach`, `rollback_target_version`
— the URS §9 model register, realised as a table.
`health_assessment` / `health_dimension`: dimension code, band, numeric value,
`algorithm_version_id`, `calculated_at`, plus `health_reason_code` rows
(`FH-001/002/008/010`).

---

## 6. Financial Passport context (`FP`, `FPS`) — URS §6

### `passport_metric` — realises URS §6 verbatim
| URS §6 field | Column | Type | Requirement |
|---|---|---|---|
| `metric_id` | `id` | UUID PK | |
| `customer_id` | `customer_id` | UUID NOT NULL | |
| `metric_type` | `metric_type` | ENUM — the URS §7 metric set | `FP-004…007` |
| `metric_value` | `metric_value` | NUMERIC / `value_minor` for monetary | `LED-005` |
| `unit` | `unit` | ENUM `MONEY, RATIO, COUNT, MONTHS, DAYS, BAND` | |
| `calculation_period_start` | `calculation_period_start` | DATE NOT NULL | `FP-005` |
| `calculation_period_end` | `calculation_period_end` | DATE NOT NULL | `FP-005` |
| `calculated_at` | `calculated_at` | TIMESTAMPTZ NOT NULL | `FP-009`, `FPS-008` |
| `algorithm_version` | `algorithm_version_id` | UUID NOT NULL | `FP-009` |
| `confidence` | `confidence` | NUMERIC(4,3) | |
| `data_completeness` | `data_completeness` | NUMERIC(4,3) | `FP-001` |
| `source_count` | `source_count` | INTEGER NOT NULL | `FP-003` |
| `status` | `status` | ENUM `CURRENT, SUPERSEDED, STALE, INSUFFICIENT_DATA` | `FPS-010` |

### `passport_metric_source` — realises URS §6 verbatim
| URS §6 field | Column | Constraint | Requirement |
|---|---|---|---|
| `passport_metric_id` | `passport_metric_id` | FK NOT NULL | |
| `data_source` | `data_source` | TEXT NOT NULL | `FP-003`, `OF-006` |
| `external_source_reference` | `external_source_reference` | TEXT NOT NULL | `OF-006` |
| `consent_reference` | `consent_id` | **NOT NULL** | `CON-001`, `FP-008` |
| `retrieval_timestamp` | `retrieved_at` | TIMESTAMPTZ NOT NULL | `FH-008` |
| `transformation_version` | `transformation_version` | TEXT NOT NULL | `CAT-008` |
| `source_quality` | `source_quality` | ENUM | `BIZ-010` |

`metric_reason_code`: `passport_metric_id`, `reason_code`, `ordinal`,
`parameters` JSONB — rendered through localised templates (`FP-008`, URS §8).

### `passport_share`
`id`, `passport_id`, `recipient_partner_id` NOT NULL, `consent_id` NOT NULL,
`created_at`, `expires_at` NOT NULL, `max_access_count` (NULL = unlimited,
1 = one-time, `FPS-004`), `access_count`, `revoked_at`, `revoked_by`,
`status` (`ACTIVE, EXPIRED, REVOKED, EXHAUSTED`), `share_token_hash`
(`FPS-001…007`).
`share_scope`: `passport_share_id`, `section`, `included` (`FPS-002`).
`share_access_log` *(append-only)*: `passport_share_id`, `accessed_at`,
`accessor_partner_user_id`, `sections_returned`, `correlation_id`,
`result` (`GRANTED, DENIED_EXPIRED, DENIED_REVOKED, DENIED_EXHAUSTED,
DENIED_SCOPE`) — `FPS-006`.

---

## 7. Ledger context (`LED`)

### `ledger_account`
`id`, `account_code`, `account_type` (`ASSET, LIABILITY, EQUITY, INCOME,
EXPENSE`), `owner_type` (`CUSTOMER, MERCHANT, CIRCLE, PLATFORM, PARTNER_FLOAT,
SUSPENSE, FX`), `owner_ref`, `currency_code` **NOT NULL** (`LED-006`),
`status`.

### `journal` *(append-only)*
`id`, `journal_type`, `correlation_id` NOT NULL (`LED-007`), `business_ref`,
`partner_reference` (`LED-010`, `REC-*`), `posted_at`, `posting_state`
(`PENDING, POSTED`) (`LED-004`), `reverses_journal_id` (nullable, `LED-003`),
`description`, `created_by`.

### `journal_line` *(append-only)*
`id`, `journal_id`, `ledger_account_id`, `direction` (`DEBIT, CREDIT`),
`amount_minor` BIGINT NOT NULL (`LED-005`), `currency_code` NOT NULL,
`line_no`.
**Constraint:** per `journal_id` and `currency_code`,
`SUM(debit) = SUM(credit)`, enforced inside the posting transaction
(`LED-001`, `LED-009`).

### `hold`
`id`, `ledger_account_id`, `amount_minor`, `currency_code`, `reason`,
`correlation_id`, `placed_at`, `expires_at`, `released_at`,
`released_by_journal_id`, `status` (`ACTIVE, RELEASED, EXPIRED, CONVERTED`)
(`LED-004/008`).

---

## 8. Payments, savings, circles, business — selected fields

`payment`: `id`, `customer_id`, `payment_type`, `rail`, `amount_minor`,
`currency_code`, `fee_minor`, `total_debit_minor`, `beneficiary_id`,
`qr_token_id`, `state` (§5 Payment machine), `idempotency_key`,
`correlation_id`, `partner_reference`, `authorised_at`, `completed_at`
(`PAY-002…009`).
`idempotency_key`: `key`, `principal_id`, `request_hash`, `response_snapshot`,
`first_seen_at`, `expires_at` — UNIQUE `(principal_id, key)` (`NFR-004`,
`PAY-009`).
`savings_rule`: `rule_type` (`PERCENTAGE, ROUND_UP, SCHEDULED,
MERCHANT_RESERVE`), `execution_mode` (`INTERNAL_TRANSFER,
PROVIDER_INSTRUCTION`), `parameters` JSONB, `status` (`DRAFT, ACTIVE, PAUSED,
CANCELLED`), `opt_in_at` NOT NULL for recommendation-originated rules
(`SAV-002…008`).
`circle_rule_version`: `circle_id`, `version`, `contribution_amount_minor`,
`frequency`, `model` (`ROTATING, ACCUMULATING`), `payout_policy`,
`approval_threshold_n`, `approval_threshold_m`, `exit_policy`,
`effective_from`, `author_id` (`CIR-002/003/005`, `CG-002`).
`merchant_sale`: `evidence_type` (`VERIFIED_DIGITAL, SELF_REPORTED`) NOT NULL —
the field that keeps `BIZ-006`, `BIZ-008` and `BIZ-010` honest.

---

## 9. Cross-border and FX — selected fields

`fx_quote` *(immutable once issued)*: `id`, `corridor`, `send_currency`,
`receive_currency`, `quote_direction` (`SEND_FIXED, RECEIVE_FIXED`),
`send_amount_minor`, `receive_amount_minor`, `rate`, `rate_scale`,
`rounding_mode`, `margin_bps`, `fee_breakdown` JSONB, `provider_id`,
`route_decision_id`, `issued_at`, `expires_at` NOT NULL (`XB-002…007`,
`FX-001/008`).
`route_decision`: `id`, `transfer_id`, `selected_partner_id`,
`evaluated_at`, `policy_version`, `inputs` JSONB (`FX-005/010`);
`route_candidate`: `route_decision_id`, `partner_id`, `eligible` BOOLEAN,
`exclusion_reason` (`CORRIDOR_NOT_PERMITTED, LIMIT_EXCEEDED, UNHEALTHY,
MANUALLY_DISABLED`) (`FX-003/004/006/009`).
`allocation`: `transfer_id`, `sequence`, `destination_type`
(`RECIPIENT_ACCOUNT, BILLER, GOAL`), `destination_ref`, `amount_minor`,
`control_model` (`RECIPIENT_OWNED, SENDER_DIRECTED`), `leg_state`
(`GOAL-002/007/008/009`).
**Constraint:** `SUM(allocation.amount_minor) = transfer.receive_amount_minor`
(`GOAL-002`).

---

## 10. Compliance, support, partners

`screening_result`: `customer_id` / `transfer_id`, `screening_type`
(`SANCTIONS, PEP, ADVERSE_MEDIA`), `list_source`, `list_version` **NOT NULL**,
`provider_id`, `outcome` (`CLEAR, POTENTIAL_MATCH, MATCH, ERROR`),
`match_details_ref`, `screened_at` (`AML-001/002`).
`case`: `case_type` (`AML, FRAUD`), `severity`, `status` (`OPEN, IN_REVIEW,
ESCALATED, PENDING_INFO, CLOSED`), `assigned_to`, `opened_at`, `closed_at`,
`disposition_id` — **CHECK: `status = CLOSED` requires `disposition_id NOT
NULL`** (`AML-009`, `FRD-008`).
`complaint`: `reference` UNIQUE human-readable (`CMP-001`), `category_id`,
`transaction_ref`, `partner_id`, `channel`, `status`, `sla_due_at`,
`resolution_category_id`, `resolved_at` — **CHECK: closure requires
`resolution_category_id`** (`CMP-008`).
`api_credential`: `partner_id`, `credential_type` (`OAUTH_CLIENT, MTLS_CERT,
SIGNING_KEY`), `identifier`, `secret_handle` (vault reference, never the
secret), `status`, `rotated_at`, `revoked_at`, `ip_allowlist`
(`PRT-005`, URS §14, `NFR-003`).

---

## 11. Audit

### `audit_event` *(append-only, hash-chained)*
| Field | Type | Requirement |
|---|---|---|
| `id` | UUID PK | |
| `occurred_at` | TIMESTAMPTZ NOT NULL | `ADM-010` |
| `actor_type` | ENUM `CUSTOMER, STAFF, PARTNER, SYSTEM` | |
| `actor_id` | UUID | |
| `action` | TEXT NOT NULL | |
| `target_type`, `target_id` | TEXT, UUID | |
| `before_value`, `after_value` | JSONB (masked per policy) | `GOV-010`, `ADM-010` |
| `reason` | TEXT — NOT NULL for overrides and restrictions | `ADM-007/008` |
| `correlation_id` | UUID NOT NULL | `NFR-005` |
| `prev_hash`, `row_hash` | BYTEA — tamper-evident chain | `NFR-006` |

No `UPDATE` or `DELETE` grant exists for any application role on this table
(`NFR-006`). Retention per `BFR-STD-006`.
