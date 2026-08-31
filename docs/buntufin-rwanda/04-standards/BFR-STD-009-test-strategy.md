# BFR-STD-009 — Test Strategy and Evidence Standard

**Realises URS §26**, and requirements `NFR-009`, `NFR-010`.

## 1. Mandatory test categories

> "Every applicable requirement shall have: positive functional test; negative
> functional test; permissions test; security consideration; audit
> verification; API test; integration test; error-handling test." (URS §26)

| Code | Category | What it proves |
|---|---|---|
| `POS` | Positive functional | The acceptance criterion is met on the happy path |
| `NEG` | Negative functional | The prohibited case is actually prohibited |
| `PRM` | Permissions | An unauthorised role, tier, scope or cohort cannot perform the action |
| `SEC` | Security | The security consideration for this requirement holds (injection, enumeration, masking, replay, leakage) |
| `AUD` | Audit verification | The action produced the expected audit record with actor, target, before/after |
| `API` | API contract | Request/response schema, status codes, stable error codes, correlation ID |
| `INT` | Integration | Behaviour against the adapter/simulator, including provider error paths |
| `ERR` | Error handling | Structured error, no leakage, correct recovery state |

### Additional categories for financial functions (URS §26)

| Code | Category | What it proves |
|---|---|---|
| `CON` | Concurrency | Parallel execution does not double-spend, double-post or corrupt state |
| `IDM` | Idempotency | The same idempotent request executes once (`NFR-004`) |
| `REV` | Reversal | A reversal produces a linked correcting entry and never edits the original (`LED-003`) |
| `REC` | Reconciliation | Postings match partner records, and mismatches surface as exceptions (`REC-*`) |
| `DEC` | Decimal / rounding | Arithmetic is exact in minor units and rounding is deterministic and reproducible (`LED-005`, `FX-008`) |

A requirement is **financial** if it moves money, computes an amount, or
records a monetary position: all of `LED`, `PAY`, `SAV`, `CIR`, `CG`, `XB`,
`FX`, `GOAL`, `REC`, plus `BIZ-008/009` and `CAF-006`.

## 2. Test case identification

```
TC-<DOMAIN>-<NNN>-<seq>          e.g. TC-PAY-009-3
```

Every test case declares, in a machine-readable marker:

```python
@urs("BFR-PAY-009", category="IDM")
def test_repeat_idempotency_key_does_not_create_second_debit(): ...
```

CI extracts these markers to build the RTM (`NFR-010`). A test without a
requirement marker, or a P1 requirement without a passing test, fails the
traceability gate.

## 3. Test levels

| Level | Scope | Environment | Data |
|---|---|---|---|
| Unit | A single component; adapters mocked | Local / CI | Synthetic |
| Integration | A service plus its database and simulated adapters | CI / SIT | Synthetic |
| Contract | Adapter implementations against the `BFR-STD-003` interface | CI | Simulator |
| End-to-end | Critical customer journeys across services | SIT / UAT | Synthetic |
| Non-functional | Load, low-bandwidth profile, resilience/chaos | Pre-Production | Anonymised |
| Security | SAST, DAST, dependency and secret scanning, penetration test | CI + scheduled | — |
| UAT | Business and regulatory acceptance against URS acceptance criteria | UAT | Synthetic |

## 4. Critical flow suites (`NFR-009`)

The following must have automated end-to-end coverage before sandbox launch:

