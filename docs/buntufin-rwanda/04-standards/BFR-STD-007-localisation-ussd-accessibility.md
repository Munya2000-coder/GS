# BFR-STD-007 — Localisation, USSD and Accessibility

**Realises URS §18, §19 and §20**, and requirement `NFR-007`.

## 1. Localisation (URS §18)

| Rule | Implementation |
|---|---|
| Languages supported | Kinyarwanda (`rw`), English (`en`), French (`fr`) |
| **No user-facing core string is embedded in business logic** | Services return `message_key` + parameters; rendering happens in the presentation layer or the notification template engine (`NOT-004`) |
| Reason codes, not sentences | Passport and health explanations are reason codes rendered through localised templates (`FP-008`, URS §8) — a new language never requires a calculation change |
| Error messages | `message_key` in every error body (`BFR-STD-004` §5) |
| Notification content | Templates are configuration, per language and per channel (`NOT-004`) |
| Currency formatting | Format, symbol placement and grouping resolved from the `currency` reference table; RWF minor-unit handling per `Q-11` |
| Dates and times | Stored as canonical UTC; displayed in the customer's context (`BFR-DAT-002` conventions) |
| Language selection | `customer.preferred_language`, changeable at any time, applied to app, SMS and USSD |
| Fallback chain | `rw → en`, `fr → en`; a missing translation logs a defect and never renders a raw key to the customer |
| Translation completeness | CI check: every key present in the base catalogue exists in all supported catalogues before release |

## 2. USSD (URS §19)

USSD is a **restricted journey surface**, not a parallel product.

### Supported journeys

| Journey | Requirement | Notes |
|---|---|---|
| Balance / account position | `PAY-001` | Position only; no statement history |
| Send money | `PAY-002` | To saved beneficiaries first; new beneficiary requires the configured step-up path |
| Request money | `PAY-003` | |
| Savings contribution | `SAV-001`, `SAV-004` | Contribute to an existing goal; goal creation stays in app/web |
| Circle contribution | `CIR-006` | Contribute to an existing Circle |
| Transaction status | `PAY-007`, `XB-009` | Last N transactions, minimal detail |

Complex journeys — Passport analytics, sharing, capital applications, Circle
governance — are **not** offered on USSD; the menu redirects to app, web or
assisted support (URS §19).

### USSD session rules

| Rule | Requirement |
|---|---|
| Display no unnecessary sensitive information: masked identifiers only, no full names, no document data, no full account numbers | URS §19, `ADM-004` |
| Handle timeout explicitly: an abandoned session leaves no partially-authorised financial action | URS §19 |
| **Prevent duplicate transaction on resubmission**: every USSD money-moving action carries a server-generated idempotency key held against the session; a resubmitted identical action returns the original result | URS §19, `NFR-004`, `PAY-009` |
| PIN entry is masked and rate-limited; PIN is never echoed and never logged | `BFR-STD-005` |
| Menus are short enough for the aggregator's character limit, with pagination that does not lose session state | `Q-28` |
| The same server-side authorisation stack applies — role, tier, limits, flags | `ID-007`, `GOV-006` |
| Every USSD action is audited with channel `USSD` | `NFR-006` |

## 3. Accessibility and low bandwidth (URS §20, `NFR-007`)

| Principle | Implementation |
|---|---|
| Clear plain language | Content style guide; no unexplained financial jargon; complaint and payment statuses shown in plain language (`CMP-006`, `PAY-007`) |
| Large tap targets | Minimum target size enforced in the design system |
| Screen reader support | Semantic markup, labelled controls, meaningful reading order, announced state changes |
| **No colour-only status** | Every status carries an icon or text label as well as colour — applies to payment status, sync status, stale Passport indicators (`FPS-010`) and Circle contribution states (`CG-007`) |
| Lower-resolution screens | Layouts tested at the lowest supported device profile |
| Minimal data-heavy assets | No decorative imagery on critical journeys; icon sprites; compressed assets; no video on transactional paths |
| Low-bandwidth operation (`NFR-007`) | Small default page sizes; field selection (`?fields=`); aggressive client caching of reference data; retry-safe requests (idempotency) so a dropped connection is recoverable without double-spending |
| Offline behaviour | Read-only cached views are labelled with their age; no financial action is ever queued offline for later automatic submission |
| Testing | A constrained-connection test profile is part of the CI E2E suite for the critical journey set (`NFR-007`, `NFR-009`) |
