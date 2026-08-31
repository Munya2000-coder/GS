# BFR-STD-004 — API Standards: Versioning, Security, Idempotency, Errors

**Realises URS §14 and §15**, and requirements `NFR-004`, `NFR-005`.

## 1. Versioning (URS §15)

| Rule | Detail |
|---|---|
| Explicit version in the path | `/api/v1/customers`, `/api/v1/passports`, `/api/v1/transfers` |
| Breaking change ⇒ new version | Removing a field, narrowing a type, adding a required request field, changing an enum's meaning |
| Non-breaking additions ship in place | New optional request fields, new response fields, new enum values that clients are contractually required to tolerate |
| Deprecation | `Deprecation` and `Sunset` headers, minimum notice period per partner agreement, dual-running during migration |
| Every route declares its requirements | OpenAPI extension `x-urs-requirements: ["BFR-PAY-002"]` — the RTM is generated from this, so an undeclared route fails CI (`NFR-010`) |

## 2. API surface split

| Surface | Base | Audience | Auth |
|---|---|---|---|
| Customer API | `/api/v1/...` | Mobile app, web, USSD handler | OAuth 2.0 + PKCE, short-lived access token, rotating refresh token |
| Partner API | `/api/partner/v1/...` | Partner institutions | OAuth 2.0 client credentials or mTLS + signed requests, IP allowlist |
| Admin API | `/api/admin/v1/...` | BuntuFin staff | OIDC + mandatory MFA (`ADM-001`), short session |
| Webhooks (outbound) | partner-configured URL | Partners | Signed payload, verified endpoint (`PRT-007`) |

## 3. Security controls (URS §14)

| Control | Applies to | Requirement |
|---|---|---|
| TLS with approved cipher configuration; HSTS | all | `NFR-001` |
| OAuth 2.0 / OIDC | customer, partner, admin | URS §14 |
| Mutual TLS | partner API where the partner supports it | URS §14 |
| Request signing (detached JWS over method, path, body hash, timestamp, nonce) | partner API money-moving calls | URS §14 |
| Rotating credentials, per-partner, independently revocable | partner API | `PRT-005` |
| IP restrictions | partner API | URS §14 |
| Rate limiting, per credential and per endpoint class | all | URS §14 |
| Replay protection (nonce + timestamp window, nonce cache) | partner API, webhooks | URS §14 |
| Idempotency | all money-moving endpoints | `NFR-004`, `PAY-009` |
| Webhook signature verification, both directions | inbound partner callbacks and outbound webhooks | `PRT-007`, URS §21 |
| Access logging | **all** — including failed authentication and authorisation | URS §14, `NFR-006` |

## 4. Idempotency contract (`NFR-004`, `PAY-009`)

```http
POST /api/v1/payments
Idempotency-Key: 5c1f...  (client-generated, unique per logical operation)
```

| Rule | Behaviour |
|---|---|
| Key scope | Unique per `(principal, endpoint, key)` |
| Same key, same request body hash | Returns the **original** response, with `Idempotent-Replay: true` |
| Same key, **different** body hash | `409 IDEMPOTENCY_KEY_REUSED` — never executes |
| Key in flight | `409 REQUEST_IN_PROGRESS` — never executes twice concurrently |
| Retention | Configured window (default 24h), then the key expires |
| Coverage | Payments, transfers, savings instructions, circle contributions and payouts, offer acceptance, refunds |
| Partner rails without idempotency | BuntuFin carries the full burden: pre-flight duplicate check on `(customer, beneficiary, amount, window)` plus mandatory reconciliation of every `UNKNOWN` outcome (`Q-23`) |

## 5. Error contract (`NFR-005`)

Every non-2xx response, on every surface:

```json
{
  "error": {
    "code": "LIMIT_EXCEEDED",
    "message": "Transaction exceeds the daily limit for your account level.",
    "message_key": "error.limit.daily_exceeded",
    "correlation_id": "018f...",
    "details": [
      {"field": "amount", "issue": "exceeds_limit"}
    ],
    "retryable": false,
    "documentation_url": "https://developer.buntufin.rw/errors/LIMIT_EXCEEDED"
  }
}
```

| Rule | Requirement |
|---|---|
| `code` is a **stable** machine-readable enum; never reworded across versions | `NFR-005` |
| `correlation_id` is present on every response, success or failure, and appears in logs and audit | `NFR-005`, `ADM-010` |
| `message_key` allows the client to localise (URS §18); `message` is a fallback |
| No internal detail leaks: no stack traces, SQL, provider payloads or internal hostnames | `NFR-003` |
| Authorisation failures do not disclose existence: `404` rather than `403` where enumeration is a risk | `PRT-004`, `ADM-003` |

### Standard codes

`VALIDATION_FAILED`, `AUTHENTICATION_REQUIRED`, `STEP_UP_REQUIRED`,
`PERMISSION_DENIED`, `KYC_TIER_INSUFFICIENT`, `CONSENT_REQUIRED`,
`CONSENT_REVOKED`, `LIMIT_EXCEEDED`, `FEATURE_DISABLED`,
`STATE_TRANSITION_INVALID`, `QUOTE_EXPIRED`, `OFFER_EXPIRED`,
`IDEMPOTENCY_KEY_REUSED`, `REQUEST_IN_PROGRESS`, `DUPLICATE_RESOURCE`,
`PROVIDER_UNAVAILABLE`, `PROVIDER_REJECTED`, `RATE_LIMITED`,
`INTERNAL_ERROR`.

## 6. Payload conventions

| Concern | Convention |
|---|---|
| Money | `{"amount_minor": 250000, "currency": "RWF"}` — never a decimal string or float (`LED-005`) |
| Timestamps | RFC 3339 UTC (`"2026-07-14T09:21:44Z"`); clients localise (URS §18) |
| Identifiers | UUID strings; no sequential integers in public APIs |
| Pagination | Cursor-based: `?cursor=&limit=`; `limit` capped and low by default for low-bandwidth clients (`NFR-007`) |
| Field selection | `?fields=` on heavy resources, to keep mobile payloads small (`NFR-007`) |
| Masking | Applied server-side per role before serialisation (`ADM-004`) |
| Enums | UPPER_SNAKE, closed sets, documented in OpenAPI |
| Nulls | Absent means "not provided"; explicit `null` means "known to be empty" |
