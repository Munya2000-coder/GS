# BFR-FDS-02 — Domain 02: User and Role Management (`USR`)

**Context:** Identity & Access (`identity-svc`, `auth-svc`) · **Epic:** `EPIC-USR` — Correct people, correct access, provable
**Wave:** W1 Foundation · **Depends on:** `GOV` (roles config), audit-svc

---

### BFR-USR-001 — Individual customers `P1`

**Acceptance (URS):** Verified individual profile can be created and uniquely identified.

**Screens** — Registration (MSISDN → OTP → profile); Profile view/edit; Admin ▸ Customer detail.

**Workflow**
1. Prospect enters MSISDN; OTP verifies possession (`ID-001`).
2. A `customer` row is created with `customer_type = INDIVIDUAL`, `status = PENDING`.
3. Identity capture and verification follow (`ID-003`…`ID-005`); on success `status = ACTIVE`.
4. The customer id (BuntuID) is the platform-wide unique identifier used by every other context.

**API**
- `POST /api/v1/customers` → 201 `{customer_id, status}`
- `GET /api/v1/customers/me` → 200; `PATCH /api/v1/customers/me` → 200
- `GET /api/admin/v1/customers/{id}` → 200 (masked per role, `ADM-004`)

**Data** — `customer`, `customer_status_history`

**Rules**
- `BR-USR-001.1` `msisdn` is unique across active customers; a second registration on the same verified MSISDN resolves to the existing customer or a duplicate review case (`ID-008`).
- `BR-USR-001.2` The customer id is a UUID, never sequential, and never reused.
- `BR-USR-001.3` Identity fields are encrypted at rest (`NFR-002`).
- `BR-USR-001.4` A customer cannot transact while `PENDING` beyond the actions its KYC tier permits (`ID-007`).

**Exceptions**
- `EX-USR-001.1` MSISDN already registered → `DUPLICATE_RESOURCE`, existing-account recovery offered rather than a second profile.
- `EX-USR-001.2` Unverified MSISDN at activation → `VALIDATION_FAILED`.

**Events** — `customer.created`, `customer.verified`
**Audit** — creation, profile changes and status changes audited.

**Story `US-USR-001`** — As a prospective customer, I want to create a verified individual profile, so that I have one identity across every BuntuFin service.
*Given* a verified MSISDN, *when* I complete registration, *then* a uniquely identified profile exists and is usable across all products.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-USR-001-1 | POS | Registration creates uniquely identified profile |
| TC-USR-001-2 | NEG | Duplicate MSISDN does not create a second profile |
| TC-USR-001-3 | SEC | Identity fields encrypted; not present in logs or events |
| TC-USR-001-4 | PRM | One customer cannot read another's profile |
| TC-USR-001-5 | AUD | Creation and status changes audited |

---

### BFR-USR-002 — Business customers `P1`

**Acceptance (URS):** Business profile can be linked to one or more authorised individuals.

**Screens** — Business registration; Business ▸ People (owner, authorised users); Admin ▸ Business detail.

**Workflow**
1. A verified individual creates a business profile (`BIZ-001` captures the business detail).
2. The creator becomes `OWNER`; further individuals can be linked with defined permissions (`USR-008`).
3. Every linked individual authenticates as themselves and acts in the business context.

**API**
- `POST /api/v1/businesses` → 201
- `POST /api/v1/businesses/{id}/members` → 201 `{customer_id, role, permissions[]}`
- `GET /api/v1/businesses/{id}/members` → 200
- `DELETE /api/v1/businesses/{id}/members/{customer_id}` → 204

**Data** — `business_customer`, `business_delegation`

**Rules**
- `BR-USR-002.1` A business always has at least one active `OWNER`; removing the last owner is refused.
- `BR-USR-002.2` Linked individuals must themselves be verified customers — a business cannot create shadow identities.
- `BR-USR-002.3` Actions in a business context record both the acting individual and the business.
- `BR-USR-002.4` A business's financial position and history are never merged with an individual's personal position.

**Exceptions**
- `EX-USR-002.1` Removing the last owner → `VALIDATION_FAILED`.
- `EX-USR-002.2` Linking an unverified individual → `KYC_TIER_INSUFFICIENT`.

