# BFR-FDS-27 — Domain 27: Notifications (`NOT`)

**Context:** Notification (`notification-svc`) · **Epic:** `EPIC-NOT` — Tell people what they need to know, in their language, without being able to switch off what matters
**Wave:** W6 (from W1 for security notices) · **Depends on:** event bus, `GOV` · **Contract-pending:** `Q-28`

---

### BFR-NOT-001 — SMS notifications `P1`

**Acceptance (URS):** Valid message can be delivered through configured provider.

**Screens** — Admin ▸ Notification providers and delivery logs.

**Workflow**
1. A notification is rendered from its template in the recipient's language.
2. `SMSProviderAdapter` sends it; the provider message id is recorded.
3. Delivery receipts update the record where the provider supplies them (`NOT-010`).

**API** — internal, event-driven; `GET /api/admin/v1/notifications?customer_id=` → 200.

**Data** — `notification(channel = SMS, template_id, rendered_body_ref, provider_message_id, status)`

**Rules**
- `BR-NOT-001.1` SMS is the baseline channel, since it reaches customers without smartphones or data.
- `BR-NOT-001.2` Messages contain no full account numbers, no OTP for a different purpose, and no sensitive detail — SMS is not a confidential channel.
- `BR-NOT-001.3` Message length is managed so that critical content is never truncated away.
- `BR-NOT-001.4` Provider is configurable; a second provider can be added without code change.
- `BR-NOT-001.5` Rendered bodies are retained per the retention schedule, referenced rather than duplicated in logs.

**Exceptions**
- `EX-NOT-001.1` Provider failure → retried per policy; persistent failure alerts operations and, for critical notices, an alternative channel is attempted.

**Events** — consumes domain events; emits `notification.sent`.
**Audit** — dispatch and delivery recorded.

**Story `US-NOT-001`** — As a customer without a smartphone, I want important messages by SMS, so that I am kept informed regardless of my device.
*Given* a notifiable event, *when* it occurs, *then* an SMS is sent in my language and its delivery is recorded.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NOT-001-1 | POS | SMS delivered through the configured provider |
| TC-NOT-001-2 | SEC | No sensitive detail in the message body |
| TC-NOT-001-3 | POS | Message rendered in the recipient's language |
| TC-NOT-001-4 | ERR | Provider failure retried and alerted |
| TC-NOT-001-5 | POS | Critical content never truncated |

---

### BFR-NOT-002 — Push notifications `P2`

**Acceptance (URS):** Registered mobile device can receive push message.

**Screens** — App notification settings; in-app notification centre.

**Workflow**
1. The app registers a push token bound to the device and customer.
2. Push is attempted for eligible notifications, with SMS as fallback for critical ones.
3. Delivery status is recorded where available.

**API** — `POST /api/v1/devices/{id}/push-token` → 201.

**Data** — `device.push_token_handle`, `notification(channel = PUSH)`

**Rules**
- `BR-NOT-002.1` Push tokens are bound to a device and customer, and are revoked when the device is removed (`BFR-STD-005`).
- `BR-NOT-002.2` Push content is minimal; sensitive detail is behind authentication in the app, not in the notification body.
- `BR-NOT-002.3` A critical notification not confirmed as delivered by push falls back to SMS (`NOT-005`).
- `BR-NOT-002.4` Push tokens are stored as handles, never as raw secrets in the database.

**Exceptions**
- `EX-NOT-002.1` Token invalid or expired → removed and the customer's next app session re-registers.

**Events** — `notification.sent`
**Audit** — token registration and revocation audited.

**Story `US-NOT-002`** — As an app user, I want push notifications, so that I hear about activity immediately without waiting for an SMS.
*Given* a registered device, *when* a notifiable event occurs, *then* I receive a push, and a critical notice falls back to SMS if push fails.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NOT-002-1 | POS | Push delivered to a registered device |
| TC-NOT-002-2 | SEC | No sensitive detail in the push body |
| TC-NOT-002-3 | POS | Critical notice falls back to SMS |
| TC-NOT-002-4 | POS | Device removal revokes the push token |

---

### BFR-NOT-003 — Email notifications where email exists `P2`

**Acceptance (URS):** Email delivery is attempted and logged.

**Screens** — Notification preferences showing email where present.

**Workflow**
1. Where the customer has a verified email, email-eligible notifications are sent.
2. Where there is none, email is skipped cleanly with no error (`ID-002`).

**API** — internal.

**Data** — `notification(channel = EMAIL)`

