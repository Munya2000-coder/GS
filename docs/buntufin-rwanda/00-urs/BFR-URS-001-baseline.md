# BFR-URS-001 — User Requirements Specification (Controlled Baseline)

**Document ID:** BFR-URS-001
**Version:** 1.0 Draft
**Target market:** Rwanda
**Requirements:** 300
**Status:** Draft for Product, Technical, Regulatory and Validation Review

> This file is the **controlled in-repo copy** of the BuntuFin Rwanda URS.
> Requirements shall not be removed, materially changed or reinterpreted during
> development without a documented impact assessment recorded against this file.
> Every downstream artefact in `docs/buntufin-rwanda/` cites IDs from this page.

**Priority definitions**

- **P1 — Critical:** required for sandbox MVP, security, regulatory control or financial integrity.
- **P2 — High:** required for core commercial operation.
- **P3 — Medium:** important but may follow the first controlled release.

**Requirement counts:** 30 domains × 10 requirements = 300.
P1 = 234, P2 = 55, P3 = 11.

---

## Domain 01 — Platform Governance (`GOV`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-GOV-001 | The platform shall support configurable country-specific regulatory rules. | Regulatory limits can be changed through controlled configuration without changing source code. | P1 |
| BFR-GOV-002 | The platform shall distinguish BuntuFin services from regulated partner services. | Each financial product identifies the legal service provider presented to the customer. | P1 |
| BFR-GOV-003 | The platform shall maintain product-version history. | Every product configuration change records version, author, approver and effective date. | P1 |
| BFR-GOV-004 | The platform shall support feature flags by country. | A feature can be enabled in Rwanda while disabled elsewhere. | P1 |
| BFR-GOV-005 | The platform shall support feature flags by sandbox cohort. | Admin can enable functionality for selected pilot users only. | P1 |
| BFR-GOV-006 | The platform shall support configurable transaction limits. | Limits can be configured by product, customer tier, currency and corridor. | P1 |
| BFR-GOV-007 | The system shall maintain effective dates for regulated configuration. | Future rule changes can be scheduled and previous values remain auditable. | P1 |
| BFR-GOV-008 | Material configuration changes shall require approval. | Maker cannot approve own regulated configuration change. | P1 |
| BFR-GOV-009 | The system shall support emergency feature suspension. | Authorised admin can disable a product/corridor without taking down entire platform. | P1 |
| BFR-GOV-010 | All regulatory configuration shall be auditable. | Who, what, when, old value and new value are retrievable. | P1 |

## Domain 02 — User and Role Management (`USR`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-USR-001 | The platform shall support individual customers. | Verified individual profile can be created and uniquely identified. | P1 |
| BFR-USR-002 | The platform shall support business customers. | Business profile can be linked to one or more authorised individuals. | P1 |
| BFR-USR-003 | The platform shall support institutional partner users. | Partner employees can authenticate under their organisation. | P1 |
| BFR-USR-004 | The platform shall implement role-based access control. | Users can access only functions assigned to authorised roles. | P1 |
| BFR-USR-005 | Users may hold multiple permitted roles. | Example: merchant owner can also be Circle member. | P2 |
| BFR-USR-006 | Administrative roles shall follow least privilege. | Standard support user cannot access AML case-management functions. | P1 |
| BFR-USR-007 | User status shall be configurable. | ACTIVE, SUSPENDED, RESTRICTED, CLOSED and PENDING supported. | P1 |
| BFR-USR-008 | Business users shall support delegated access. | Owner can authorise cashier without exposing owner credentials. | P2 |
| BFR-USR-009 | Partner organisations shall manage their authorised staff subject to controls. | Partner administrator can invite/remove users within assigned scope. | P2 |
| BFR-USR-010 | Privileged-role assignment shall be auditable. | Role grants/revocations record actor, target, date and reason. | P1 |

## Domain 03 — BuntuID / Identity and KYC (`ID`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-ID-001 | Customers shall register using a verified mobile number. | OTP verification completes before account activation. | P1 |
| BFR-ID-002 | Email shall be optional unless required by product. | Customer can onboard without email where permitted. | P2 |
| BFR-ID-003 | The system shall capture legal identity information. | Required fields include legal name, DOB and permitted identity document. | P1 |
| BFR-ID-004 | The system shall integrate with configurable identity-verification providers. | Provider adapter can be replaced without changing core onboarding workflow. | P1 |
| BFR-ID-005 | Identity verification shall support automated and manual review. | Failed automated result can enter MANUAL_REVIEW. | P1 |
| BFR-ID-006 | The system shall support configurable KYC tiers. | Tier rules can be configured without code changes. | P1 |
| BFR-ID-007 | Transaction privileges shall depend on KYC status. | Unverified customer cannot perform restricted transactions. | P1 |
| BFR-ID-008 | Duplicate identity detection shall be performed. | Potential duplicate creates review case rather than second unrestricted identity. | P1 |
| BFR-ID-009 | Identity evidence shall retain verification provenance. | Provider, timestamp, outcome and reference are stored. | P1 |
| BFR-ID-010 | Expired identity information shall trigger review. | Customer is notified and configured restrictions apply where required. | P1 |