**Events** — `customer.created` (type BUSINESS), `business.member.added`
**Audit** — membership changes audited with actor and reason.

**Story `US-USR-002`** — As a business owner, I want my business profile linked to the individuals authorised to act for it, so that staff can operate the business account under their own identity.
*Given* a business profile, *when* I link a verified individual, *then* they can act for the business and every action records both them and the business.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-USR-002-1 | POS | Business links multiple authorised individuals |
| TC-USR-002-2 | NEG | Last owner cannot be removed |
| TC-USR-002-3 | PRM | Unlinked individual cannot act for the business |
| TC-USR-002-4 | AUD | Business action records both actor and business |

---

### BFR-USR-003 — Institutional partner users `P1`

**Acceptance (URS):** Partner employees can authenticate under their organisation.

**Screens** — Partner portal login; Partner ▸ Users; Admin ▸ Partner detail.

**Workflow**
1. `partner-svc` holds the partner organisation (`PRT-001`).
2. A partner administrator invites staff; invitees set credentials and MFA.
3. Every partner session is scoped to exactly one partner organisation.

**API**
- `POST /api/partner/v1/users/invite` → 201
- `POST /api/partner/v1/auth/token` → 200 (scoped token carrying `partner_id`)
- `GET /api/partner/v1/users` → 200 (own organisation only)

**Data** — `partner_user`, `role_assignment` scoped by `partner_id`

**Rules**
- `BR-USR-003.1` Every partner token carries an immutable `partner_id` claim; scope is enforced server-side on every request (`PRT-004`).
- `BR-USR-003.2` Partner users are never granted BuntuFin staff roles, and vice versa.
- `BR-USR-003.3` Partner user accounts are disabled automatically when the partner is suspended or offboarded (`PRT-003`, `PRT-010`).

**Exceptions**
- `EX-USR-003.1` Cross-organisation access attempt → `404` (existence not disclosed), audited as a security event.

**Events** — `partner.user.invited`, `partner.user.removed`
**Audit** — invitations, removals and cross-scope attempts audited.

**Story `US-USR-003`** — As a partner institution employee, I want to authenticate under my organisation, so that I can act on my institution's business without ever seeing another institution's data.
*Given* a partner user session, *when* I request a resource belonging to another partner, *then* it is not found and the attempt is audited.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-USR-003-1 | POS | Partner staff authenticate under their organisation |
| TC-USR-003-2 | SEC | Cross-organisation access returns 404 and raises a security event |
| TC-USR-003-3 | INT | Partner suspension disables its users |
| TC-USR-003-4 | PRM | Partner user cannot hold a staff role |

---

### BFR-USR-004 — Role-based access control `P1`

**Acceptance (URS):** Users can access only functions assigned to authorised roles.

**Screens** — Admin ▸ Roles (permission matrix); User detail ▸ roles.

**Workflow**
1. Permissions are declared per API operation and per admin screen.
2. Roles bundle permissions; the matrix is configuration (`GOV-001`).
3. Every request resolves the principal's effective permissions and authorises server-side.

**API**
- `GET /api/admin/v1/roles` → 200; `POST /api/admin/v1/roles/{id}/permissions` → 200
- `POST /api/admin/v1/users/{id}/roles` → 201 (reason required, `USR-010`)

**Data** — `role`, `role_permission`, `role_assignment`

**Rules**
- `BR-USR-004.1` Deny by default: an operation with no declared permission is inaccessible, not public.
- `BR-USR-004.2` Authorisation is evaluated per request; a revoked role takes effect on the next request without waiting for token expiry.
- `BR-USR-004.3` Permission checks are centralised; no endpoint implements its own ad-hoc check.
- `BR-USR-004.4` The permission matrix is versioned and its changes are regulated (`GOV-008`).

**Exceptions**
- `EX-USR-004.1` Missing permission → `PERMISSION_DENIED`, or `404` where enumeration is a risk.

**Events** — `role.assigned`, `role.revoked`
**Audit** — every grant and revocation (`USR-010`).

