# BFR-FDS-16 — Domain 16: Inventory-Lite (`INV`)

**Context:** Business (`business-svc`) · **Epic:** `EPIC-INV` — Light stock tools that never stand between a merchant and a payment
**Wave:** W3 (lowest priority — nine of ten requirements are P3) · **Depends on:** `BIZ`, `PAY`

> The governing constraint for this whole domain is `INV-010`: inventory must
> never become a prerequisite for accepting money.

---

### BFR-INV-001 — Product catalogue `P3`

**Acceptance (URS):** Product can store name, SKU, price and category.

**Screens** — Business ▸ Products (list, add, edit); Product detail.

**Workflow**
1. Merchant adds products with name, optional SKU, price and category.
2. Products may be selected when charging a customer, but never must be.

**API** — `POST /api/v1/merchants/{id}/products` → 201; `GET .../products` → 200.

**Data** — `product_item(name, sku, price_minor, currency, category_id, is_active)`

**Rules**
- `BR-INV-001.1` SKU is optional and, where present, unique within the merchant.
- `BR-INV-001.2` Price is in minor units with an explicit currency (`LED-005`, `LED-006`).
- `BR-INV-001.3` Deactivating a product retains it for historical sales; deletion is not offered where sales reference it.
- `BR-INV-001.4` The catalogue is optional (`INV-010`).

**Exceptions**
- `EX-INV-001.1` Duplicate SKU within a merchant → `DUPLICATE_RESOURCE`.
- `EX-INV-001.2` Deleting a product with sales history → refused; deactivation offered.

**Events** — `merchant.product.created`
**Audit** — catalogue changes audited.

**Story `US-INV-001`** — As a merchant, I want a list of what I sell with prices, so that charging a customer is quick and consistent.
*Given* a product with a price, *when* I charge for it, *then* the amount is pre-filled.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-INV-001-1 | POS | Product created with name, SKU, price, category |
| TC-INV-001-2 | NEG | Duplicate SKU within a merchant refused |
| TC-INV-001-3 | NEG | Product with history cannot be deleted |
| TC-INV-001-4 | PRM | Only the merchant and delegates can manage products |

---

### BFR-INV-002 — Stock quantity `P3`

**Acceptance (URS):** Quantity changes are stored with audit reference.

**Screens** — Product ▸ stock level and movement history.

**Workflow**
1. Stock changes are recorded as movements, never as direct edits of a quantity field.
2. Current quantity is derived from the movement history.

**API** — `POST /api/v1/products/{id}/stock-movements` → 201; `GET .../stock-movements` → 200.

**Data** — `stock_movement(product_item_id, delta, reason, reference, actor_id, occurred_at)`; quantity derived.

**Rules**
- `BR-INV-002.1` Quantity is **derived** from append-only movements — mirroring the ledger's approach so stock history cannot be quietly rewritten.
- `BR-INV-002.2` Every movement records a reason and an actor.
- `BR-INV-002.3` Negative stock is permitted only if the merchant enables it, and is flagged.
- `BR-INV-002.4` Movements reference their cause: a sale, a correction, a delivery.

**Exceptions**
- `EX-INV-002.1` Movement without a reason → `VALIDATION_FAILED`.

**Events** — `merchant.stock.changed`
**Audit** — movements are their own audit trail, mirrored to `audit_event`.

**Story `US-INV-002`** — As a merchant, I want stock changes recorded with a reason, so that I can see where my stock went.
*Given* a stock movement, *when* I view history, *then* I see the change, the reason and who made it.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-INV-002-1 | POS | Movement recorded with reason and actor |
| TC-INV-002-2 | POS | Quantity derived from movements |
| TC-INV-002-3 | NEG | Movement without reason refused |
| TC-INV-002-4 | SEC | Movements append-only |

---

### BFR-INV-003 — Product sale reduces inventory automatically `P3`

**Acceptance (URS):** Completed product-linked sale reduces configured quantity once.

**Screens** — Charge ▸ select products; Sale confirmation showing the stock effect.

**Workflow**
1. A charge may reference catalogue products and quantities.
2. On **completed** payment, a stock movement reduces quantity once per sale.
3. The movement references the payment.

