# BFR-ANA-002 — Stop-List: Decisions Required Before Implementation

**Realises URS §30 final instruction:**

> "Claude must stop and explicitly identify any requirement for which
> implementation would require guessing a regulatory rule, financial threshold,
> legal assumption or external partner API behaviour."

This is that list. **28 open questions** are recorded. Each states what is
unknown, why it cannot responsibly be guessed, who owns the decision, and what
has been done in the interim so that design work is not blocked.

---

## How the stop-list is applied

Every unknown falls into one of three handling classes:

| Class | Meaning | Development posture |
|---|---|---|
| **BLOCKING** | The requirement cannot be built at all without the answer; any value chosen would be a fabricated regulatory or legal position. | Design complete, build not started. Feature flag exists and is **off**. |
| **PARAMETERISED** | The mechanism is buildable; only the *value* is unknown. The unknown is expressed as configuration (`GOV-001`, `GOV-006`, `GOV-007`). | Build proceeds. Configuration is seeded with an explicitly-labelled `PLACEHOLDER` value that fails a pre-production gate check if still present. |
| **CONTRACT-PENDING** | Behaviour of an external partner API is unknown. | Adapter interface built to the BuntuFin domain contract (`BFR-STD-003`); a `Simulated*Adapter` implements it for test. No production implementation until the partner's contract is available. |

**Pre-production gate:** the release readiness check (`BFR-REL-001`) fails if any
configuration key still holds a `PLACEHOLDER` value, or if any BLOCKING question
is unresolved for a requirement whose feature flag is on.

---

## A. Regulatory and licensing questions

| # | Question | Requirements | Why it cannot be guessed | Class | Owner |
|---|---|---|---|---|---|
| **Q-01** | What is BuntuFin's own regulatory status in Rwanda for the sandbox — payment service provider, e-money issuer, agent/introducer of licensed institutions, or purely a technology provider? | `GOV-002`, `PAY-001`, `LED-*`, `SAV-009`, `CAP-002` | This determines whether BuntuFin may hold customer funds. It changes the legal meaning of every ledger balance, the reconciliation obligations, and the wording shown to customers. Assuming a licence BuntuFin does not hold would be a misrepresentation to customers and to the regulator. | **BLOCKING** | Legal & Regulatory |
| **Q-02** | Which licensed institution legally holds customer funds, and under what account structure (trust account, float, e-money float)? | `LED-001…010`, `REC-001…009`, `SAV-009`, `PAY-001` | Determines the chart of accounts, whose books are authoritative, and what "reconciliation" is reconciling *to*. | **BLOCKING** | Legal & Finance |
| **Q-03** | Which identity sources are permitted and available for KYC — national ID verification, and under what authorisation? What identity documents are acceptable for each customer segment (citizen, resident, refugee, non-resident)? | `ID-003`, `ID-004`, `ID-006` | Acceptable document types are a legal determination. Guessing would either exclude eligible customers or accept documents the regulator does not recognise. | **BLOCKING** | Legal & Compliance |
| **Q-04** | What are the KYC tier definitions and the transaction limits attaching to each tier (per transaction, daily, monthly, balance cap), by product and currency? | `ID-006`, `ID-007`, `GOV-006`, `PAY-002`, `XB-002` | These are prescribed regulatory thresholds. A fabricated limit is a control failure regardless of whether it is higher or lower than the real one. | **PARAMETERISED** (mechanism built; values `PLACEHOLDER`) | Compliance |
| **Q-05** | What are the mandated customer-complaint SLA durations, escalation timeframes and regulatory reporting obligations for complaints? | `CMP-005`, `CMP-009`, `CMP-010` | SLA clocks are prescribed by consumer-protection rules; inventing durations produces false compliance reporting. | **PARAMETERISED** | Compliance |
| **Q-06** | What are the suspicious/large transaction reporting obligations (report types, thresholds, formats, recipient authority, deadlines)? | `AML-003…006`, `RPT-009` | Reporting thresholds and formats are prescribed. Fabricating them would produce reports that are wrong in substance and in format. | **BLOCKING** for report generation; **PARAMETERISED** for detection thresholds | Compliance / MLRO |
| **Q-07** | Which sanctions and PEP list sources are required or accepted, and at what refresh frequency? | `AML-001`, `AML-002` | List selection is a compliance policy decision with licensing implications for the data itself. | **BLOCKING** | MLRO |
| **Q-08** | Is a credit reference bureau submission or enquiry obligation triggered by any part of the financing marketplace? | `CAP-005`, `CAF-003`, `CAF-007`, `CAF-008` | If CRB obligations attach, additional consent, data quality and submission requirements apply that are not in the URS. | **BLOCKING** | Legal & Regulatory |
| **Q-09** | Does the Financial Passport, or the sharing of it with lenders, constitute a regulated credit information or credit reference activity? | `FP-001…010`, `FPS-001…010` | This is the central regulatory question for the product's core differentiator. If it does, licensing, accuracy, dispute and retention obligations change substantially. | **BLOCKING** | Legal & Regulatory |
| **Q-10** | What foreign-exchange, corridor and declaration rules apply to outbound and inbound cross-border transfers, including purpose-of-payment codes and per-customer limits? | `XB-001…010`, `FX-003`, `GOAL-002` | Corridor permissions and declaration thresholds are regulatory. Enabling a corridor without confirmed rules risks unlawful transfers. | **BLOCKING** (corridors ship disabled) | Legal & Regulatory |