**Rules**
- `BR-NOT-003.1` Absence of email is normal, not an error condition (`ID-002`).
- `BR-NOT-003.2` Email is never the only channel for a critical notification.
- `BR-NOT-003.3` Emails contain no sensitive detail beyond what the channel warrants.
- `BR-NOT-003.4` Delivery and bounce status are recorded (`NOT-010`); repeated bounces mark the address unusable and prompt the customer.

**Exceptions**
- `EX-NOT-003.1` No email on file → skipped silently; the notification still goes by its other channels.
- `EX-NOT-003.2` Hard bounce → address flagged; the customer is prompted to update it.

**Events** — `notification.sent`
**Audit** — dispatch and bounce handling recorded.

**Story `US-NOT-003`** — As a customer with an email address, I want notifications by email too, so that I have a durable record I can search.
*Given* no email on file, *when* a notification is sent, *then* the email channel is skipped without error and other channels still deliver.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NOT-003-1 | POS | Email sent where an address exists |
| TC-NOT-003-2 | POS | Absent email skipped cleanly |
| TC-NOT-003-3 | NEG | Email never the sole channel for a critical notice |
| TC-NOT-003-4 | POS | Bounce recorded and address flagged |

---

### BFR-NOT-004 — Configurable notification templates `P2`

**Acceptance (URS):** Content changes do not require code deployment.

**Screens** — Admin ▸ Templates (edit per channel and language, preview, version history, activate).

**Workflow**
1. Templates are versioned configuration per notification type, channel and language.
2. Editing creates a new version; activation requires approval for regulated notices.
3. Rendering resolves the active version at send time.

**API** — `POST /api/admin/v1/templates` → 201; `POST .../activate` → 200.

**Data** — `template(type, channel, language, body, version, status)`

**Rules**
- `BR-NOT-004.1` Content is data, not code — wording changes never require a release.
- `BR-NOT-004.2` A template must exist for every supported language before activation, or an explicit fallback is recorded (URS §18).
- `BR-NOT-004.3` Templates use a restricted, safe placeholder syntax; arbitrary expressions are not permitted (an injection risk).
- `BR-NOT-004.4` Regulated notices (security, complaint outcomes, restriction notices) require approval to change (`GOV-008`).
- `BR-NOT-004.5` The template version used is recorded on each notification, so what was sent is provable.

**Exceptions**
- `EX-NOT-004.1` Missing placeholder value at render → the notification is not sent with a blank; it fails, alerts, and falls back to a safe generic version for critical notices.

**Events** — `template.activated`
**Audit** — template changes and activations audited.

**Story `US-NOT-004`** — As a product manager, I want to improve notification wording without a release, so that we can act on customer confusion quickly.
*Given* a template change, *when* it is activated, *then* subsequent notifications use it and the version sent is recorded.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NOT-004-1 | POS | Content change applies without deployment |
| TC-NOT-004-2 | NEG | Activation blocked without all language variants or a recorded fallback |
| TC-NOT-004-3 | SEC | Arbitrary expressions rejected in templates |
| TC-NOT-004-4 | ERR | Missing placeholder never sends a blank |
| TC-NOT-004-5 | POS | Template version recorded per notification |

---

### BFR-NOT-005 — Mandatory security notifications not suppressible `P1`

**Acceptance (URS):** User preference cannot disable critical security notices.

**Screens** — Notification preferences show security notices as always on, greyed and explained.

**Workflow**
1. Notification types are classified: `SECURITY`, `SERVICE`, `MARKETING`.
2. `SECURITY` notices ignore preferences entirely.
3. The preferences screen explains why they cannot be turned off.

**API** — preference updates silently ignore attempts to disable `SECURITY` types and return the effective state.

**Data** — `template.notification_class`, `notification_preference`

**Rules**
- `BR-NOT-005.1` The dispatcher does not consult preferences for `SECURITY` notifications — the check is skipped structurally, not merely defaulted to on.
- `BR-NOT-005.2` `SECURITY` covers at minimum: new device, credential change, contact-detail change, recovery, restriction, and large or unusual transactions.
- `BR-NOT-005.3` A security notice is sent on the channel most likely to reach the customer, including the previous contact point on a contact change (`FRD-004`).
- `BR-NOT-005.4` Classification of a notification type is configuration, approved and audited.

**Exceptions**
- `EX-NOT-005.1` Attempt to disable a security notification → accepted by the API without error but has no effect; the effective state returned shows it still enabled.

**Events** — `notification.sent`
**Audit** — classification changes audited.