**API** — sale creation accepts `line_items[]`; stock movement is triggered by `payment.completed`.

**Data** — `merchant_sale` line items, `stock_movement.reference = payment_id`

**Rules**
- `BR-INV-003.1` Stock reduces only on **completed** payment, never on initiation (`PAY-008`).
- `BR-INV-003.2` Reduction is idempotent per payment: a replayed `payment.completed` event cannot reduce stock twice (`NFR-004`).
- `BR-INV-003.3` Automatic reduction can be disabled per product.
- `BR-INV-003.4` Cash sales recorded manually (`BIZ-006`) may also reduce stock if the merchant links products.

**Exceptions**
- `EX-INV-003.1` Product deactivated between charge and completion → stock movement still recorded against it, for accuracy.

**Events** — `merchant.stock.changed`
**Audit** — movement linked to the payment.

**Story `US-INV-003`** — As a merchant, I want stock to go down when I sell something, so that my stock figures stay right without extra work.
*Given* a product-linked sale, *when* the payment completes, *then* stock reduces exactly once.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-INV-003-1 | POS | Completed sale reduces stock once |
| TC-INV-003-2 | IDM | Replayed completion event does not reduce twice |
| TC-INV-003-3 | CON | Concurrent sales of the same product reduce correctly |
| TC-INV-003-4 | POS | Auto-reduction disableable per product |

---

### BFR-INV-004 — Failed sale does not reduce final stock `P3`

**Acceptance (URS):** Inventory is unchanged/reversed after failed payment.

**Screens** — Sale detail showing that stock was not affected by a failed payment.

**Workflow**
1. A failed payment produces no stock reduction.
2. If a reservation was made at charge time, `payment.failed` releases it.

**API** — driven by `payment.failed`.

**Data** — `stock_movement` (compensating movement where a reservation existed).

**Rules**
- `BR-INV-004.1` Stock is never reduced by an uncompleted payment.
- `BR-INV-004.2` Where reservations are used, release is guaranteed by consuming `payment.failed` and by a reservation expiry as a backstop.
- `BR-INV-004.3` A reversal after completion creates a compensating movement, never a deletion (`LED-003` principle).
- `BR-INV-004.4` Net stock effect of a failed sale is exactly zero.

**Exceptions**
- `EX-INV-004.1` Failure event lost → reservation expiry restores stock; a discrepancy alert is raised.

**Events** — `merchant.stock.changed` (compensating)
**Audit** — compensating movements audited with their cause.

**Story `US-INV-004`** — As a merchant, I want a failed payment to leave my stock untouched, so that my stock figures do not drift away from reality.
*Given* a failed payment on a product sale, *when* I check stock, *then* it is exactly as it was before.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-INV-004-1 | POS | Failed payment leaves stock unchanged |
| TC-INV-004-2 | REV | Reversal after completion creates a compensating movement |
| TC-INV-004-3 | ERR | Lost failure event recovered by reservation expiry |
| TC-INV-004-4 | POS | Net effect exactly zero |

---

### BFR-INV-005 — Configurable reorder threshold `P3`

**Acceptance (URS):** Merchant can set minimum quantity by item.

**Screens** — Product ▸ reorder threshold field.

**Workflow**
1. The merchant sets a minimum quantity per product.
2. Crossing it triggers a low-stock alert (`INV-006`).

**API** — `PATCH /api/v1/products/{id}` `{reorder_threshold}` → 200.

**Data** — `product_item.reorder_threshold`

**Rules**
- `BR-INV-005.1` The threshold is per item and optional.
- `BR-INV-005.2` A zero threshold means alert at zero, not "no alert"; absence of a threshold means no alert.
- `BR-INV-005.3` Changing the threshold takes effect on the next evaluation.

**Exceptions**
- `EX-INV-005.1` Negative threshold → `VALIDATION_FAILED`.

**Events** — none
**Audit** — threshold changes audited.

**Story `US-INV-005`** — As a merchant, I want to set a minimum for each item, so that I am warned before I run out.
*Given* a threshold of 5, *when* stock falls to 5, *then* an alert triggers.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-INV-005-1 | POS | Threshold set per item |
| TC-INV-005-2 | NEG | Negative threshold refused |
| TC-INV-005-3 | POS | Zero threshold alerts at zero |
| TC-INV-005-4 | POS | No threshold means no alert |

