# BFR-STD-002 — Domain Event Catalogue

**Realises URS §12.**

## 1. Envelope

Every event carries the URS §12 mandatory attributes:

```json
{
  "event_id": "uuid-v7",
  "event_type": "payment.completed",
  "schema_version": "1.0",
  "aggregate_type": "payment",
  "aggregate_id": "uuid",
  "occurred_at": "2026-07-14T09:21:44.512Z",
  "correlation_id": "uuid",
  "causation_id": "uuid",
  "producer": "payment-svc",
  "country_code": "RW",
  "data": { }
}
```

| Rule | Requirement |
|---|---|
| Events are published through a **transactional outbox** — never emitted for a rolled-back transaction, never lost for a committed one | `LED-009` |
| Consumers are idempotent, keyed on `event_id` | `NFR-004` |
| An event payload contains **references and non-sensitive facts**, never full identity documents, credentials or unmasked account numbers | `NFR-002`, `ADM-004` |
| Monetary values in payloads are `{amount_minor, currency_code}` | `LED-005` |
| Schema changes are additive within a major version; breaking changes bump `schema_version` and run both versions during migration | URS §15 |
| Every event is auditable and replayable into reporting read models | `RPT-*`, `NFR-006` |

## 2. Catalogue

Column *Emitted by* is the owning service; *Key consumers* is indicative.

### Customer and identity
| Event | Emitted by | Key consumers | Requirement |
|---|---|---|---|
| `customer.created` | identity-svc | notification, reporting, compliance | `USR-001` |
| `customer.verified` | identity-svc | passport, payment, reporting | `ID-005`, `ID-007` |
| `customer.restricted` | identity-svc | payment, switch, notification | `ADM-007`, `USR-007` |
| `customer.closed` | identity-svc | all | `USR-007` |

### Consent
| Event | Emitted by | Key consumers | Requirement |
|---|---|---|---|
| `consent.created` | consent-svc | audit | `CON-001` |
| `consent.granted` | consent-svc | connect, passport, capital | `CON-001…004` |
| `consent.revoked` | consent-svc | **connect (stops sync), passport (revokes shares)**, capital | `CON-005`, `OF-010` |
| `consent.expired` | consent-svc | connect, passport, notification | `CON-004`, `NOT-009` |

### Connections and transactions
| Event | Emitted by | Key consumers | Requirement |
|---|---|---|---|
| `connection.created` | connect-svc | passport, reporting | `OF-001` |
| `connection.synced` | connect-svc | insight, passport | `OF-007` |
| `connection.failed` | connect-svc | notification, operations | `OF-007/008` |
| `connection.disconnected` | connect-svc | passport, insight | `OF-010` |
| `transaction.imported` | connect-svc | insight, compliance | `OF-005` |
| `transaction.categorised` | insight-svc | passport | `CAT-001` |
| `transaction.corrected` | insight-svc | passport (recalculation), audit | `CAT-003`, `FH-009` |

### Financial Passport
| Event | Emitted by | Key consumers | Requirement |
|---|---|---|---|
| `passport.generated` | passport-svc | reporting, notification | `FP-001`, `RPT-004` |
| `passport.updated` | passport-svc | capital, reporting | `FP-009` |
| `passport.shared` | passport-svc | partner, reporting, audit | `FPS-005`, `RPT-004` |
| `passport.accessed` | passport-svc | customer data-access history, security monitoring | `FPS-006`, URS §21 |
| `passport.revoked` | passport-svc | partner, audit | `FPS-007` |

### Payments
| Event | Emitted by | Key consumers | Requirement |
|---|---|---|---|
| `payment.created` | payment-svc | compliance | `PAY-002` |
| `payment.authorised` | payment-svc | ledger, compliance | `PAY-005` |
| `payment.completed` | payment-svc | **notification (`NOT-007`)**, savings (`SAV-003` round-up), business, reporting, recon | `PAY-007` |
| `payment.failed` | payment-svc | notification (`NOT-008`), inventory (`INV-004`) | `PAY-008` |
| `payment.reversed` | payment-svc | ledger, notification, recon | `LED-003` |