**Story `US-NOT-005`** — As a customer, I want security alerts that cannot be switched off, so that someone with access to my account cannot silence the warnings.
*Given* a preference attempting to disable security notices, *when* a security event occurs, *then* the notification is still sent.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NOT-005-1 | NEG | Security notification sent despite a disabling preference |
| TC-NOT-005-2 | SEC | Dispatcher does not consult preferences for SECURITY class |
| TC-NOT-005-3 | POS | Contact change notifies the previous contact point too |
| TC-NOT-005-4 | AUD | Classification changes approved and audited |

---

### BFR-NOT-006 — Marketing preferences separate from service messages `P1`

**Acceptance (URS):** Opt-out does not prevent operational notices.

**Screens** — Preferences with three clearly separated groups: security (always on), service, marketing.

**Workflow**
1. Marketing consent is a distinct consent record (`CON-001`).
2. Opting out of marketing affects only `MARKETING` notifications.
3. Service notices continue regardless.

**API** — `PUT /api/v1/notification-preferences` → 200 returning the effective state per class.

**Data** — `notification_preference` per class; marketing consent in `consent`.

**Rules**
- `BR-NOT-006.1` Marketing requires an affirmative opt-in and is revocable at any time (`CON-001`, `CON-005`).
- `BR-NOT-006.2` A marketing opt-out never suppresses service or security notices — the classes are independent by construction.
- `BR-NOT-006.3` Marketing content is clearly identifiable as marketing.
- `BR-NOT-006.4` Marketing suppression takes effect immediately.

**Exceptions**
- `EX-NOT-006.1` Attempt to send marketing without consent → blocked at dispatch and logged as a control event.

**Events** — `consent.revoked` for marketing.
**Audit** — preference and consent changes audited.

**Story `US-NOT-006`** — As a customer, I want to stop marketing without losing the messages I need, so that opting out does not leave me uninformed about my own money.
*Given* a marketing opt-out, *when* my payment completes, *then* I still receive the confirmation.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NOT-006-1 | POS | Marketing opt-out stops marketing only |
| TC-NOT-006-2 | POS | Service notices continue after opt-out |
| TC-NOT-006-3 | NEG | Marketing without consent blocked at dispatch |
| TC-NOT-006-4 | POS | Opt-out effective immediately |

---

### BFR-NOT-007 — Payment completion triggers confirmation `P1`

**Acceptance (URS):** Customer receives configured confirmation after authoritative completion.

**Screens** — In-app confirmation plus the configured external channel.

**Workflow**
1. `notification-svc` consumes `payment.completed`.
2. It renders and sends the confirmation with amount, recipient and reference.
3. Delivery is recorded.

**API** — internal, event-driven.

**Data** — `notification` linked to the payment.

**Rules**
- `BR-NOT-007.1` Confirmation is sent only after **authoritative** completion, never on submission (`PAY-008`).
- `BR-NOT-007.2` The confirmation carries the receipt reference so the customer can quote it (`PAY-010`).
- `BR-NOT-007.3` It is a `SERVICE` class notification; it is suppressible by preference but on by default, and never suppressed by a marketing opt-out.
- `BR-NOT-007.4` The confirmation is idempotent per payment: an event replay does not send a second message.

**Exceptions**
- `EX-NOT-007.1` Delivery failure → retried; the in-app record remains authoritative and available.

**Events** — consumes `payment.completed`.
**Audit** — dispatch recorded against the payment.

**Story `US-NOT-007`** — As a customer, I want confirmation when my payment completes, so that I have immediate assurance and a reference.
*Given* a completed payment, *when* completion is confirmed by the rail, *then* I receive a confirmation with its reference — and only then.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NOT-007-1 | POS | Confirmation sent after authoritative completion |
| TC-NOT-007-2 | NEG | No confirmation on submission or on failure |
| TC-NOT-007-3 | IDM | Event replay does not send twice |
| TC-NOT-007-4 | POS | Confirmation carries the receipt reference |

---

### BFR-NOT-008 — Failed transfers trigger notification `P1`

**Acceptance (URS):** Customer informed promptly after failure determination.

**Screens** — Failure notification with the reason in plain language and the next step.

**Workflow**
1. `notification-svc` consumes `payment.failed` and `transfer.failed`.
2. It sends a notification explaining what happened and what happens next, including any recovery path (`XB-010`).
3. Delivery is recorded.

**API** — internal, event-driven.

**Data** — `notification` linked to the failed transaction.

**Rules**
- `BR-NOT-008.1` The notification is sent on **failure determination**, not on first error — a retryable error in progress is not a failure.
- `BR-NOT-008.2` The reason is plain language, never a provider error code.
- `BR-NOT-008.3` It states what happens to the money: held, released, refunding, under investigation.
- `BR-NOT-008.4` It is `SERVICE` class and not suppressible by a marketing opt-out.
- `BR-NOT-008.5` Recovery milestones are also notified, so the customer is not left after the first message (`XB-010`).