| Suite | Journey | Requirements |
|---|---|---|
| `E2E-ONBOARD` | Register → OTP → identity capture → verification → tier assignment | `ID-001…007` |
| `E2E-CONSENT` | Grant consent → connect account → sync → revoke → verify sync stops | `CON-001…005`, `OF-001/010` |
| `E2E-PASSPORT` | Import → categorise → generate Passport → view explanation → share → recipient access → revoke | `FP-*`, `FPS-*` |
| `E2E-PAY` | Send money incl. fee display, confirmation, idempotent retry, failure, reversal | `PAY-002…010`, `LED-*` |
| `E2E-LEDGER` | Concurrent postings, hold/release, unbalanced rejection, reversal linkage | `LED-001…010` |
| `E2E-SAVE` | Create goal → rule fires on confirmed inflow → pause → cancel | `SAV-001…010` |
| `E2E-CIRCLE` | Create → members accept rules → contributions → proposal → N-of-M approval → payout | `CIR-*`, `CG-*` |
| `E2E-MERCHANT` | Merchant onboarding → QR payment → cash sale → turnover split by evidence type | `BIZ-001…010` |
| `E2E-CAPITAL` | Request → partner selection → submission → offer → accept → disbursement confirmation | `CAP-*`, `CAF-*` |
| `E2E-XBORDER` | Quote → accept → fund → screen → send → deliver; plus expiry, hold and refund paths | `XB-*`, `FX-*` |
| `E2E-AML` | Rule breach → alert → case → investigation → escalation → disposition | `AML-*` |
| `E2E-FRAUD` | New device → risk score → step-up → manual review → disposition | `FRD-*` |
| `E2E-COMPLAINT` | Submit → SLA clock → investigate → escalate → resolve | `CMP-*` |
| `E2E-RECON` | Ingest settlement file → match → each exception type → resolve | `REC-*` |
| `E2E-REPORT` | Generate each sandbox KPI report and export | `RPT-*` |

## 5. Specific high-risk test obligations

These are the tests that most directly defend the regulatory position, and are
called out so they cannot be quietly dropped:

| Obligation | Test |
|---|---|
| Ledger cannot post unbalanced | Attempt an unbalanced journal; assert atomic failure and no partial rows (`LED-009`) |
| Posted entries cannot be edited or deleted | Attempt `UPDATE`/`DELETE` as the application role; assert database-level denial (`LED-002`) |
| Audit cannot be modified | Same, on `audit_event`; verify hash chain detects tampering (`NFR-006`) |
| No double debit under concurrency | N parallel identical payment submissions with one idempotency key ⇒ exactly one debit (`PAY-009`, `NFR-004`) |
| Revoked consent stops collection | Revoke, then assert no further sync and no new imported rows (`CON-005`, `OF-010`) |
| Revocation does not delete retained records | Revoke, then assert consent and transaction history still retrievable (`CON-006`) |
| Expired share cannot be read | Access after expiry, after revocation, and after single use ⇒ denied and logged (`FPS-003/004/007`) |
| Expired quote cannot execute | Accept after expiry ⇒ `QUOTE_EXPIRED`, no funds moved (`XB-007`, `FX-007`) |
| Screening precedes release | Attempt to reach `SENT_TO_PARTNER` without a screening record ⇒ rejected (`XB-008`) |
| Model change does not rewrite history | Deploy a new classifier version; assert prior classifications unchanged and reproducible (`CAT-009`, `FP-009`) |
| Support role cannot reach AML cases | Assert `PERMISSION_DENIED`/`404` for every AML endpoint (`USR-006`, `AML-010`) |
| Partner cannot see another partner's data | Cross-tenant access attempts on every partner endpoint (`PRT-004`) |
| Maker cannot approve own change | Same actor proposes and approves ⇒ rejected (`GOV-008`) |
| Case cannot close blank | Close without disposition ⇒ rejected (`AML-009`, `CMP-008`) |
| Failed payment never shows completed | Force partner failure; assert UI and API state (`PAY-008`) |
| Failed sale does not reduce stock | Force payment failure after stock decrement attempt (`INV-004`) |
| Rounding is reproducible | Replay a stored quote's inputs ⇒ identical minor-unit result (`FX-008`) |
| Money is never a float | Static analysis rule; plus property test on arithmetic paths (`LED-005`) |

## 6. Evidence standard

Every executed test produces: test case ID, requirement ID(s), category,
environment, build/release version, execution timestamp, result, and a link to
the run artefact. This is the `Test Result` column of the RTM (`BFR-RTM-001`).

**No P1 requirement may enter production without successful traceability or a
documented, approved exception** (URS §27).