### Savings
| Event | Emitted by | Key consumers | Requirement |
|---|---|---|---|
| `savings.goal.created` | savings-svc | reporting | `SAV-001`, `RPT-005` |
| `savings.rule.created` | savings-svc | reporting, audit | `SAV-002/004/008` |
| `savings.contribution.completed` | savings-svc | goal progress, notification, reporting | `SAV-010` |

### Circles
| Event | Emitted by | Key consumers | Requirement |
|---|---|---|---|
| `circle.created` | circle-svc | reporting | `CIR-001`, `RPT-006` |
| `circle.member.joined` | circle-svc | notification, reporting | `CIR-004/009` |
| `circle.contribution.due` | circle-svc | notification | `CG-006` |
| `circle.contribution.completed` | circle-svc | ledger projection, passport (with consent), reporting | `CIR-006`, `CG-008` |
| `circle.vote.created` / `circle.vote.closed` | circle-svc | notification | `CG-001` |
| `circle.payout.completed` | circle-svc | ledger, notification, reporting | `CG-004` |

### Merchant
| Event | Emitted by | Key consumers | Requirement |
|---|---|---|---|
| `merchant.created` | business-svc | reporting | `BIZ-001`, `RPT-003` |
| `merchant.payment.received` | business-svc | savings (reserve `SAV-007`), inventory, passport | `BIZ-004/005` |
| `merchant.sale.recorded` | business-svc | inventory (`INV-003`), passport (`BIZ-010`) | `BIZ-006` |

### Capital
| Event | Emitted by | Key consumers | Requirement |
|---|---|---|---|
| `capital.request.created` | capital-svc | reporting | `CAP-001` |
| `capital.application.submitted` | capital-svc | partner, reporting | `CAP-006`, `RPT-008` |
| `capital.offer.received` | capital-svc | notification, customer | `CAP-007` |
| `capital.offer.accepted` | capital-svc | partner, reporting | `CAF-005` |
| `capital.application.declined` | capital-svc | notification, reporting | `CAF-003/004` |
| `capital.disbursement.confirmed` | capital-svc | notification, passport, reporting | `CAF-006` |

### Cross-border
| Event | Emitted by | Key consumers | Requirement |
|---|---|---|---|
| `transfer.quote.created` | fx-routing-svc | reporting | `XB-002…006` |
| `transfer.funded` | switch-svc | compliance | `XB-008` |
| `transfer.screened` | compliance-svc | switch | `XB-008` |
| `transfer.sent` | switch-svc | reporting, recon | `XB-009` |
| `transfer.delivered` | switch-svc | notification, reporting, recon | `XB-009`, `RPT-007` |
| `transfer.failed` | switch-svc | notification (`NOT-008`), recovery (`XB-010`) | `XB-009/010` |
| `transfer.refunded` | switch-svc | ledger, notification | `XB-010` |

### Compliance, cases, complaints
| Event | Emitted by | Key consumers | Requirement |
|---|---|---|---|
| `fraud.alert.created` | compliance-svc | case manager, operations | `FRD-005` |
| `aml.alert.created` | compliance-svc | case manager | `AML-004/005` |
| `case.created` | compliance-svc | reporting | `AML-006` |
| `case.closed` | compliance-svc | reporting | `AML-009`, `RPT-009` |
| `complaint.created` | support-svc | SLA clock, reporting | `CMP-001/005` |
| `complaint.resolved` | support-svc | notification, reporting | `CMP-008`, `RPT-009` |

## 3. Event-driven obligations

Certain URS requirements are satisfied *only* by a subscription. These are
listed so a missing consumer is a detectable defect:

| Requirement | Mandatory subscription |
|---|---|
| `CON-005`, `OF-010` | connect-svc **must** consume `consent.revoked` and halt scheduling |
| `NOT-007` | notification-svc **must** consume `payment.completed` |
| `NOT-008` | notification-svc **must** consume `payment.failed` and `transfer.failed` |
| `SAV-003` | savings-svc **must** consume `payment.completed` for round-ups |
| `SAV-007` | savings-svc **must** consume `merchant.payment.received` |
| `INV-003/004` | business-svc **must** consume `payment.completed` / `payment.failed` |
| `RPT-001…009` | reporting-svc **must** consume every event listed above |
| `FPS-006` | passport-svc **must** record `passport.accessed` for every recipient read |