## Domain 04 — Consent and Privacy (`CON`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-CON-001 | Consent shall be explicit for optional data sharing. | No optional external sharing occurs without recorded customer action. | P1 |
| BFR-CON-002 | Consent shall identify data categories. | Consent screen lists specific data scopes before approval. | P1 |
| BFR-CON-003 | Consent shall identify purpose. | Purpose is displayed and persisted with consent record. | P1 |
| BFR-CON-004 | Consent shall record duration. | Start and expiry timestamps are retained. | P1 |
| BFR-CON-005 | Customers shall revoke consent. | Future collection stops after successful revocation. | P1 |
| BFR-CON-006 | Revocation shall not delete legally retained records automatically. | System differentiates retention obligations from future processing permission. | P1 |
| BFR-CON-007 | Customers shall view active consent. | Dashboard displays provider, purpose, scope and expiry. | P1 |
| BFR-CON-008 | Customers shall view historical consent. | Granted, expired and revoked consent records remain viewable where appropriate. | P2 |
| BFR-CON-009 | Consent sharing shall be logged. | Each disclosure records recipient, scope, purpose and timestamp. | P1 |
| BFR-CON-010 | Consent shall be versioned. | Changed terms require new version and appropriate renewed acceptance. | P1 |

## Domain 05 — Open Finance / BuntuConnect (`OF`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-OF-001 | Customers shall connect supported external financial accounts. | Successful authorisation creates active connection record. | P1 |
| BFR-OF-002 | Bank connections shall use provider adapters. | New bank adapter can be added without altering core transaction model. | P1 |
| BFR-OF-003 | Mobile-money connections shall use provider adapters. | Different operators implement standard interface. | P1 |
| BFR-OF-004 | SACCO data sources shall be supported where technically available. | SACCO data maps into common account schema. | P2 |
| BFR-OF-005 | Imported transactions shall be normalised. | Different provider formats map to standard transaction representation. | P1 |
| BFR-OF-006 | Data source provenance shall be retained. | Original source and external reference remain retrievable. | P1 |
| BFR-OF-007 | Synchronisation status shall be visible. | Customer sees latest successful sync and connection problems. | P2 |
| BFR-OF-008 | Failed account connections shall not corrupt existing data. | Existing records remain intact after provider failure. | P1 |
| BFR-OF-009 | Duplicate imported transactions shall be detected. | Same provider transaction is not counted twice. | P1 |
| BFR-OF-010 | Account disconnection shall stop further retrieval. | No additional sync occurs after connection removal or consent revocation. | P1 |

## Domain 06 — Transaction Categorisation (`CAT`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-CAT-001 | Transactions shall be automatically categorised. | Supported transactions receive system category and confidence value. | P2 |
| BFR-CAT-002 | Categories shall be configurable. | New category can be introduced without database redesign. | P2 |
| BFR-CAT-003 | Customers shall correct categories. | Customer correction does not overwrite original machine classification. | P1 |
| BFR-CAT-004 | Business income shall be distinguishable from personal transfers. | Financial Passport calculations can exclude identified non-business transfers. | P1 |
| BFR-CAT-005 | Cash withdrawals shall be separately classified. | Cash-out activity can be measured distinctly. | P2 |
| BFR-CAT-006 | Remittances shall be identifiable. | Cross-border remittance inflows can be analysed separately. | P2 |
| BFR-CAT-007 | Recurring transactions shall be detected. | System identifies repeated periodic counterparties/payments. | P3 |
| BFR-CAT-008 | Classification models shall be versioned. | Every automated classification can identify model/rule version. | P1 |
| BFR-CAT-009 | Model changes shall not silently rewrite historical evidence. | Historical results remain reproducible. | P1 |
| BFR-CAT-010 | Low-confidence classifications shall be identifiable. | Configurable confidence threshold flags transactions for correction/review. | P2 |

## Domain 07 — Financial Passport (`FP`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-FP-001 | Eligible customers shall generate a Financial Passport. | Passport can be created when configured minimum data criteria are met. | P1 |
| BFR-FP-002 | Passport shall show identity confidence. | Verification status is displayed without exposing unnecessary identity data. | P1 |
| BFR-FP-003 | Passport shall display verified financial data sources. | Connected source names and coverage periods are shown. | P1 |
| BFR-FP-004 | Passport shall calculate income indicators. | Monthly inflows and consistency calculated from permitted data. | P1 |
| BFR-FP-005 | Passport shall calculate cashflow indicators. | Net cashflow shown for configurable historical periods. | P1 |
| BFR-FP-006 | Passport shall calculate savings indicators. | Savings frequency/rate calculated from qualifying sources. | P1 |
| BFR-FP-007 | Passport shall support business metrics. | Merchant turnover and transaction frequency available when applicable. | P1 |
| BFR-FP-008 | Every calculated metric shall be explainable. | User can view why metric was calculated and which data sources contributed. | P1 |
| BFR-FP-009 | Passport calculations shall be versioned. | Metric displays/references algorithm version and calculation timestamp. | P1 |
| BFR-FP-010 | Passport shall clearly state it is not itself a financing guarantee. | Disclaimer appears in digital and exportable versions. | P1 |

