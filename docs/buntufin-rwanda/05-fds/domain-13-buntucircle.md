# BFR-FDS-13 — Domain 13: BuntuCircle (`CIR`)

**Context:** Circles (`circle-svc`) · **Epic:** `EPIC-CIR` — Digitised group savings that members can trust
**Wave:** W3 · **Depends on:** `PAY`, `LED`, `USR`

> A Circle digitises a trust arrangement that already exists socially. The design
> principle throughout: the platform must make the group's money **more**
> visible and **less** alterable than the paper book it replaces.

---

### BFR-CIR-001 — Create a savings Circle `P1`

**Acceptance (URS):** Founder can define name, purpose, contribution and schedule.

**Screens** — New Circle ▸ name, purpose, model (rotating/accumulating), contribution amount, frequency, start date; Rules preview; Invite members.

**Workflow**
1. Founder defines the Circle and its rules.
2. Rules are saved as `circle_rule_version` v1 (`CIR-005`).
3. The Circle is `DRAFT` until the minimum membership accepts the rules (`CIR-004`).
4. On activation the contribution schedule is generated.

**API** — `POST /api/v1/circles` → 201; `POST /api/v1/circles/{id}/activate` → 200.

**Data** — `circle`, `circle_rule_version`, `circle_member`, `contribution_schedule`

**Rules**
- `BR-CIR-001.1` A Circle cannot activate until the configured minimum number of members have accepted the rules.
- `BR-CIR-001.2` Contribution amount and frequency are part of the rule version, not mutable fields on the Circle.
- `BR-CIR-001.3` The founder is a member with an administrator role, not an owner with unilateral financial power (`CIR-008`, `CG-005`).
- `BR-CIR-001.4` Circle limits (max members, max contribution) are configuration (`GOV-006`).

**Exceptions**
- `EX-CIR-001.1` Activation below minimum membership → `VALIDATION_FAILED`.
- `EX-CIR-001.2` Contribution above the configured maximum → `LIMIT_EXCEEDED`.

**Events** — `circle.created`
**Audit** — creation and activation audited.

**Story `US-CIR-001`** — As a group founder, I want to set up a Circle with our agreed contribution and schedule, so that our existing arrangement is recorded accurately.
*Given* the group's terms, *when* I create the Circle, *then* they are stored as version 1 and members must accept them before it starts.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CIR-001-1 | POS | Circle created with name, purpose, contribution and schedule |
| TC-CIR-001-2 | NEG | Activation below minimum membership refused |
| TC-CIR-001-3 | NEG | Contribution above configured maximum refused |
| TC-CIR-001-4 | POS | Rules stored as version 1 |
| TC-CIR-001-5 | PRM | Only a member can view the Circle |

---

### BFR-CIR-002 — Rotating savings model `P1`

**Acceptance (URS):** Payout order and cycles can be configured.

**Screens** — Circle ▸ Payout order (list with positions and dates); Cycle progress.

**Workflow**
1. The rule version specifies `model = ROTATING`, the payout order and the number of cycles.
2. Each cycle collects contributions and pays out to the member at that position.
3. The full order is visible to all members from the start (`CG-004`).

**API** — `GET /api/v1/circles/{id}/payout-order` → 200; `GET /api/v1/circles/{id}/cycles` → 200.

**Data** — `circle_cycle`, `payout_order(member_id, position, cycle_number)`

**Rules**
- `BR-CIR-002.1` Payout order is fixed at activation and changeable only through the governance process (`CG-005`).
- `BR-CIR-002.2` A cycle pays out only when its collection rules are satisfied, per the rule version.
- `BR-CIR-002.3` Every member sees the whole order, including their own position, from the start.
- `BR-CIR-002.4` Payout order can be randomised at activation if the group chose that, and the randomisation is recorded and reproducible.

**Exceptions**
- `EX-CIR-002.1` Payout due with contributions outstanding → follows the rule version (proceed, delay, or partial), never an undocumented default.

