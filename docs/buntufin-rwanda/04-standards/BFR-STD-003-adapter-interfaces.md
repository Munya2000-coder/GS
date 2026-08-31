# BFR-STD-003 — External Service Adapter Contracts

**Realises URS §13.**

> "Claude shall implement interfaces rather than provider-specific coupling.
> Each provider implementation shall return a standard BuntuFin-domain response."

## 1. Universal adapter rules

| Rule | Requirement |
|---|---|
| A domain service depends only on the interface, never on a provider SDK type | `OF-002`, `OF-003`, `FX-001`, `ID-004` |
| Every method returns a `AdapterResult<T>`: `{outcome, data, provider_reference, provider_raw_ref, latency_ms, error}` where `outcome ∈ {SUCCESS, REJECTED, RETRYABLE_ERROR, PERMANENT_ERROR, TIMEOUT, UNKNOWN}` | `NFR-005` |
| `UNKNOWN` is a first-class outcome and **never** treated as failure for money-moving calls; it triggers reconciliation, not a retry that could double-spend | `PAY-009`, `REC-004/005` |
| Every call carries the platform `correlation_id` and an idempotency key where the operation is monetary | `NFR-004`, `NFR-005` |
| Every call is logged: provider, operation, correlation, latency, outcome — never the payload secrets | URS §14, `NFR-003` |
| Provider credentials resolve from the secret manager at call time | `NFR-003`, `PRT-005` |
| Every adapter reports health to `provider_health` | `FX-006`, `PRT-006` |
| Every adapter ships with a `Simulated*` implementation used by tests and by environments where the partner contract is unknown | `BFR-ANA-002` §C |
| Provider-specific error codes map to a documented BuntuFin error taxonomy; unmapped codes surface as `PERMANENT_ERROR` with the raw code retained | `NFR-005` |

## 2. Interface contracts

| Interface | Operations | Returns (BuntuFin domain) | Requirements | Contract status |
|---|---|---|---|---|
| `IdentityVerificationAdapter` | `verifyIdentity`, `verifyDocument`, `checkLiveness`, `getResult` | `IdentityVerificationOutcome{status, matched_attributes, provider_reference, evidence_ref, confidence}` | `ID-004/005/009` | Pending `Q-19` |
| `BankDataAdapter` | `initiateConnection`, `completeAuthorisation`, `listAccounts`, `fetchBalances`, `fetchTransactions`, `disconnect` | `NormalisedAccount[]`, `NormalisedTransaction[]` (URS §10/§11) | `OF-001/002/005/010` | Pending `Q-21` |
| `MobileMoneyAdapter` | as `BankDataAdapter`, plus `resolveSubscriber` | same | `OF-003`, `OF-005` | Pending `Q-20` |
| `PaymentRailAdapter` | `resolveRecipient`, `quoteFee`, `initiatePayment`, `getPaymentStatus`, `reversePayment` | `PaymentInitiationResult{rail_state, partner_reference}`, `PaymentStatus` mapped to the §5 Payment machine | `PAY-002/007/009` | Pending `Q-23` |
| `FXQuoteAdapter` | `getQuote`, `getRateTable`, `health` | `FxQuote{rate, rate_scale, valid_until, provider_id}` | `FX-001/006` | Pending `Q-24` |
| `CrossBorderTransferAdapter` | `validateRecipient`, `submitTransfer`, `getTransferStatus`, `requestRefund` | `TransferSubmission`, `TransferStatus` mapped to the §5 Cross-Border machine | `XB-008/009/010` | Pending `Q-24` |
| `SavingsProviderAdapter` | `openSavingsAccount`, `instructDeposit`, `getBalance`, `getProductTerms` | `SavingsInstructionResult{confirmed, provider_reference}` | `SAV-002/009/010` | Pending `Q-26` |
| `LendingPartnerAdapter` | `submitApplication`, `getApplicationStatus`, `getOffers`, `acceptOffer`, `getDisbursement`, `getRepaymentStatus` | `FinancingOffer[]` with **comparable** fields (amount, duration, total cost, fee breakdown, repayment schedule), `ProviderDecision` | `CAP-006/007`, `CAF-003/006/007` | Pending `Q-25` |
| `SanctionsScreeningAdapter` | `screen`, `getListVersion` | `ScreeningOutcome{result, matches[], list_source, list_version}` | `AML-001` | Pending `Q-07` |
| `PEPScreeningAdapter` | `screen`, `getListVersion` | as above | `AML-002` | Pending `Q-07` |
| `SMSProviderAdapter` | `send`, `getDeliveryReceipt` | `DeliveryResult{provider_message_id, status}` | `NOT-001/010` | Pending `Q-28` |
| `EmailProviderAdapter` | `send`, `getDeliveryReceipt` | as above | `NOT-003/010` | — |
| `PushNotificationAdapter` | `registerDevice`, `send`, `getDeliveryReceipt` | as above | `NOT-002/010` | — |
| `BillerAdapter` | `listBillers`, `validateAccount`, `payBill`, `getPaymentStatus` | `BillerValidationResult{valid, account_name_masked}`, `BillPaymentResult` | `GOAL-005/006` | Pending `Q-27` |

## 3. Comparability contract for financing offers (`CAP-007`)

`CAP-007` requires offers to be *comparable*. Any `LendingPartnerAdapter`
implementation must populate this normalised shape, or explicitly mark a field
`NOT_SUPPLIED` — it may never be inferred or estimated by BuntuFin:

```text
FinancingOffer {
  provider_partner_id          (mandatory - CAP-008)
  offered_amount_minor, currency
  duration_days
  total_repayable_minor        or NOT_SUPPLIED
  fee_breakdown[]              {fee_type, amount_minor or rate, basis}
  repayment_schedule[]         {due_date, amount_minor} or NOT_SUPPLIED
  offer_expires_at             (mandatory - CAF-009)
  provider_terms_ref
  provider_offer_reference
}
```

Where `total_repayable_minor` is `NOT_SUPPLIED`, the UI displays the field as
"not provided by this lender" — it does **not** compute one (`CAF-004`
principle: no invention).

## 4. Resilience policy

| Concern | Policy |
|---|---|
| Timeouts | Per-operation, configured (`GOV-001`); a monetary submission timeout resolves to `UNKNOWN`, never `FAILED` |
| Retries | Only for `RETRYABLE_ERROR` and only for idempotent operations; capped with exponential backoff |
| Circuit breaking | Opens on the configured error rate; feeds `provider_health` and therefore route eligibility (`FX-006`) |
| Fallback | Only where a second provider is configured and permitted for that corridor/product (`FX-002/003`) |
| Reconciliation of `UNKNOWN` | Every `UNKNOWN` monetary outcome creates a recon exception seed (`REC-004/005`) |
| Manual disablement | Operations can disable a provider without deployment (`FX-009`, `GOV-009`, `PRT-003`) |