## Domain 08 — Financial Passport Sharing (`FPS`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-FPS-001 | Customers shall choose organisations with which to share Passport data. | No organisation can browse Passport without authorised pathway. | P1 |
| BFR-FPS-002 | Customers shall choose data categories shared. | User can include/exclude supported Passport sections. | P1 |
| BFR-FPS-003 | Sharing may be time-limited. | Access automatically expires at specified timestamp. | P1 |
| BFR-FPS-004 | One-time sharing shall be supported. | Recipient cannot reuse expired one-time authorisation. | P1 |
| BFR-FPS-005 | Sharing shall generate unique authorisation. | Each share has unique ID, scope, recipient and expiry. | P1 |
| BFR-FPS-006 | Customers shall see who accessed shared data. | Access event appears in customer data-access history. | P1 |
| BFR-FPS-007 | Customers shall revoke active shares where permitted. | Future recipient access is prevented after revocation. | P1 |
| BFR-FPS-008 | Shared data shall carry calculation timestamp. | Recipient sees currency and freshness date of metrics. | P1 |
| BFR-FPS-009 | Passport export shall be supported. | User can generate controlled PDF or digital report. | P2 |
| BFR-FPS-010 | Expired data shall not be represented as current. | Stale/expired indicators are visually labelled. | P1 |

## Domain 09 — Financial Health (`FH`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-FH-001 | Platform shall calculate optional financial-health indicators. | Eligible customer sees calculated dimensions. | P2 |
| BFR-FH-002 | Financial-health calculations shall be explainable. | Each score/dimension provides reason factors. | P1 |
| BFR-FH-003 | Income stability shall be measurable. | Calculation uses documented, versioned methodology. | P2 |
| BFR-FH-004 | Savings resilience shall be measurable. | Emergency reserve or savings consistency can be calculated. | P2 |
| BFR-FH-005 | Financial commitments may contribute when data is available. | System identifies documented data source before calculation. | P2 |
| BFR-FH-006 | Customers shall receive non-deceptive guidance. | Suggestions are phrased as guidance, not guaranteed outcomes. | P1 |
| BFR-FH-007 | Financial-health indicator shall not silently become an underwriting decision. | Lending workflow requires separate partner decision. | P1 |
| BFR-FH-008 | Automated indicators shall retain input provenance. | Inputs used for each assessment are traceable. | P1 |
| BFR-FH-009 | Customers shall challenge inaccurate underlying data. | Dispute/reclassification workflow exists. | P1 |
| BFR-FH-010 | Calculation methodology shall be configurable/versioned. | New model version can run without erasing prior outputs. | P1 |

## Domain 10 — BuntuPay / Customer Payments (`PAY`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-PAY-001 | Customer shall view available transaction position. | Displayed value derives from ledger/authoritative partner state. | P1 |
| BFR-PAY-002 | Customer shall send money to permitted recipients. | Valid payment completes through configured payment rail. | P1 |
| BFR-PAY-003 | Customer shall request money. | Payment request can be sent and tracked. | P2 |
| BFR-PAY-004 | Customer shall pay by QR. | Valid QR resolves recipient before authorisation. | P1 |
| BFR-PAY-005 | Payment confirmation shall show amount and recipient. | Customer confirms final details before execution. | P1 |
| BFR-PAY-006 | Fees shall be displayed before confirmation. | Final customer fee is visible prior to authorisation. | P1 |
| BFR-PAY-007 | Payment status shall be trackable. | Customer sees pending, completed, failed or reversed state. | P1 |
| BFR-PAY-008 | Failed payment shall not display as completed. | UI reflects authoritative transaction state. | P1 |
| BFR-PAY-009 | Duplicate payment requests shall be protected by idempotency. | Repeated same request does not create unintended duplicate debit. | P1 |
| BFR-PAY-010 | Receipts shall be generated. | Completed transaction produces timestamped reference and amount. | P2 |

## Domain 11 — Double-Entry Ledger (`LED`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-LED-001 | Financial postings shall use double-entry accounting. | Sum of journal debits equals credits. | P1 |
| BFR-LED-002 | Posted journal entries shall be immutable. | Ordinary application actions cannot delete or edit posted entry. | P1 |
| BFR-LED-003 | Corrections shall use reversals/adjustments. | Original and correcting entries remain linked. | P1 |
| BFR-LED-004 | Ledger shall support pending and posted states. | Holds do not appear as final settled postings until appropriate. | P1 |
| BFR-LED-005 | Monetary values shall not use binary floating-point. | Fixed precision or integer minor units used. | P1 |
| BFR-LED-006 | Ledger accounts shall support currency identification. | Currency is explicit for every account/posting. | P1 |
| BFR-LED-007 | Ledger shall maintain transaction correlation. | Business transaction references linked journal entries. | P1 |
| BFR-LED-008 | Ledger shall support holds and releases. | Held amount can be traced and released/reversed appropriately. | P1 |
| BFR-LED-009 | Ledger imbalance shall prevent posting. | Unbalanced journal fails transaction atomically. | P1 |
| BFR-LED-010 | Ledger data shall support reconciliation. | Partner and settlement references are retained. | P1 |