**Events** — `circle.payout.completed`
**Audit** — cycle progression and payouts.

**Story `US-CIR-002`** — As a Circle member, I want a rotating payout order I can see from the start, so that I know exactly when my turn comes.
*Given* an activated rotating Circle, *when* I view it, *then* I see the full payout order and the date of my turn.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CIR-002-1 | POS | Payout order configured and visible to all members |
| TC-CIR-002-2 | POS | Cycle pays out per the rule version |
| TC-CIR-002-3 | NEG | Order cannot be changed outside governance |
| TC-CIR-002-4 | POS | Randomised order recorded and reproducible |
| TC-CIR-002-5 | POS | Outstanding contributions handled per rules, not by default |

---

### BFR-CIR-003 — Accumulating savings model `P1`

**Acceptance (URS):** Contributions can remain pooled toward configured goal.

**Screens** — Circle ▸ Pool balance and goal progress; Contribution history.

**Workflow**
1. The rule version specifies `model = ACCUMULATING` with a group goal.
2. Contributions accumulate in the Circle's ledger account.
3. Distribution occurs at the configured trigger, subject to governance approval (`CG-002`).

**API** — `GET /api/v1/circles/{id}/pool` → 200.

**Data** — `circle` ledger account, `circle_contribution`

**Rules**
- `BR-CIR-003.1` The pool balance is the Circle's ledger account balance — not a separately maintained figure (`LED-*`).
- `BR-CIR-003.2` Distribution requires the approvals the rule version specifies.
- `BR-CIR-003.3` Each member's share is calculated per the documented rule and shown before any distribution.
- `BR-CIR-003.4` A member's contribution record is never merged into an anonymous pool figure — individual attribution is preserved (`CIR-006`).

**Exceptions**
- `EX-CIR-003.1` Distribution attempted without the required approvals → refused.

**Events** — `circle.contribution.completed`, `circle.payout.completed`
**Audit** — pool movements audited.

**Story `US-CIR-003`** — As a group saving for a shared purpose, we want contributions pooled towards our goal, so that we can see collective progress while keeping individual records.
*Given* an accumulating Circle, *when* members contribute, *then* the pool grows and each member's contribution remains individually attributed.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CIR-003-1 | POS | Contributions accumulate towards the goal |
| TC-CIR-003-2 | POS | Pool balance equals the ledger account balance |
| TC-CIR-003-3 | NEG | Distribution without approvals refused |
| TC-CIR-003-4 | POS | Individual attribution preserved |

---

### BFR-CIR-004 — Members accept rules before participation `P1`

**Acceptance (URS):** Acceptance timestamp and rule version recorded.

**Screens** — Join Circle ▸ full rules displayed ▸ Accept; Members list showing who has accepted which version.

**Workflow**
1. An invited member sees the current rule version in full.
2. They accept explicitly; acceptance records the member, version and timestamp.
3. Only accepted members may contribute or vote.

**API** — `POST /api/v1/circles/{id}/members/{member_id}/accept` `{rule_version}` → 200.

**Data** — `rule_acceptance(member_id, rule_version_id, accepted_at)`

**Rules**
- `BR-CIR-004.1` No contribution or vote is accepted from a member who has not accepted the current rule version.
- `BR-CIR-004.2` Acceptance is per version: a new rule version requires fresh acceptance for the changes to bind that member (`CIR-005`).
- `BR-CIR-004.3` Acceptance records are append-only.
- `BR-CIR-004.4` Rules are shown in the member's language (URS §18).

**Exceptions**
- `EX-CIR-004.1` Contribution attempt without acceptance → `PERMISSION_DENIED` with a prompt to review and accept.

**Events** — `circle.member.joined`
**Audit** — acceptances recorded with version and timestamp.

