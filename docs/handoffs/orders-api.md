# Order requests and stock reservations — first integration contract

Feature branch `codex/order-requests-reservations`, stacked on the catalogue branch. This is the request/availability stage, not completed checkout. Existing same-origin JSON, session cookie, 16 KB body limit, no-store and error envelope rules apply. All actors require verified accounts; vendors also require current approval. Keep customer communication within Fendor.

## Endpoints

| Method | Path | Body/result |
|---|---|---|
| POST | /api/orders | `{clientRequestId,productVariantId,quantity}` → 201 `{order}` |
| GET | /api/orders | Customer's requests → `{orders,nextCursor}` |
| GET | /api/orders/:id | Customer's own request → `{order}` |
| POST | /api/orders/:id/personalise | `{version,giftDetails}` → `{order}` |
| POST | /api/orders/:id/cancel | `{version}` → `{order}` |
| GET | /api/vendor/orders | Vendor's assigned requests |
| GET | /api/vendor/orders/:id | Assigned item/quantity/status only |
| POST | /api/vendor/orders/:id/reserve | `{version}` → `{order}` |
| POST | /api/vendor/orders/:id/decline | `{version}` → `{order}` |
| GET | /api/admin/orders | All requests; admin only |
| GET | /api/admin/orders/:id | Request and gift details; admin only |

Lists accept `limit` (default 20, max 50) and `after` (previous nextCursor). UUID ascending pagination, no snapshot guarantee. No other query parameters accepted. No customer/vendor identity can be submitted. No vendor can read customer/recipient names, gift messages, addresses, email or phone through these endpoints.

### Creation and retries

Generate `clientRequestId` once using crypto.randomUUID() and retain it until creation succeeds or the request is explicitly abandoned. Retry an uncertain network response with the same key and payload. The server returns the existing request (also 201) without reserving again or adding another creation event. Same key with different quantity/variant returns 409 IDEMPOTENCY_CONFLICT. Creating a deliberately new request requires a new key. Keys are scoped to the customer.

Quantity is an integer 1–1,000; variant is an existing approved catalogue option from a currently approved vendor. The server captures title, image path, unit price in integer NGN kobo and product version. This snapshot is retained if the live listing changes. Snapshot price is not a quote including packaging/delivery. New requests enter `checking_availability` immediately. A request does not hold stock or confirm an order.

### Customer personalisation

While checking_availability or reserved, the customer may replace the full giftDetails object with any subset of:

- recipientName (max 100 characters)
- occasion (100)
- relationship (100)
- giftMessage (1,000)
- packagingPreference (200)

Values are plain text, may be empty, and must be rendered as text. Omitted fields are removed (full replacement); use the latest saved object when saving one field. Progress is saved while availability is pending. This is preference capture, not priced package selection or a packaging/delivery commitment. Addresses, contact numbers, attachments and custom fields are not supported here. Suspended vendors cannot access these requests; customers/Fendor can still view and customers can cancel eligible requests.

### Availability and expiry

A vendor reserve action locks the variant and request, checks unreserved quantity, then records the hold and audit event atomically. The exact requested variant and quantity cannot be replaced. Concurrent requests cannot reserve the same last unit. Reservation is allowed only while checking_availability. A changed/reviewed product version returns PRODUCT_CHANGED: Fendor must explain the change and the customer must create a new request. There is no silent replacement or repricing.

The resulting state is `reserved`, and `orderConfirmed` remains false. Duration comes from server RESERVATION_MINUTES, integer 1–1,440. It has no default business policy. Missing/invalid configuration returns 503 RESERVATION_POLICY_REQUIRED. Agree the pilot duration before deployment; this range is a technical guard, not an agreed service promise.

Schedule `npm run orders:expire` from apps/web regularly (e.g. every minute operationally, subject to deployment choice). Each run processes up to 100 variants; monitor backlog and repeat as needed. Expiry also runs lazily before actions for that request's variant. It releases held stock exactly once, clears quote/acceptance fields and returns the request to checking_availability for fresh vendor confirmation. It increments version and records an event with null actor_id and event_type reservation_expired; no customer is misattributed as the expiry actor.

GET does not mutate data. If a worker has not processed expiry yet, `reservationExpired:true` signals an expired hold even if stored state is reserved. The UI must show “availability needs reconfirmation,” never confirmed or ready to pay. Reload after STALE_VERSION, including when lazy expiry changed the request. Pause/suspension does not silently cancel requests or release valid holds; explicit cancellation/decline or expiry does.

Cancel/decline releases held quantity in the same transaction as its event. Cancel leads to cancelled; decline to unavailable. Paid/fulfilled states are not supported by this slice. Customer cancellation must go through a reviewed remedy flow once future payment handling records actual money received.

### Response

All scopes receive `id,productVariantId,quantity,state,version,product,reservationExpiresAt,reservationExpired,orderConfirmed`. Customer/admin also receive giftDetails. No party's raw user ID or contact details are returned. Product snapshot: `title,imagePath,unitPriceKobo,currency,productVersion`.

Every successful mutation increments version. Send the current version; 409 STALE_VERSION requires refresh. Retrying a successful mutation with its old version produces a conflict, never another hold/release. Other errors: 400 invalid/unknown input; 401 unauthenticated; 403 role/verification/vendor approval; 404 missing/not owned; 409 INVALID_STATE, INSUFFICIENT_STOCK, PRODUCT_CHANGED; 503 missing reservation policy or infrastructure failure.

## Still required before launch

Frontend screens, background worker scheduling, vendor/customer notifications, response deadlines/reminders/escalation, shipping and packaging feasibility, quotes, customer quote acceptance, payment evidence and admin verification, preparation/dispatch/delivery and remedy/refund workflows remain separate increments. Customers can revisit saved progress via these APIs; off-site notifications are not yet sent. Do not expose payment instructions or claim a delivery promise from a reservation.