## Domain 12 — BuntuSave (`SAV`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-SAV-001 | Customers shall create savings goals. | Goal stores target amount, target date and purpose. | P1 |
| BFR-SAV-002 | Customers shall configure percentage savings rules. | Qualifying inflow causes configured percentage transfer/instruction. | P1 |
| BFR-SAV-003 | Customers shall configure round-up saving. | Eligible payment calculates correct rounding amount. | P2 |
| BFR-SAV-004 | Customers shall configure scheduled saving. | Rule runs only according to configured schedule and authority. | P1 |
| BFR-SAV-005 | Customers shall pause savings rules. | Paused rule stops future automated saving actions. | P2 |
| BFR-SAV-006 | Customers shall cancel savings rules. | Cancelled rule does not create further transfers. | P2 |
| BFR-SAV-007 | Merchant reserve rules shall be supported. | Configurable percentage of merchant receipts can be allocated to reserve. | P2 |
| BFR-SAV-008 | Savings recommendations shall require opt-in before activation. | Recommendation alone cannot move funds. | P1 |
| BFR-SAV-009 | Underlying regulated savings provider shall be identifiable. | Customer can see who legally holds/provides savings product. | P1 |
| BFR-SAV-010 | Goal progress shall update after confirmed movements. | Failed or pending transfers do not inflate achieved savings. | P1 |

## Domain 13 — BuntuCircle (`CIR`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-CIR-001 | User shall create a savings Circle. | Founder can define name, purpose, contribution and schedule. | P1 |
| BFR-CIR-002 | Circle shall support rotating savings model. | Payout order and cycles can be configured. | P1 |
| BFR-CIR-003 | Circle shall support accumulating savings model. | Contributions can remain pooled toward configured goal. | P1 |
| BFR-CIR-004 | Members shall accept Circle rules before participation. | Acceptance timestamp and rule version recorded. | P1 |
| BFR-CIR-005 | Circle rules shall be version-controlled. | Historical and current rules are retrievable. | P1 |
| BFR-CIR-006 | Contributions shall be tracked per member. | Paid, due, late and missed status available. | P1 |
| BFR-CIR-007 | Members shall view transparent Circle ledger. | Authorised members see group transactions and references. | P1 |
| BFR-CIR-008 | Administrators shall not delete financial history. | Posted contributions cannot be silently removed. | P1 |
| BFR-CIR-009 | Circle shall support member invitation. | Invite via supported phone/link/QR workflow. | P2 |
| BFR-CIR-010 | Member exit shall follow configurable rules. | Exit action triggers configured settlement/approval process. | P2 |

## Domain 14 — Circle Governance and Payouts (`CG`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-CG-001 | Circle shall support configurable voting. | Proposal can define threshold and voting period. | P1 |
| BFR-CG-002 | Circle shall support multiple approval thresholds. | Payment can require N-of-M approvals. | P1 |
| BFR-CG-003 | Approver shall not approve same request twice. | Duplicate approval is rejected. | P1 |
| BFR-CG-004 | Payout sequence shall be visible to members. | Current and future planned recipients are displayed. | P1 |
| BFR-CG-005 | Payout-order changes shall follow rules. | Unauthorised administrator cannot silently reorder recipients. | P1 |
| BFR-CG-006 | Circle shall notify members of contribution deadlines. | Reminder issued according to configured schedule. | P2 |
| BFR-CG-007 | Late contribution status shall be visible. | Member and authorised group users see overdue state. | P2 |
| BFR-CG-008 | Circle behaviour may feed Financial Passport with consent. | Contribution summary included only after appropriate consent. | P1 |
| BFR-CG-009 | Circle disputes shall create case record. | Complaint/dispute is linked to Circle and relevant transaction. | P2 |
| BFR-CG-010 | Circle closure shall require appropriate settlement. | Closure cannot complete while unresolved balance rules remain. | P1 |

## Domain 15 — BuntuBusiness (`BIZ`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-BIZ-001 | Customer shall create business profile. | Business owner can create profile with required business details. | P1 |
| BFR-BIZ-002 | Informal businesses shall be supported where permitted. | Registration number can be optional based on business classification. | P1 |
| BFR-BIZ-003 | Businesses shall receive merchant identifier. | Unique merchant reference generated. | P1 |
| BFR-BIZ-004 | Merchant shall generate static QR. | QR resolves merchant correctly. | P1 |
| BFR-BIZ-005 | Merchant shall generate dynamic QR. | QR contains/links amount and reference. | P1 |
| BFR-BIZ-006 | Merchant shall record manual cash sales. | Cash sale stored as merchant-entered, not verified digital receipt. | P1 |
| BFR-BIZ-007 | Merchant shall record business expenses. | Expense stores amount, category, date and evidence if provided. | P2 |
| BFR-BIZ-008 | Merchant dashboard shall display turnover. | Totals derive from selected periods and identified evidence types. | P1 |
| BFR-BIZ-009 | Merchant dashboard shall display net cashflow estimate. | Calculation methodology documented and reproducible. | P2 |
| BFR-BIZ-010 | Merchant data may feed Financial Passport. | Passport identifies verified versus self-entered business data. | P1 |