**Story `US-CIR-004`** — As a Circle member, I want to see and accept the rules before I put money in, so that everyone is bound to the same agreed terms.
*Given* an invitation, *when* I accept the rules, *then* my acceptance is recorded against that exact version.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CIR-004-1 | POS | Acceptance recorded with version and timestamp |
| TC-CIR-004-2 | NEG | Contribution without acceptance refused |
| TC-CIR-004-3 | POS | New version requires fresh acceptance |
| TC-CIR-004-4 | SEC | Acceptance records append-only |
| TC-CIR-004-5 | POS | Rules displayed in the member's language |

---

### BFR-CIR-005 — Circle rules version-controlled `P1`

**Acceptance (URS):** Historical and current rules are retrievable.

**Screens** — Circle ▸ Rules ▸ version history with diffs and effective dates.

**Workflow**
1. A rule change creates a new version through the governance process (`CG-001`).
2. The new version takes effect only after the required approvals and from its effective date.
3. All versions remain retrievable, with the version in force at any past date resolvable.

**API** — `GET /api/v1/circles/{id}/rules/versions` → 200; `GET .../rules?as_of=` → 200.

**Data** — `circle_rule_version` (append-only)

**Rules**
- `BR-CIR-005.1` Rule versions are append-only; a version in force is never edited.
- `BR-CIR-005.2` A rule change requires the approval threshold defined by the **current** version — a group cannot lower its own threshold in the same act that uses it.
- `BR-CIR-005.3` Every contribution, vote and payout records the rule version under which it occurred.
- `BR-CIR-005.4` Members are notified of a proposed change before it takes effect.

**Exceptions**
- `EX-CIR-005.1` Editing an in-force version → `PERMISSION_DENIED`; a new version is required.

**Events** — `circle.rules.versioned`
**Audit** — proposal, approvals and activation.

**Story `US-CIR-005`** — As a Circle member, I want rule changes recorded as versions, so that we can always see what the rules were when something happened.
*Given* a payout made in March, *when* we review it later, *then* we can see the rules that applied at that time.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CIR-005-1 | POS | New version created; old version retrievable |
| TC-CIR-005-2 | SEC | In-force version cannot be edited |
| TC-CIR-005-3 | POS | Change requires the current version's threshold |
| TC-CIR-005-4 | POS | Every transaction records its rule version |
| TC-CIR-005-5 | POS | As-of query resolves the historically correct version |

---

### BFR-CIR-006 — Contributions tracked per member `P1`

**Acceptance (URS):** Paid, due, late and missed status available.

**Screens** — Circle ▸ Contributions grid (members × periods) with status per cell; My contributions.

**Workflow**
1. The schedule generates a due contribution per member per period.
2. Each is `DUE`, then `PAID`, `LATE` or `MISSED` per the rule version's grace period.
3. Members see the whole grid; the platform does not hide who is behind (this is the point of a Circle).

**API** — `GET /api/v1/circles/{id}/contributions?period=` → 200; `POST /api/v1/circles/{id}/contributions` → 201.

**Data** — `contribution_schedule`, `circle_contribution(status)`

**Rules**
- `BR-CIR-006.1` Status derives from confirmed payments and the schedule — never set manually by an administrator.
- `BR-CIR-006.2` Only confirmed money counts as paid (`PAY-008`, `SAV-010` principle).
- `BR-CIR-006.3` The grid is visible to all members, showing display names only — no other personal data (`CIR-007`).
- `BR-CIR-006.4` Grace periods and late definitions come from the rule version.

**Exceptions**
- `EX-CIR-006.1` Partial contribution → recorded as partial with the shortfall shown; the rule version decides whether it counts as paid.
- `EX-CIR-006.2` Contribution reversed after being marked paid → status reverts with a linked correction and the member is notified.

**Events** — `circle.contribution.due`, `circle.contribution.completed`
**Audit** — contribution status changes with their cause.

**Story `US-CIR-006`** — As a Circle member, I want to see who has paid and who has not, so that the group's accountability is real rather than assumed.
*Given* a contribution period, *when* I view the Circle, *then* I see each member's status for that period.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CIR-006-1 | POS | Paid, due, late and missed all represented |
| TC-CIR-006-2 | NEG | Status cannot be set manually by an administrator |
| TC-CIR-006-3 | NEG | Unconfirmed payment does not count as paid |
| TC-CIR-006-4 | REV | Reversal reverts status with a correction |
| TC-CIR-006-5 | PRM | Non-members cannot see the grid |