**Story `US-USR-004`** — As a security officer, I want access driven strictly by role, so that a user can never reach a function they are not authorised for.
*Given* a user without a permission, *when* they call the corresponding endpoint directly, *then* it is denied server-side regardless of what the UI showed.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-USR-004-1 | POS | Role holder can access its functions |
| TC-USR-004-2 | NEG | Non-holder denied, including by direct API call |
| TC-USR-004-3 | SEC | Undeclared endpoint is inaccessible, not open |
| TC-USR-004-4 | POS | Revocation effective on next request |
| TC-USR-004-5 | AUD | Grants and revocations audited |

---

### BFR-USR-005 — Multiple permitted roles `P2`

**Acceptance (URS):** Example: merchant owner can also be Circle member.

**Screens** — Profile ▸ context switcher (Personal / Business / Circle).

**Workflow**
1. A customer may simultaneously hold personal, merchant and Circle capacities.
2. The client presents a context switcher; the server resolves the union of permissions but scopes data by the active context.

**API** — `GET /api/v1/contexts` → 200 available contexts; context passed as a request header or path segment.

**Data** — `role_assignment` (multiple rows per user)

**Rules**
- `BR-USR-005.1` Permissions are the union of held roles; **data scope is not** — business data requires the business context, Circle data the Circle context.
- `BR-USR-005.2` Conflicting roles are prevented by a configured incompatibility list (e.g. AML analyst and customer support supervisor on the same account) (`USR-006`).
- `BR-USR-005.3` The active context is recorded on every action for audit.

**Exceptions**
- `EX-USR-005.1` Assigning incompatible roles → `VALIDATION_FAILED` naming the conflict.

**Events** — `role.assigned`
**Audit** — context recorded per action.

**Story `US-USR-005`** — As a merchant who also saves in a Circle, I want to hold both capacities on one login, so that I do not need separate accounts.
*Given* I hold both roles, *when* I switch context, *then* I see only that context's data while remaining one identity.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-USR-005-1 | POS | User operates in merchant and Circle contexts on one login |
| TC-USR-005-2 | PRM | Business data unreachable from personal context |
| TC-USR-005-3 | NEG | Incompatible role combination refused |
| TC-USR-005-4 | AUD | Active context recorded per action |

---

### BFR-USR-006 — Least privilege for administrative roles `P1`

**Acceptance (URS):** Standard support user cannot access AML case-management functions.

**Screens** — Admin navigation renders only permitted areas; Admin ▸ Roles ▸ sensitivity classification.

**Workflow**
1. Admin permissions are classified by sensitivity: `SUPPORT`, `OPERATIONS`, `FRAUD`, `AML`, `SECURITY`, `CONFIG`.
2. Roles are composed within a classification; cross-classification bundles require explicit approval and are flagged for review.
3. Sensitive areas (AML, fraud, security) additionally require MFA freshness (`ADM-001`).

**API** — all `/api/admin/v1/**` routes declare a permission and a sensitivity class.

**Data** — `role_permission(sensitivity_class)`

**Rules**
- `BR-USR-006.1` A support role can never hold AML case permissions, by configuration and by test.
- `BR-USR-006.2` A role granting more than one sensitive class requires dual approval to create.
- `BR-USR-006.3` Sensitive-area access requires a recent MFA assertion, not merely a valid session.
- `BR-USR-006.4` Privileged role holders are reviewed on a configured recertification cycle.

**Exceptions**
- `EX-USR-006.1` Support user calling an AML endpoint → `404`, security event raised (URS §21).

**Events** — `role.assigned` with sensitivity flag; security event on cross-class attempts.
**Audit** — all privileged assignments and access attempts.

**Story `US-USR-006`** — As a compliance officer, I want administrative roles held to least privilege, so that routine support staff cannot see or influence financial crime investigations.
*Given* a standard support user, *when* they attempt any AML case function, *then* it is not available and the attempt is recorded.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-USR-006-1 | NEG | Support user denied on every AML endpoint |
| TC-USR-006-2 | SEC | Denial does not disclose case existence |
| TC-USR-006-3 | PRM | Multi-sensitive-class role requires dual approval |
| TC-USR-006-4 | SEC | Stale MFA blocks sensitive area |
| TC-USR-006-5 | AUD | Cross-class attempt raises a security event |

---

### BFR-USR-007 — Configurable user status `P1`

