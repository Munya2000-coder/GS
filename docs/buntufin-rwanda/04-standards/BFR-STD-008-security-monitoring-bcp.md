# BFR-STD-008 — Security Monitoring, Continuity, Backup, Environments and CI/CD

**Realises URS §21–§25**, and requirements `NFR-001/002/003/006/008/009`.

## 1. Security monitoring (URS §21)

Every detection below produces a security event with a correlation ID and feeds
the incident-management workflow.

| Detection | Signal source | Response | Requirement |
|---|---|---|---|
| Repeated failed login | auth-svc | Progressive lockout, alert, customer notification | `FRD-002`, `NOT-005` |
| Privileged-access changes | identity-svc, audit | Alert to security; role change is dual-recorded (actor + reason) | `USR-010`, `ADM-010` |
| Unusual API patterns | gateway | Rate limiting, credential review, alert | URS §14 |
| Unexpected credential use (new IP, new geography, dormant credential) | gateway, partner-svc | Alert; optional automatic credential suspension | `PRT-005` |
| Failed webhook verification | partner-svc | Alert; repeated failures suspend the endpoint | `PRT-007` |
| Large data export | admin, reporting, support | Alert; exports above a configured size require approval | `ADM-004` |
| **Mass Passport access** | passport-svc `share_access_log` | Alert on abnormal recipient read volume; possible partner suspension | `FPS-006`, `PRT-003` |
| Admin override spikes | audit | Alert to compliance; override rate is a reported KPI | `ADM-008/009` |
| Suspicious account-recovery activity | auth-svc | Alert; recovery may be blocked pending review | `BFR-STD-005` §4 |

Security alerts are routed to a named on-call rota, tracked as incidents with
severity, timeline and post-incident review.

## 2. Business continuity (URS §22)

Documented, tested recovery arrangements. Targets (RTO/RPO) are set per scenario
and confirmed with the business before production scale.

| Scenario | Arrangement | Verification |
|---|---|---|
| Database failure | Managed HA with automated failover; PITR from continuous archive | Failover drill |
| Provider outage | Circuit breaking, route exclusion (`FX-006`), manual disablement (`FX-009`, `GOV-009`); customer messaging | Provider-down game day |
| Region / cloud outage | Cross-zone by default; cross-region posture determined by the data-location decision (`Q-14`) | Region-loss tabletop, then drill |
| Message-queue failure | Transactional outbox means no event is lost; consumers replay from the outbox after recovery | Queue-kill drill |
| Payment-provider failure | `UNKNOWN` outcomes reconcile rather than retry (`BFR-STD-003`); recovery workflow for stuck transfers (`XB-010`) | Injected-timeout drill |
| Cybersecurity incident | Incident response plan: contain, preserve evidence, notify per obligation, recover, review | Incident simulation |
| Data corruption | PITR plus the append-only ledger and audit chain, which make corruption detectable | Restore-and-verify test |

**Recovery procedures are tested before full production scale** (URS §22) and
the evidence forms part of the release gate pack (`BFR-REL-001`).

## 3. Backup (URS §23)

| Requirement | Implementation |
|---|---|
| Approved schedule | Continuous WAL archiving plus scheduled full backups |
| Encrypted | At rest and in transit, with keys managed separately from the backup store |
| Monitored | Every backup job reports success/failure; a failed or missed backup pages the on-call |
| Retention policy | Per data class, aligned to `BFR-STD-006` |
| Restorable | Restore procedure documented and runnable by more than one engineer |
| **Periodic restore test evidence** | Scheduled restore rehearsals into an isolated environment, with a written result retained as gate evidence |

## 4. Environments (URS §24)

| Environment | Purpose | Data |
|---|---|---|
| Development | Feature work | Synthetic |
| Test | Automated test execution | Synthetic |
| System Integration Test | Cross-service and adapter-simulator integration | Synthetic |
| User Acceptance Test | Business and regulatory acceptance | Synthetic or anonymised |
| Pre-Production | Production-like validation, release rehearsal, restore tests | Anonymised |
| Production | Live sandbox operation | Live |

**Production data is not routinely copied into non-production environments**
(URS §24). Where representative data is required, it is synthetic or anonymised
through an approved, repeatable process. Any exception requires documented
approval and is time-boxed and audited.

## 5. CI/CD (URS §25)

Pipeline stages, all mandatory:

| Stage | Gate | Requirement |
|---|---|---|
| Build | Reproducible; artefact tagged with commit SHA and release version | URS §25 |
| Unit tests | Must pass; coverage floor on financial modules | `NFR-009` |
| Dependency scanning | No known critical vulnerabilities without a documented exception | URS §25 |
| Static code analysis | Includes the **no-float-on-money** rule (`LED-005`) and the **no-raw-status-string** rule (URS §5) | `LED-005` |
| Secret scanning | **Fails the build** on any detected credential | `NFR-003` |
| Container / image scanning | Base image and layer vulnerabilities | URS §25 |
| Integration + E2E tests | Critical flow suites (`BFR-STD-009`) | `NFR-009` |
| **Traceability check** | Every route declares `x-urs-requirements`; every P1 requirement has at least one passing test; RTM regenerated | `NFR-010` |
| **Placeholder check** | Fails pre-production promotion if any config key is still `PLACEHOLDER` | `BFR-ANA-002` |
| Automated migrations | Forward-only, reviewed, reversible by compensating migration; ledger and audit tables are never destructively altered | `LED-002`, `NFR-006` |
| Deployment approval gates | Pre-production and production require named approval; approver ≠ deployer for production | `GOV-008` principle |
| Deployment logs | Every deployment traceable to commit and release version | URS §25 |

## 6. Availability (`NFR-008`)

| Item | Definition |
|---|---|
| Target | ≥ 99.9% excluding approved maintenance |
| Measured on | The critical customer journey set: authentication, position display, payment submission, transfer status |
| Method | Synthetic probes from outside the platform, plus real-user error-rate telemetry |
| Reporting | Monthly availability report against target, with maintenance windows itemised |
| Maintenance | Approved, announced, and outside peak hours where possible |