---

### BFR-INV-006 — Low-stock alert `P3`

**Acceptance (URS):** Alert triggers when stock crosses configured threshold.

**Screens** — Dashboard low-stock panel; notification.

**Workflow**
1. After each stock movement, the item's quantity is compared to its threshold.
2. Crossing downward raises an alert once, not repeatedly.
3. The alert clears when stock rises above the threshold.

**API** — `GET /api/v1/merchants/{id}/low-stock` → 200.

**Data** — alert state per product item.

**Rules**
- `BR-INV-006.1` Alerts fire on crossing, not on every movement below the threshold — no alert flooding.
- `BR-INV-006.2` Alerts are business notifications, subject to merchant preferences (they are not security notices, so they are suppressible — `NOT-006`).
- `BR-INV-006.3` The alert states the current quantity and the threshold.
- `BR-INV-006.4` Alerts never block a sale.

**Exceptions**
- `EX-INV-006.1` Notification delivery failure → the in-app panel still shows the low-stock state.

**Events** — `merchant.stock.low`
**Audit** — alerts recorded.

**Story `US-INV-006`** — As a merchant, I want a warning when an item is running low, so that I can restock before I lose sales.
*Given* stock crossing below the threshold, *when* the movement completes, *then* I receive one alert.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-INV-006-1 | POS | Alert on downward crossing |
| TC-INV-006-2 | NEG | No repeated alerts while below threshold |
| TC-INV-006-3 | POS | Alert clears when restocked |
| TC-INV-006-4 | NEG | Alert never blocks a sale |

---

### BFR-INV-007 — Supplier directory `P3`

**Acceptance (URS):** Merchant can record supplier and contact information.

**Screens** — Business ▸ Suppliers (list, add, edit).

**Workflow**
1. The merchant records suppliers with name and contact details.
2. Suppliers can be linked to expenses and payments (`INV-008`).

**API** — `POST /api/v1/merchants/{id}/suppliers` → 201; `GET .../suppliers` → 200.

**Data** — `supplier(name, contact_msisdn, contact_email, notes, is_active)`

**Rules**
- `BR-INV-007.1` Supplier contact data is personal data of a third party: it is stored encrypted, minimised and never used for platform marketing.
- `BR-INV-007.2` A supplier record is scoped to the merchant; it is not a shared platform directory.
- `BR-INV-007.3` Deactivation retains linked history.

**Exceptions**
- `EX-INV-007.1` Deleting a supplier with linked expenses → refused; deactivation offered.

**Events** — none
**Audit** — supplier changes audited.

**Story `US-INV-007`** — As a merchant, I want to keep my suppliers' details, so that I can reorder and track what I buy from whom.
*Given* a supplier record, *when* I record an expense, *then* I can link it to that supplier.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-INV-007-1 | POS | Supplier recorded with contact information |
| TC-INV-007-2 | SEC | Supplier contact data encrypted and merchant-scoped |
| TC-INV-007-3 | NEG | Supplier with history cannot be deleted |
| TC-INV-007-4 | SEC | Supplier data never used for platform marketing |

---

### BFR-INV-008 — Supplier payments linkable `P3`

**Acceptance (URS):** Transaction can reference selected supplier.

**Screens** — Pay ▸ "This is a supplier payment" with supplier selection; Supplier detail ▸ payment history.

**Workflow**
1. When paying, the merchant may select a supplier.
2. The payment and any expense record reference that supplier.
3. Supplier payment regularity feeds a Passport business metric (`FP-007`).

**API** — payment creation accepts `supplier_id`; `GET /api/v1/suppliers/{id}/payments` → 200.

**Data** — `merchant_expense.supplier_id`, `payment.supplier_ref`

**Rules**
- `BR-INV-008.1` Linking a supplier never changes the payment's execution or its ledger treatment; it is metadata.
- `BR-INV-008.2` The link can be added after the fact without altering the payment record — it is stored as an association, not an edit (`LED-002`).
- `BR-INV-008.3` Supplier regularity metrics use only confirmed payments.