**Acceptance (URS):** ACTIVE, SUSPENDED, RESTRICTED, CLOSED and PENDING supported.

**Screens** — Admin ▸ Customer ▸ status panel with reason; Customer app banner explaining any restriction in plain language.

**Workflow**
1. Status changes are made by an authorised role with a mandatory reason (`ADM-007`, `ADM-008`).
2. Each status maps to a configured capability set — what the customer may still do.
3. The customer is notified where notification is appropriate and permitted.

**API**
- `POST /api/admin/v1/customers/{id}/status` `{to_status, reason}` → 200
- `GET /api/v1/customers/me` → 200 includes `status` and `restriction_reason_key`

**Data** — `customer.status`, `customer_status_history`

**Rules**
- `BR-USR-007.1` Status semantics are configured, not coded: `RESTRICTED` may permit inbound but not outbound, per configuration.
- `BR-USR-007.2` A reason is mandatory on every status change.
- `BR-USR-007.3` `CLOSED` is terminal for transacting but never deletes history (`PRT-010` principle, `BFR-STD-006`).
- `BR-USR-007.4` Status is evaluated server-side on every action, not cached in the token.

**Exceptions**
- `EX-USR-007.1` Transaction attempt while suspended → `PERMISSION_DENIED` with a plain-language reason key.
- `EX-USR-007.2` Status change without reason → `VALIDATION_FAILED`.

**Events** — `customer.restricted`, `customer.closed`
**Audit** — from/to status, reason, actor.

**Story `US-USR-007`** — As a customer, I want to be told clearly when my account is restricted and what I can still do, so that I am not left guessing why an action failed.
*Given* a restricted account, *when* I attempt a blocked action, *then* I receive a clear explanation, and *when* I attempt a permitted action, *then* it still works.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-USR-007-1 | POS | Each status enforces its configured capability set |
| TC-USR-007-2 | NEG | Suspended customer cannot transact |
| TC-USR-007-3 | POS | Restricted customer can still perform permitted actions |
| TC-USR-007-4 | NEG | Status change without reason rejected |
| TC-USR-007-5 | AUD | Status history complete and immutable |

---

### BFR-USR-008 — Delegated access for business users `P2`

**Acceptance (URS):** Owner can authorise cashier without exposing owner credentials.

**Screens** — Business ▸ People ▸ Add person (role, permissions, expiry); Person detail ▸ activity.

**Workflow**
1. Owner invites a delegate and selects a permission set (e.g. accept payments, record sales — but not withdraw or change settings).
2. Delegate accepts and authenticates with their own credentials.
3. Delegate actions are attributed to them individually.

**API**
- `POST /api/v1/businesses/{id}/delegations` → 201 `{delegate_customer_id, permissions[], expires_at}`
- `DELETE /api/v1/businesses/{id}/delegations/{id}` → 204
- `GET /api/v1/businesses/{id}/delegations/{id}/activity` → 200

**Data** — `business_delegation`

**Rules**
- `BR-USR-008.1` Credentials are never shared; a delegate always has their own identity and PIN.
- `BR-USR-008.2` Delegations may be time-limited and are revocable immediately.
- `BR-USR-008.3` A delegate can never grant further delegations or change ownership.
- `BR-USR-008.4` Withdrawal and settings permissions are separable from payment-acceptance permissions.

**Exceptions**
- `EX-USR-008.1` Delegate attempting an unauthorised action → `PERMISSION_DENIED`.
- `EX-USR-008.2` Action after expiry → `PERMISSION_DENIED`.

**Events** — `business.delegation.granted`, `business.delegation.revoked`
**Audit** — grant, revocation and every delegate action.

**Story `US-USR-008`** — As a business owner, I want my cashier to accept payments without my credentials, so that I keep control of withdrawals and settings.
*Given* a cashier delegation limited to accepting payments, *when* the cashier attempts a withdrawal, *then* it is refused, and every sale they take is attributed to them.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-USR-008-1 | POS | Cashier accepts payments under own credentials |
| TC-USR-008-2 | NEG | Cashier cannot withdraw or change settings |
| TC-USR-008-3 | POS | Revocation effective immediately |
| TC-USR-008-4 | NEG | Expired delegation refused |
| TC-USR-008-5 | AUD | Delegate actions individually attributed |