## Domain 16 — Inventory-Lite (`INV`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-INV-001 | Merchant shall maintain product catalogue. | Product can store name, SKU, price and category. | P3 |
| BFR-INV-002 | Merchant shall maintain stock quantity. | Quantity changes are stored with audit reference. | P3 |
| BFR-INV-003 | Product sale may reduce inventory automatically. | Completed product-linked sale reduces configured quantity once. | P3 |
| BFR-INV-004 | Failed sale shall not reduce final stock. | Inventory is unchanged/reversed after failed payment. | P3 |
| BFR-INV-005 | Reorder threshold shall be configurable. | Merchant can set minimum quantity by item. | P3 |
| BFR-INV-006 | Low-stock alert shall be supported. | Alert triggers when stock crosses configured threshold. | P3 |
| BFR-INV-007 | Supplier directory shall be supported. | Merchant can record supplier and contact information. | P3 |
| BFR-INV-008 | Supplier payments shall be linkable to supplier record. | Transaction can reference selected supplier. | P3 |
| BFR-INV-009 | Inventory corrections shall retain audit history. | Manual adjustment stores reason and actor. | P3 |
| BFR-INV-010 | Inventory module shall not be prerequisite for payment acceptance. | Merchant can use payments without catalogue. | P2 |

## Domain 17 — BuntuCapital Marketplace (`CAP`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-CAP-001 | Eligible customers shall explore financing offers. | User can initiate funding-request workflow. | P1 |
| BFR-CAP-002 | BuntuFin shall not represent itself as lender unless legally configured. | Provider name displayed for every financing product. | P1 |
| BFR-CAP-003 | Customer shall specify requested amount. | Valid amount captured against configurable boundaries. | P1 |
| BFR-CAP-004 | Customer shall specify funding purpose. | Selected purpose stored with application. | P1 |
| BFR-CAP-005 | Prequalification may use consented financial data. | Inputs can be traced to authorised sources. | P1 |
| BFR-CAP-006 | Customer shall select partner(s) allowed to receive information. | No partner submission occurs without selected authorised flow. | P1 |
| BFR-CAP-007 | Providers shall return structured financing offers. | Amount, duration, fees and repayment information can be compared. | P1 |
| BFR-CAP-008 | Offers shall identify provider. | Customer sees legal provider before selection. | P1 |
| BFR-CAP-009 | BuntuFin commercial commission shall not invisibly determine ranking. | Ranking methodology can be explained and configured fairly. | P1 |
| BFR-CAP-010 | Application status shall be trackable. | Customer sees submitted/reviewing/approved/declined/etc. | P1 |

## Domain 18 — Capital Application Lifecycle (`CAF`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-CAF-001 | Provider may request additional information. | Customer receives structured information request. | P2 |
| BFR-CAF-002 | Customer shall upload requested supporting documents where needed. | Uploaded evidence links to application securely. | P2 |
| BFR-CAF-003 | Provider decision shall be recorded. | Decision, provider reference and timestamp stored. | P1 |
| BFR-CAF-004 | Decline reason shall be shown when supplied and permitted. | Platform displays provider-supplied reason without invention. | P1 |
| BFR-CAF-005 | Customer shall explicitly accept offer. | Acceptance action and terms version recorded. | P1 |
| BFR-CAF-006 | Disbursement confirmation shall come from authoritative source. | Application not shown as disbursed until partner confirms. | P1 |
| BFR-CAF-007 | Repayment status may be imported from provider. | Status maps into standard finance lifecycle. | P2 |
| BFR-CAF-008 | Repayment behaviour may feed Passport where lawful and consented. | Data source and consent are traceable. | P1 |
| BFR-CAF-009 | Provider offer expiry shall be enforced. | Expired offer cannot be accepted without reissue. | P1 |
| BFR-CAF-010 | Financing disputes shall link to provider/application. | Complaint contains partner and application reference. | P2 |

## Domain 19 — Cross-Border Payments / BuntuSwitch (`XB`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-XB-001 | Platform shall support configurable cross-border corridors. | Corridor can be enabled/disabled without code changes. | P1 |
| BFR-XB-002 | Sender shall specify send or receive amount. | Quote calculation supports configured quote direction. | P1 |
| BFR-XB-003 | Recipient currency shall be explicit. | Final quote identifies send/receive currencies. | P1 |
| BFR-XB-004 | FX rate shall be displayed before confirmation. | Customer sees rate applicable to quote. | P1 |
| BFR-XB-005 | All customer-facing fees shall be displayed. | Transfer fee and applicable partner charges are visible. | P1 |
| BFR-XB-006 | Recipient amount shall be displayed. | Customer sees expected amount delivered before confirmation. | P1 |
| BFR-XB-007 | Quote shall expire. | Expired quote cannot execute at stale rate. | P1 |
| BFR-XB-008 | Transfer shall support corridor-specific compliance screening. | Screening occurs before final release where configured. | P1 |
| BFR-XB-009 | Cross-border status shall be trackable. | Sender sees processing, delivered, failed, reversed/refunded states. | P1 |
| BFR-XB-010 | Failed delivery shall trigger recovery workflow. | Retry, investigation or refund path is created according to configuration. | P1 |