---

### BFR-CIR-007 — Members view transparent Circle ledger `P1`

**Acceptance (URS):** Authorised members see group transactions and references.

**Screens** — Circle ▸ Ledger: every movement with date, member, amount, type and reference.

**Workflow**
1. The Circle ledger view is a projection of the Circle's ledger account.
2. All members see all group movements for the periods in which they were members.
3. Each entry carries a reference that can be quoted in a dispute (`CG-009`).

**API** — `GET /api/v1/circles/{id}/ledger?from=&to=` → 200.

**Data** — projection over `journal`/`journal_line` for the Circle account.

**Rules**
- `BR-CIR-007.1` The Circle ledger is a **projection** of the general ledger, never a separate book that could diverge.
- `BR-CIR-007.2` Members see other members by display name only; no MSISDN, identity data or personal balances outside the Circle.
- `BR-CIR-007.3` A member sees the periods during which they were a member; earlier history is summarised, not itemised, unless the rule version says otherwise.
- `BR-CIR-007.4` Every entry has a stable reference.

**Exceptions**
- `EX-CIR-007.1` Former member requesting current detail → sees their own historical records and group summaries, not ongoing detail.

**Events** — none
**Audit** — ledger views by members are logged at summary level.

**Story `US-CIR-007`** — As a Circle member, I want to see the group's full transaction record, so that trust is based on visible evidence rather than on one person's word.
*Given* Circle activity, *when* I open the ledger, *then* I see every group movement with its reference.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CIR-007-1 | POS | All group movements visible to members |
| TC-CIR-007-2 | SEC | No personal data beyond display names exposed |
| TC-CIR-007-3 | POS | Ledger reconciles exactly to the general ledger |
| TC-CIR-007-4 | PRM | Former member sees only their entitled scope |
| TC-CIR-007-5 | POS | Every entry has a quotable reference |

---

### BFR-CIR-008 — Administrators cannot delete financial history `P1`

**Acceptance (URS):** Posted contributions cannot be silently removed.

**Screens** — Circle admin tools offer correction requests, never delete.

**Workflow**
1. Circle administrators have organisational powers (invite, remind, propose) but no financial-record powers.
2. An erroneous contribution is corrected by a linked reversal through the governance process, visible to all members.

**API** — no delete endpoint exists for contributions or Circle ledger entries.

**Data** — contributions and journals are append-only (`LED-002`).

**Rules**
- `BR-CIR-008.1` No Circle role can delete or edit a posted contribution — the capability does not exist for anyone.
- `BR-CIR-008.2` Corrections are reversals visible to every member, not quiet adjustments.
- `BR-CIR-008.3` A correction requires the approval threshold in the rule version (`CG-002`).
- `BR-CIR-008.4` Removing a member never removes their contribution history.

**Exceptions**
- `EX-CIR-008.1` Delete attempt → `PERMISSION_DENIED`, audited as a control-breach attempt.

**Events** — `circle.contribution.reversed`
**Audit** — every correction with proposer, approvers and reason.

**Story `US-CIR-008`** — As a Circle member, I want it to be impossible for an administrator to quietly delete a contribution, so that the group record cannot be manipulated by whoever holds the phone.
*Given* a posted contribution, *when* an administrator attempts to delete it, *then* it is refused and the attempt is recorded.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CIR-008-1 | SEC | No delete path exists for any Circle role |
| TC-CIR-008-2 | POS | Correction is a visible reversal requiring approval |
| TC-CIR-008-3 | NEG | Member removal retains contribution history |
| TC-CIR-008-4 | AUD | Delete attempt audited |

---

### BFR-CIR-009 — Member invitation `P2`

**Acceptance (URS):** Invite via supported phone/link/QR workflow.

