# BFR-STD-005 — Authentication and Session Policy

**Realises URS §4**, and requirements `ADM-001`, `ID-001`, `FRD-002`, `FRD-006`.

> "Authentication policy shall be configurable." — every threshold below is a
> `config-svc` key (`GOV-001`), not a constant.

## 1. Supported mechanisms

| Mechanism | Used for | Requirement | Policy |
|---|---|---|---|
| **OTP (SMS)** | Registration, device binding, recovery, step-up fallback | `ID-001` | Configurable length, TTL, resend interval, max attempts; codes hashed at rest; single-use; never logged |
| **Secure PIN** | Primary customer transaction authorisation | URS §4 | Configurable length; blocklist of trivial sequences; hashed with a memory-hard KDF; per-device lockout after configured failures |
| **Password** | Staff and partner portals | URS §4 | Length and complexity policy; breach-list check; never reusable across the last N; expiry per policy |
| **Biometric (device)** | Customer app convenience unlock and step-up | URS §4 | Device-held; the platform receives a device attestation, never a biometric template |
| **MFA (TOTP / hardware / push)** | **Mandatory** for all privileged admin users | `ADM-001` | No admin session exists without a second factor; MFA cannot be disabled by the user |
| **Step-up challenge** | Risk-triggered mid-flow | `FRD-006` | Blocks the state transition until passed; challenge type chosen by risk band |

## 2. Session and token policy

| Control | Policy | Requirement |
|---|---|---|
| Access token | Short-lived JWT (default 15 min), audience-scoped per API surface | URS §4 |
| Refresh token | **Rotating**: each use issues a new token and invalidates the previous | URS §4 |
| Refresh reuse detection | Presenting a rotated-out refresh token revokes the entire token family and raises a security event | URS §21, `FRD-004` |
| Session expiry | Absolute and idle timeouts, configured per surface (admin shortest) | URS §4, `ADM-001` |
| Concurrent sessions | Listed to the customer, individually revocable | URS §4 |
| Logout | Revokes the refresh family server-side; never client-side only | URS §4 |
| Token binding | Bound to `device_id`; a token presented from an unbound device fails | `FRD-001` |

## 3. Device management

| Capability | Detail | Requirement |
|---|---|---|
| Device registration | First use binds a device record: id, platform, model class, first-seen, last-seen | `FRD-001` |
| New-device signal | A first-seen device raises a risk signal and triggers a **non-suppressible** security notification | `FRD-001`, `NOT-005` |
| Device listing and removal | Customer can view and remove their devices; removal revokes that device's tokens | URS §4 |
| Device limits | Configurable maximum active devices per customer | `GOV-001` |

## 4. Account recovery

Recovery is the highest-risk authentication path and is designed accordingly:

| Rule | Requirement |
|---|---|
| Recovery never reveals whether an account exists | URS §21 |
| Recovery requires possession of the verified MSISDN **plus** at least one additional configured factor | `ID-001` |
| A recovery that changes the MSISDN requires identity re-verification and a cooling-off period, both configurable | `ID-004`, `FRD-004` |
| Recovery raises a security event and a non-suppressible notification to the previous contact point | `NOT-005`, URS §21 |
| A configurable post-recovery restriction window limits high-risk actions | `ADM-007`, `GOV-006` |
| Suspicious recovery patterns are monitored and alerted | URS §21 |

## 5. Step-up authentication triggers (`FRD-006`)

Triggers are configured rules, not code. Defaults proposed for calibration
(`Q-18`):

| Trigger | Challenge |
|---|---|
| New device performing a money-moving action | OTP + PIN |
| First payment to a newly added beneficiary above a configured value | OTP + PIN |
| Transaction value above a configured step-up threshold | PIN (biometric where enrolled) |
| Risk band `HIGH` from the fraud engine | OTP + PIN |
| Risk band `CRITICAL` | Blocked pending manual review (`FRD-007`), not challengeable |
| Any change to security settings, beneficiaries or devices | PIN |

## 6. Authorisation model

| Layer | Enforcement |
|---|---|
| Authentication | Who the principal is |
| **RBAC** | What functions the role permits (`USR-004`, `USR-006`) |
| **Scope** | Which organisation's data a partner user may touch (`PRT-004`) |
| **KYC tier** | Which financial actions the customer's verification level permits (`ID-007`) |
| **Limits** | Whether this specific amount is permitted (`GOV-006`) |
| **Feature flags** | Whether the capability exists for this country/cohort at all (`GOV-004/005`) |

All six are evaluated server-side on every request. A client-side check is a
convenience, never a control.

## 7. Anti-automation and monitoring

| Control | Requirement |
|---|---|
| Progressive delay and lockout on repeated failures, per account and per source | `FRD-002` |
| Repeated failed login raises a security alert | URS §21 |
| OTP request throttling per MSISDN and per source | `FRD-002` |
| Credential stuffing detection across accounts | URS §21 |
| Every authentication event — success and failure — is auditable | `NFR-006` |