## Domain 20 — FX and Routing Engine (`FX`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-FX-001 | Platform shall obtain FX quote from configurable providers. | Provider-specific response maps into standard quote model. | P1 |
| BFR-FX-002 | Multiple routes may be evaluated. | Routing service can compare eligible routes. | P2 |
| BFR-FX-003 | Route eligibility shall consider corridor permissions. | Disallowed corridor/provider combination is excluded. | P1 |
| BFR-FX-004 | Route eligibility shall consider transaction limits. | Route exceeding provider/customer limit is excluded. | P1 |
| BFR-FX-005 | Route decision shall be recorded. | Chosen provider, rationale inputs and timestamps available. | P1 |
| BFR-FX-006 | Provider outage shall affect route eligibility. | Unhealthy route is excluded or transaction held. | P1 |
| BFR-FX-007 | Customer rate shall not change after valid quote acceptance without explicit re-quote. | Execution rejects expired/invalidated quote. | P1 |
| BFR-FX-008 | FX rounding shall be deterministic. | Same inputs and quote produce same amount calculation. | P1 |
| BFR-FX-009 | Routing shall support manual disablement. | Operations can disable provider/corridor. | P1 |
| BFR-FX-010 | Routing shall not optimise solely for BuntuFin margin. | Routing policy supports customer/regulatory criteria and is documented. | P1 |

## Domain 21 — PurposePay / BuntuGoals (`GOAL`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-GOAL-001 | Sender shall create purpose-linked remittance. | Transfer can reference configured purpose. | P2 |
| BFR-GOAL-002 | Sender shall split remittance across permitted destinations. | Allocation total equals confirmed remittance amount. | P1 |
| BFR-GOAL-003 | Platform shall support family financial goals. | Goal can accept permitted contributions from multiple contributors. | P2 |
| BFR-GOAL-004 | Goal shall display target and progress. | Confirmed contributions update percentage accurately. | P2 |
| BFR-GOAL-005 | Platform shall support approved direct institution payment. | Valid service-provider reference is included in transaction. | P2 |
| BFR-GOAL-006 | Direct-payment recipient shall be verified/configured partner. | Unvalidated institution cannot masquerade as approved biller. | P1 |
| BFR-GOAL-007 | Sender shall receive allocation breakdown before confirmation. | Each destination and amount displayed. | P1 |
| BFR-GOAL-008 | Failed sub-allocation shall be traceable. | Partial completion state identifies successful and failed legs. | P1 |
| BFR-GOAL-009 | Product shall distinguish recipient-owned funds from sender-directed payments. | UX correctly identifies legal/control model. | P1 |
| BFR-GOAL-010 | Goal contributors shall receive appropriate receipts. | Receipt records contribution and destination. | P2 |

## Domain 22 — AML / Financial Crime (`AML`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-AML-001 | Platform shall screen applicable customers against configured sanctions data. | Screening result recorded with source/version. | P1 |
| BFR-AML-002 | Platform shall support PEP screening. | Potential match enters configured review workflow. | P1 |
| BFR-AML-003 | Transaction monitoring rules shall be configurable. | Thresholds/rules can change without source-code release. | P1 |
| BFR-AML-004 | System shall detect unusual transaction velocity. | Configured condition generates alert. | P1 |
| BFR-AML-005 | System shall detect unusual cross-border patterns. | Configured corridor/risk scenarios generate alert. | P1 |
| BFR-AML-006 | AML alert shall create or link to compliance case. | Case contains customer, transaction and alert evidence. | P1 |
| BFR-AML-007 | Compliance analyst shall document investigation. | Notes, actions and outcome persist. | P1 |
| BFR-AML-008 | AML cases shall support escalation. | Analyst can route case to authorised senior reviewer. | P1 |
| BFR-AML-009 | Case closure shall require outcome/reason. | Case cannot close with blank disposition. | P1 |
| BFR-AML-010 | AML actions shall be restricted and auditable. | Only authorised roles can access/modify case; actions logged. | P1 |

## Domain 23 — Fraud Management (`FRD`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-FRD-001 | Platform shall detect new-device risk. | New device generates configured risk signal. | P1 |
| BFR-FRD-002 | Platform shall detect abnormal login attempts. | Threshold breach can trigger step-up/block. | P1 |
| BFR-FRD-003 | Platform shall monitor beneficiary-risk signals. | Newly added high-value beneficiary can increase risk score. | P1 |
| BFR-FRD-004 | Platform shall detect account-takeover indicators. | Configured signals create risk event. | P1 |
| BFR-FRD-005 | Fraud engine shall assign risk level. | LOW/MEDIUM/HIGH/CRITICAL or equivalent stored. | P1 |
| BFR-FRD-006 | Risk rules may trigger step-up authentication. | Transaction cannot proceed until required challenge passes. | P1 |
| BFR-FRD-007 | High-risk transaction may enter manual review. | Transaction state clearly indicates hold/review. | P1 |
| BFR-FRD-008 | Fraud analyst shall create disposition. | Alert closes only with authorised outcome. | P1 |
| BFR-FRD-009 | False-positive outcomes shall be retained for rule improvement. | Historical disposition is queryable. | P2 |
| BFR-FRD-010 | Fraud decisions shall not silently delete financial events. | Held/blocked/reversed transactions remain auditable. | P1 |