**Screens** — Circle ▸ Invite (contact, link, QR); Pending invitations with status.

**Workflow**
1. An authorised member creates an invitation by MSISDN, shareable link or QR.
2. The invitee (registering first if needed) opens it, reviews the rules and accepts (`CIR-004`).
3. Invitations expire and can be revoked.

**API** — `POST /api/v1/circles/{id}/invitations` → 201; `POST /api/v1/invitations/{token}/accept` → 200.

**Data** — `circle_invitation(token_hash, channel, expires_at, status)`

**Rules**
- `BR-CIR-009.1` Invitation tokens are high-entropy, stored hashed, single-use and expiring.
- `BR-CIR-009.2` Accepting an invitation never bypasses rule acceptance or membership limits.
- `BR-CIR-009.3` Only members with the invite permission can invite; this is set by the rule version.
- `BR-CIR-009.4` Invitation volume is rate-limited to prevent the Circle being used as a spam vector.

**Exceptions**
- `EX-CIR-009.1` Expired or used token → `VALIDATION_FAILED`, no membership created.
- `EX-CIR-009.2` Circle at its member limit → invitation cannot be accepted; the inviter is told.

**Events** — `circle.member.invited`, `circle.member.joined`
**Audit** — invitations and acceptances audited.

**Story `US-CIR-009`** — As a Circle administrator, I want to invite members by phone, link or QR, so that people can join in whatever way is easiest for them.
*Given* an invitation link, *when* the invitee accepts and agrees the rules, *then* they become a member.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CIR-009-1 | POS | Invitation by each supported channel works |
| TC-CIR-009-2 | SEC | Token single-use, hashed, expiring |
| TC-CIR-009-3 | NEG | Acceptance still requires rule acceptance |
| TC-CIR-009-4 | NEG | Member limit blocks acceptance |
| TC-CIR-009-5 | SEC | Invitation rate-limited |

---

### BFR-CIR-010 — Member exit follows configurable rules `P2`

**Acceptance (URS):** Exit action triggers configured settlement/approval process.

**Screens** — Member ▸ Leave Circle, showing the settlement consequence per the rules; Exit request status.

**Workflow**
1. A member requests exit.
2. The rule version determines the process: immediate, approval-required, or settlement-required.
3. On completion the member becomes `EXITED`; their history remains (`CIR-008`).

**API** — `POST /api/v1/circles/{id}/members/{id}/exit` → 202; `GET .../exit-requests/{id}` → 200.

**Data** — `circle_member.status`, `exit_request(status, settlement_amount_minor)`

**Rules**
- `BR-CIR-010.1` Exit terms come from the rule version the member accepted — not from a later version they did not (`CIR-004`).
- `BR-CIR-010.2` A member with outstanding obligations cannot exit without the configured settlement or approval.
- `BR-CIR-010.3` In a rotating Circle, exit before receiving a payout follows the documented rule; the consequence is shown before the member confirms.
- `BR-CIR-010.4` Exit never deletes contribution history.

**Exceptions**
- `EX-CIR-010.1` Exit with unsettled obligations → request held pending settlement, with the amount stated.
- `EX-CIR-010.2` Exit that would breach the minimum membership → group notified; the Circle may need to close (`CG-010`).

**Events** — `circle.member.exited`
**Audit** — exit request, approvals, settlement and outcome.

**Story `US-CIR-010`** — As a Circle member, I want to leave under the rules we agreed, so that my exit is fair to me and to the group.
*Given* outstanding contributions, *when* I request to exit, *then* I am shown the settlement required before anything is finalised.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-CIR-010-1 | POS | Exit follows the configured process |
| TC-CIR-010-2 | NEG | Exit with obligations blocked pending settlement |
| TC-CIR-010-3 | POS | Terms applied are those the member accepted |
| TC-CIR-010-4 | NEG | Exit does not delete history |
| TC-CIR-010-5 | INT | Exit breaching minimum membership notifies the group |