**Exceptions**
- `EX-NOT-008.1` Failure reason not determinable → the notification says the transaction did not complete and that it is being investigated; it never guesses a reason.

**Events** — consumes `payment.failed`, `transfer.failed`.
**Audit** — dispatch recorded.

**Story `US-NOT-008`** — As a customer whose transfer failed, I want to be told promptly what happened and what happens to my money, so that I am not left guessing.
*Given* a failed transfer, *when* failure is determined, *then* I am notified in plain language with the status of my funds.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NOT-008-1 | POS | Notification sent on failure determination |
| TC-NOT-008-2 | NEG | Not sent on a retryable in-progress error |
| TC-NOT-008-3 | POS | Reason in plain language, not a provider code |
| TC-NOT-008-4 | POS | Fund status stated |
| TC-NOT-008-5 | POS | Recovery milestones also notified |

---

### BFR-NOT-009 — Consent expiry reminder `P3`

**Acceptance (URS):** Configured notice can be sent before expiration.

**Screens** — "Your permission for X expires soon" with a renew action.

**Workflow**
1. A scheduled job identifies consents approaching expiry within the configured window.
2. Reminders are sent with a direct renewal route.
3. On expiry, the customer is told what stopped (`CON-004`).

**API** — internal scheduling; renewal via `POST /api/v1/consents`.

**Data** — `consent.expires_at`, notification records.

**Rules**
- `BR-NOT-009.1` The reminder window is configuration.
- `BR-NOT-009.2` Reminders are `SERVICE` class, not marketing, since they concern the customer's own permissions.
- `BR-NOT-009.3` A reminder never renews consent automatically; renewal is always an affirmative act (`CON-001`).
- `BR-NOT-009.4` Reminder frequency is capped to avoid pressuring the customer.

**Exceptions**
- `EX-NOT-009.1` Consent revoked before the reminder → no reminder is sent.

**Events** — `consent.expiring`
**Audit** — reminders recorded.

**Story `US-NOT-009`** — As a customer, I want a reminder before a permission expires, so that a service I rely on does not stop without warning.
*Given* a consent expiring soon, *when* the window is reached, *then* I am reminded and can renew — but nothing renews itself.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NOT-009-1 | POS | Reminder sent within the configured window |
| TC-NOT-009-2 | NEG | Consent never auto-renewed |
| TC-NOT-009-3 | NEG | No reminder for a revoked consent |
| TC-NOT-009-4 | POS | Reminder frequency capped |

---

### BFR-NOT-010 — Delivery status recorded `P2`

**Acceptance (URS):** Sent/delivered/failed information retained when provider supplies it.

**Screens** — Admin ▸ Notification log with per-message status; customer support view of what was sent and when.

**Workflow**
1. Each dispatch records provider, message id, timestamp and initial status.
2. Delivery receipts update the status where the provider supplies them.
3. Where the provider supplies none, the status remains `SENT_UNCONFIRMED` — never `DELIVERED` by assumption.

**API** — `GET /api/admin/v1/notifications/{id}` → 200 with `status`, `provider_message_id`, `receipts[]`.

**Data** — `notification.status`, `delivery_receipt`

**Rules**
- `BR-NOT-010.1` `DELIVERED` is set only on a provider receipt; absence of a receipt is `SENT_UNCONFIRMED`, not delivered.
- `BR-NOT-010.2` Delivery status is never treated as proof that the customer read or acted on the message.
- `BR-NOT-010.3` Delivery failure rates per provider are monitored and feed provider health (`PRT-006`).
- `BR-NOT-010.4` Notification records support customer support and dispute handling (`CMP-007`).

**Exceptions**
- `EX-NOT-010.1` Provider supplies no receipts at all (`Q-28`) → the status vocabulary makes that visible rather than implying delivery.

**Events** — `notification.delivered`, `notification.delivery_failed`
**Audit** — delivery outcomes retained.

**Story `US-NOT-010`** — As a support agent, I want to see whether a notification actually reached the customer, so that I can answer "I was never told" accurately.
*Given* a provider that supplies no delivery receipts, *when* I check a message, *then* it shows as sent-unconfirmed rather than delivered.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-NOT-010-1 | POS | Delivery receipt updates the status |
| TC-NOT-010-2 | NEG | No receipt means SENT_UNCONFIRMED, not DELIVERED |
| TC-NOT-010-3 | POS | Failure rates feed provider health |
| TC-NOT-010-4 | PRM | Notification log access is role-limited and audited |