---

## B. Financial and monetary questions

| # | Question | Requirements | Why it cannot be guessed | Class | Owner |
|---|---|---|---|---|---|
| **Q-11** | What minor-unit scale and rounding policy applies to RWF and to each corridor currency, for (a) storage, (b) display, (c) FX computation, (d) fee computation? | `LED-005`, `LED-006`, `FX-008`, `XB-004…006` | Currency scale is a hard data-model decision. A wrong scale is a data migration on live money. RWF is conventionally handled without minor units, but the internal computation scale for FX and fees is a finance policy decision, not a convention. | **BLOCKING** for the currency reference seed; ledger mechanism built scale-agnostic | Finance |
| **Q-12** | What is the fee model — who charges what, to whom, and how is BuntuFin's share represented (customer fee, partner fee, revenue share, interchange)? | `PAY-006`, `XB-005`, `PRT-008`, `CAP-009` | `PAY-006` requires the *final customer fee* before authorisation. That number cannot be computed without a fee model. | **BLOCKING** for display of a final fee; **PARAMETERISED** for the fee engine | Finance / Commercial |
| **Q-13** | What FX margin, if any, is applied to the customer rate, and must it be disclosed separately from the fee? | `XB-004`, `XB-005`, `FX-010` | Disclosure obligations for FX margin differ by jurisdiction. Showing a rate that embeds an undisclosed margin may breach transparency rules and contradicts `FX-010`. | **BLOCKING** | Finance / Legal |
| **Q-14** | What quote validity period applies per corridor, and what happens to a funded transfer whose quote expires before partner submission? | `XB-007`, `FX-007`, `XB-010` | Determines whether the customer bears rate risk, and whether the recovery path is re-quote, refund or absorb. This is a commercial and legal allocation of risk. | **BLOCKING** for the expiry-after-funding path; happy path buildable | Finance / Legal |
| **Q-15** | What are the minimum data criteria for Passport generation (months of coverage, number of sources, minimum transaction count)? | `FP-001`, `FP-004…007` | A threshold set too low produces unreliable indicators presented to lenders; too high excludes the target population. Requires product and risk sign-off, not a developer's judgement. | **PARAMETERISED** | Product & Risk |
| **Q-16** | What thresholds define each Passport indicator band (e.g. what makes income consistency HIGH)? | `FP-004…008`, `FH-003/004` | These bands materially affect a customer's access to credit. They require documented, defensible methodology. | **PARAMETERISED**, with methodology document required before any band is displayed | Product & Risk |
| **Q-17** | What are the AML transaction monitoring rule thresholds (velocity, value, corridor risk, structuring patterns)? | `AML-003/004/005` | Detection thresholds are calibrated against typology and volume data that does not yet exist, and are a compliance decision. | **PARAMETERISED** | MLRO |
| **Q-18** | What fraud risk scores and step-up thresholds apply, and which actions require step-up? | `FRD-002/003/005/006` | Calibration decision with direct customer-friction and loss consequences. | **PARAMETERISED** | Fraud Ops |

---

## C. Partner and external API questions