## Domain 24 — Complaints and Disputes (`CMP`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-CMP-001 | Customer shall submit complaint. | Complaint receives unique reference. | P1 |
| BFR-CMP-002 | Complaint categories shall be configurable. | New category can be added administratively. | P2 |
| BFR-CMP-003 | Complaint may link to transaction. | Relevant payment/transfer reference can be attached. | P1 |
| BFR-CMP-004 | Complaint may link to partner. | Institution/provider reference retained. | P2 |
| BFR-CMP-005 | Complaint shall have SLA tracking. | Due date calculated from configured rules. | P1 |
| BFR-CMP-006 | Customer shall see complaint status. | OPEN/INVESTIGATING/etc. shown in plain language. | P2 |
| BFR-CMP-007 | Staff shall record investigation activity. | Notes and actions are timestamped. | P1 |
| BFR-CMP-008 | Complaint resolution shall record outcome. | Case cannot close without resolution category. | P1 |
| BFR-CMP-009 | Escalation shall be supported. | Overdue or serious complaint can move to higher level. | P1 |
| BFR-CMP-010 | Complaint reporting shall support regulatory metrics. | Volumes, categories and resolution times exportable. | P1 |

## Domain 25 — Partner Management (`PRT`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-PRT-001 | Platform shall maintain partner organisation profiles. | Name, type, status and regulatory references can be stored. | P1 |
| BFR-PRT-002 | Partner capability shall be configurable. | Partner can be enabled for lending, payments, savings, etc. independently. | P1 |
| BFR-PRT-003 | Partner status shall control availability. | Suspended partner cannot receive new transactions. | P1 |
| BFR-PRT-004 | Partner users shall use organisation-scoped access. | User cannot access another partner's data. | P1 |
| BFR-PRT-005 | API credentials shall be partner-specific. | Credentials can be rotated/revoked separately. | P1 |
| BFR-PRT-006 | Partner connection health shall be monitored. | Current integration status visible to operations. | P1 |
| BFR-PRT-007 | Partner webhook endpoints shall be configurable. | Verified endpoint can receive approved events. | P2 |
| BFR-PRT-008 | Partner fee configurations shall be versioned. | Historical fee basis remains reproducible. | P1 |
| BFR-PRT-009 | Partner onboarding shall require approval before activation. | Draft partner cannot process production transactions. | P1 |
| BFR-PRT-010 | Partner offboarding shall preserve historical records. | Deactivation does not remove past transaction evidence. | P1 |

## Domain 26 — Administration Portal (`ADM`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-ADM-001 | Admin portal shall require strong authentication. | MFA enforced for privileged users. | P1 |
| BFR-ADM-002 | Admin dashboard shall display operational KPIs. | Current transaction, failure and case indicators available. | P2 |
| BFR-ADM-003 | Authorised staff shall search customers. | Search is role-limited and audited. | P1 |
| BFR-ADM-004 | Sensitive data shall be masked based on role. | Lower privilege role cannot view full protected values. | P1 |
| BFR-ADM-005 | Admin shall view transaction lifecycle. | Status history and references displayed. | P1 |
| BFR-ADM-006 | Admin shall not directly alter posted ledger records. | No normal UI operation edits posted ledger entry. | P1 |
| BFR-ADM-007 | Controlled customer restriction shall be supported. | Authorised role can restrict account with reason. | P1 |
| BFR-ADM-008 | Manual overrides shall require reason. | Override cannot complete without documented justification. | P1 |
| BFR-ADM-009 | High-risk overrides shall support dual approval. | Configured action requires independent second approver. | P1 |
| BFR-ADM-010 | All admin actions shall be audited. | Actor, action, target, before/after and timestamp available where relevant. | P1 |

## Domain 27 — Notifications (`NOT`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-NOT-001 | Platform shall support SMS notifications. | Valid message can be delivered through configured provider. | P1 |
| BFR-NOT-002 | Platform shall support push notifications. | Registered mobile device can receive push message. | P2 |
| BFR-NOT-003 | Platform shall support email notifications where email exists. | Email delivery is attempted and logged. | P2 |
| BFR-NOT-004 | Notification templates shall be configurable. | Content changes do not require code deployment. | P2 |
| BFR-NOT-005 | Mandatory security notifications shall not be suppressible. | User preference cannot disable critical security notices. | P1 |
| BFR-NOT-006 | Marketing preferences shall be separate from service messages. | Opt-out does not prevent operational notices. | P1 |
| BFR-NOT-007 | Payment completion shall trigger confirmation. | Customer receives configured confirmation after authoritative completion. | P1 |
| BFR-NOT-008 | Failed transfers shall trigger notification. | Customer informed promptly after failure determination. | P1 |
| BFR-NOT-009 | Consent expiry may trigger reminder. | Configured notice can be sent before expiration. | P3 |
| BFR-NOT-010 | Notification delivery status shall be recorded. | Sent/delivered/failed information retained when provider supplies it. | P2 |