---

### BFR-USR-009 — Partner-managed staff, subject to controls `P2`

**Acceptance (URS):** Partner administrator can invite/remove users within assigned scope.

**Screens** — Partner portal ▸ Users (invite, roles, remove); Admin ▸ Partner ▸ user oversight.

**Workflow**
1. BuntuFin grants a partner a user-administration capability and a seat/role ceiling.
2. The partner administrator manages staff within that ceiling.
3. BuntuFin retains oversight and can suspend any partner user.

**API**
- `POST /api/partner/v1/users` → 201; `DELETE /api/partner/v1/users/{id}` → 204
- `POST /api/admin/v1/partners/{id}/users/{uid}/suspend` → 200

**Data** — `partner_user`, `partner_capability`

**Rules**
- `BR-USR-009.1` A partner administrator can only grant roles within the set BuntuFin enabled for that partner — never escalate beyond it.
- `BR-USR-009.2` A partner cannot create users in another partner's scope.
- `BR-USR-009.3` BuntuFin can override any partner user decision.
- `BR-USR-009.4` Partner user administration is fully audited and visible to BuntuFin operations.

**Exceptions**
- `EX-USR-009.1` Attempt to grant a role outside the partner's enabled set → `PERMISSION_DENIED`.

**Events** — `partner.user.invited`, `partner.user.removed`
**Audit** — all partner user administration.

**Story `US-USR-009`** — As a partner administrator, I want to manage my own institution's users within the scope BuntuFin granted, so that I can onboard staff without a support ticket while staying inside agreed controls.
*Given* my partner scope, *when* I try to grant a role outside it, *then* it is refused.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-USR-009-1 | POS | Partner admin invites and removes within scope |
| TC-USR-009-2 | NEG | Role escalation beyond enabled set refused |
| TC-USR-009-3 | SEC | Cross-partner user creation refused |
| TC-USR-009-4 | POS | BuntuFin can suspend a partner user |
| TC-USR-009-5 | AUD | All partner user administration audited |

---

### BFR-USR-010 — Auditable privileged-role assignment `P1`

**Acceptance (URS):** Role grants/revocations record actor, target, date and reason.

**Screens** — Admin ▸ Access ▸ Role change history; Recertification review queue.

**Workflow**
1. Every grant or revocation captures actor, target, role, reason and timestamp.
2. Privileged grants raise a security event and appear in the recertification queue.
3. Reviewers periodically confirm or revoke standing privileged access.

**API**
- `POST /api/admin/v1/users/{id}/roles` `{role, reason}` → 201
- `DELETE /api/admin/v1/users/{id}/roles/{role}` `{reason}` → 204
- `GET /api/admin/v1/access/history?user_id=&role=&from=&to=` → 200

**Data** — `role_assignment` (append-only), `audit_event`

**Rules**
- `BR-USR-010.1` Reason is mandatory on grant and on revocation.
- `BR-USR-010.2` `role_assignment` rows are never updated; revocation sets `revoked_at` on a new logical state and retains the original.
- `BR-USR-010.3` Privileged grants alert security (URS §21).
- `BR-USR-010.4` A user cannot grant themselves a role.

**Exceptions**
- `EX-USR-010.1` Self-grant attempt → `PERMISSION_DENIED`, audited as a control-breach attempt.
- `EX-USR-010.2` Grant without reason → `VALIDATION_FAILED`.

**Events** — `role.assigned`, `role.revoked`
**Audit** — the record itself; immutable.

**Story `US-USR-010`** — As an auditor, I want every privileged role change recorded with who, what, when and why, so that standing access can be reviewed and defended.
*Given* a privileged role granted last quarter, *when* I review access history, *then* I see the actor, the target, the date and the stated reason.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-USR-010-1 | POS | Grant and revocation recorded with all four attributes |
| TC-USR-010-2 | NEG | Grant without reason rejected |
| TC-USR-010-3 | SEC | Self-grant refused and audited |
| TC-USR-010-4 | SEC | Assignment history cannot be modified |
| TC-USR-010-5 | INT | Privileged grant raises a security alert |