All items in this section are **CONTRACT-PENDING**: the interface in
`BFR-STD-003` is built and exercised against a simulator; no production adapter
is written until the partner contract, sandbox credentials and error catalogue
are supplied.

| # | Question | Requirements | What is specifically unknown |
|---|---|---|---|
| **Q-19** | Identity verification provider contract | `ID-004`, `ID-005`, `ID-009` | Request/response schema, latency and timeout behaviour, partial-match semantics, what constitutes a referable (vs failed) result, evidence retention on the provider side, rate limits. |
| **Q-20** | Mobile money data and payment contracts (per operator) | `OF-003`, `PAY-002`, `SAV-002` | Whether data access is API-based or statement-based; transaction history depth; whether a stable per-transaction external identifier exists (this is a hard precondition for `OF-009` duplicate detection); reversal semantics; settlement timing. |
| **Q-21** | Bank data contracts | `OF-001`, `OF-002` | Availability of any open-banking style interface at all; authorisation model; balance vs transaction availability; refresh frequency limits. |
| **Q-22** | SACCO data availability | `OF-004` | Whether any programmatic interface exists. If not, the requirement is satisfiable only by manual/file ingestion, which changes the design and the `FP-003` provenance labelling. |
| **Q-23** | Payment rail contract | `PAY-002`, `PAY-007`, `PAY-009` | Idempotency support on the partner side (if absent, BuntuFin must carry the full deduplication burden — see `NFR-004`); terminal vs non-terminal status semantics; reversal API; callback/webhook reliability and signing. |
| **Q-24** | Cross-border partner contract | `XB-008`, `XB-009`, `XB-010`, `FX-001` | Quote lifetime; whether screening is performed by BuntuFin, the partner, or both; payout confirmation semantics; failure taxonomy; refund mechanics and timing; whether a partial delivery state exists. |
| **Q-25** | Lending partner contract | `CAP-006/007/010`, `CAF-001…009` | Offer schema and comparability of fields across providers; whether providers push or are polled; decline reason availability and permitted display (`CAF-004` forbids inventing one); disbursement confirmation source; repayment status feed. |
| **Q-26** | Savings provider contract | `SAV-002/004/009/010` | Whether BuntuFin instructs or transfers (`A-06`); confirmation timing (`SAV-010` forbids counting unconfirmed movements); product terms display obligations. |
| **Q-27** | Biller / institution directory | `GOAL-005`, `GOAL-006` | The authoritative source of approved billers; validation of an institution reference; how a school or utility account is verified before a sender-directed payment (`GOAL-006` forbids an unvalidated institution appearing as approved). |
| **Q-28** | SMS / USSD aggregator contract | `NOT-001`, `NOT-010`, §19 | Delivery receipt availability (required by `NOT-010`); USSD session timeout, menu depth and character limits; short-code provisioning; duplicate-submission semantics (§19 requires duplicate transaction prevention on resubmission). |

---

## D. Consequence summary

| Handling class | Count | Effect on the plan |
|---|---|---|
| BLOCKING | 11 | The affected features are designed, flagged off, and excluded from the W1–W6 build waves until answered. Q-01, Q-02 and Q-09 are on the critical path for the whole programme. |
| PARAMETERISED | 7 | Build proceeds; values seeded as `PLACEHOLDER` and gated at pre-production. |
| CONTRACT-PENDING | 10 | Adapters built against BuntuFin contracts with simulators; production implementations deferred. |

### Critical path

Three questions gate the largest amount of downstream work:

1. **Q-01 / Q-02 (regulatory status and fund holding)** — until answered, the
   ledger can be built structurally but its *legal semantics*, and therefore the
   reconciliation and settlement design, remain provisional. Affects 6 domains.
2. **Q-09 (is the Passport a regulated credit information activity)** — affects
   the entire `FP`/`FPS` design, plus `CAP`/`CAF` data flows. Affects 4 domains,
   40 requirements.
3. **Q-10 (cross-border corridor rules)** — `XB`, `FX` and `GOAL` ship disabled
   by feature flag until answered. Affects 3 domains, 30 requirements.

Nothing in this list prevents Wave 1 (foundation) from proceeding: `GOV`, `USR`,
`ID` (mechanism), `CON`, `LED` (structure) and the audit and API standards are
all buildable now, which is why they are sequenced first.