## Domain 28 — Reporting and Sandbox KPI (`RPT`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-RPT-001 | Platform shall report total sandbox participants. | Count can be generated by reporting period. | P1 |
| BFR-RPT-002 | Platform shall report active users. | Activity definition is configurable/documented. | P1 |
| BFR-RPT-003 | Platform shall report merchant adoption. | Merchant onboarded/active counts available. | P1 |
| BFR-RPT-004 | Platform shall report Financial Passports created/shared. | Counts available by reporting period. | P1 |
| BFR-RPT-005 | Platform shall report savings participation. | Goals/rules and qualifying amounts can be reported. | P1 |
| BFR-RPT-006 | Platform shall report Circle participation. | Groups, members and contribution indicators available. | P1 |
| BFR-RPT-007 | Platform shall report cross-border transaction outcomes. | Volumes, values, success/failure and timing available. | P1 |
| BFR-RPT-008 | Platform shall report financing-marketplace outcomes. | Requests, offers, approvals and disbursement confirmations available. | P1 |
| BFR-RPT-009 | Platform shall report complaints/fraud/AML metrics. | Counts and outcomes exportable. | P1 |
| BFR-RPT-010 | Sandbox reports shall export to common formats. | CSV/XLSX/PDF or approved reporting format can be produced. | P2 |

## Domain 29 — Reconciliation and Settlement (`REC`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-REC-001 | External monetary partners shall be reconciled. | Internal and partner records can be compared. | P1 |
| BFR-REC-002 | Reconciliation shall identify matched records. | Matching criteria produce MATCHED status. | P1 |
| BFR-REC-003 | Reconciliation shall identify amount mismatch. | Difference is flagged with expected and actual values. | P1 |
| BFR-REC-004 | Reconciliation shall identify missing internal records. | Partner-only transaction creates exception. | P1 |
| BFR-REC-005 | Reconciliation shall identify missing partner records. | Internal-only transaction creates exception. | P1 |
| BFR-REC-006 | Duplicate settlement records shall be detected. | Duplicate partner reference creates exception. | P1 |
| BFR-REC-007 | Reconciliation exceptions shall support investigation workflow. | Exception can be assigned, annotated and resolved. | P1 |
| BFR-REC-008 | Reconciliation resolution shall be audited. | Reason and corrective action recorded. | P1 |
| BFR-REC-009 | Settlement files shall retain source integrity/reference. | Original received source/file reference is preserved. | P1 |
| BFR-REC-010 | Reconciliation reports shall be exportable. | Operations can export unresolved/resolved exceptions. | P2 |

## Domain 30 — Security, Data, API, Performance and Validation (`NFR`)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| BFR-NFR-001 | Data shall be encrypted in transit. | Supported production endpoints enforce approved TLS configuration. | P1 |
| BFR-NFR-002 | Sensitive data shall be encrypted at rest. | Database/storage encryption enabled for production data stores. | P1 |
| BFR-NFR-003 | Secrets shall not be stored in source code. | Repository scan finds no production credentials/secrets. | P1 |
| BFR-NFR-004 | API calls modifying money shall support idempotency. | Repeated same idempotent request does not duplicate monetary action. | P1 |
| BFR-NFR-005 | APIs shall use structured error responses. | Error response includes stable code and correlation ID. | P1 |
| BFR-NFR-006 | Audit logs shall be protected from ordinary modification. | Standard users/admins cannot delete audit events. | P1 |
| BFR-NFR-007 | Platform shall support low-bandwidth operation. | Critical customer screens remain usable on constrained connection test profile. | P2 |
| BFR-NFR-008 | Production service availability target shall be at least 99.9% excluding approved maintenance. | Availability monitoring reports against defined target. | P2 |
| BFR-NFR-009 | Critical functionality shall have automated tests. | CI pipeline executes unit/integration/E2E suites for defined critical flows. | P1 |
| BFR-NFR-010 | Every URS requirement shall be traceable to design and test evidence before production release. | Traceability matrix shows requirement → design → build → test → result. | P1 |

---

## Standing implementation constraints (URS §4–§29)

These sections of the URS are not numbered requirements but are **mandatory
implementation constraints**. Each is realised by a standard document in
`docs/buntufin-rwanda/04-standards/`:

| URS section | Constraint | Realised by |
|---|---|---|
| §4 | Authentication (PIN, password, OTP, biometric, refresh-token rotation, session expiry, device management, recovery, step-up, admin MFA) | `BFR-STD-005` |
| §5 | Financial state machines (Payment, Cross-Border Transfer, Financing Application) | `BFR-STD-001` |
| §6–§8 | Passport metric/source data quality, core metric set, explainability standard | `BFR-FDS-07`, `BFR-DAT-002` |
| §9 | AI / ML controls and model register | `BFR-STD-009`, `BFR-FDS-06`, `BFR-FDS-09` |
| §10–§11 | Normalised account and transaction models | `BFR-DAT-002` |
| §12 | Event architecture | `BFR-STD-002` |
| §13 | External service adapters | `BFR-STD-003` |
| §14–§15 | API security and versioning | `BFR-STD-004` |
| §16–§17 | Data retention and customer data rights | `BFR-STD-006` |
| §18–§20 | Localisation, USSD, accessibility | `BFR-STD-007` |
| §21–§25 | Security monitoring, BCP, backup, environments, CI/CD | `BFR-STD-008` |
| §26–§27 | Test categories and traceability matrix | `BFR-STD-009`, `BFR-RTM-001` |
| §29 | Sandbox release gates | `BFR-REL-001` |