**Exceptions**
- `EX-INV-008.1` Linking to another merchant's supplier → `404`.

**Events** — none
**Audit** — link creation audited.

**Story `US-INV-008`** — As a merchant, I want to tag payments to suppliers, so that I can see what I spend with each of them.
*Given* a supplier payment, *when* I view that supplier, *then* I see my payment history with them.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-INV-008-1 | POS | Payment references the selected supplier |
| TC-INV-008-2 | NEG | Linking does not alter the payment record |
| TC-INV-008-3 | PRM | Cannot link another merchant's supplier |
| TC-INV-008-4 | POS | Regularity metric uses confirmed payments only |

---

### BFR-INV-009 — Inventory corrections retain audit history `P3`

**Acceptance (URS):** Manual adjustment stores reason and actor.

**Screens** — Product ▸ Adjust stock (new count, reason); Movement history showing adjustments distinctly.

**Workflow**
1. The merchant adjusts stock, for example after a physical count.
2. A movement is recorded with the delta, a mandatory reason and the actor.
3. Adjustments are visually distinct from sale-driven movements.

**API** — `POST /api/v1/products/{id}/stock-movements` `{delta, reason: ADJUSTMENT, note}` → 201.

**Data** — `stock_movement(reason, actor_id, note)`

**Rules**
- `BR-INV-009.1` An adjustment is a movement, never an overwrite of the quantity.
- `BR-INV-009.2` A reason is mandatory.
- `BR-INV-009.3` Adjustments by delegates are attributed to the individual, not the business (`USR-008`).
- `BR-INV-009.4` Large or frequent adjustments are visible to the owner, since they can indicate shrinkage or misuse.

**Exceptions**
- `EX-INV-009.1` Adjustment without a reason → `VALIDATION_FAILED`.

**Events** — `merchant.stock.adjusted`
**Audit** — adjustments audited with actor and reason.

**Story `US-INV-009`** — As a merchant, I want stock corrections recorded with a reason and a name, so that I can see whether stock is being lost.
*Given* an adjustment by my cashier, *when* I review history, *then* I see the change, the reason and who made it.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-INV-009-1 | POS | Adjustment recorded with reason and actor |
| TC-INV-009-2 | NEG | Adjustment without reason refused |
| TC-INV-009-3 | POS | Delegate adjustments attributed individually |
| TC-INV-009-4 | SEC | Quantity never overwritten directly |

---

### BFR-INV-010 — Inventory not a prerequisite for payment acceptance `P2`

**Acceptance (URS):** Merchant can use payments without catalogue.

**Screens** — Charge screen works with a free amount and no product selection; no prompt to set up a catalogue first.

**Workflow**
1. A merchant with no catalogue charges a free amount and is paid normally.
2. No inventory setup step exists anywhere in the merchant onboarding path.

**API** — payment and QR endpoints require no product reference.

**Data** — `merchant_sale.line_items` optional.

**Rules**
- `BR-INV-010.1` No payment-acceptance endpoint requires a product reference.
- `BR-INV-010.2` Merchant onboarding never includes a mandatory catalogue step.
- `BR-INV-010.3` Passport business metrics work fully without any catalogue data (`FP-007`).
- `BR-INV-010.4` This is verified by a standing negative test on a merchant with an empty catalogue.

**Exceptions**
- `EX-INV-010.1` None — this requirement is precisely the absence of a constraint.

**Events** — none
**Audit** — none additional.

**Story `US-INV-010`** — As a merchant who does not want to list products, I want to accept payments anyway, so that a bookkeeping feature never stands between me and being paid.
*Given* an empty catalogue, *when* I accept a payment, *then* it works exactly as it does for a merchant with a catalogue.

**Tests**
| TC | Cat | Case |
|---|---|---|
| TC-INV-010-1 | POS | Merchant with empty catalogue accepts payment |
| TC-INV-010-2 | POS | Static and dynamic QR work with no products |
| TC-INV-010-3 | NEG | No endpoint requires a product reference |
| TC-INV-010-4 | POS | Passport business metrics work with no catalogue |
