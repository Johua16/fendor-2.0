# Fendor operations API contract

All endpoints use the existing secure session cookie. Mutations require same-origin checks and JSON bodies unless an upload is explicitly binary. Money is integer kobo. Mutations use the order or case `version`; stale versions return `409 VERSION_CONFLICT`. Unknown fields are rejected. Admin actions are audited, and an operator cannot review an order in which they are the customer or vendor.

## Vendor readiness and uploads

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/uploads?purpose=product\|document\|proof` | signed in | Upload JPEG, PNG or WebP binary, maximum 5 MB and 20 megapixels. The server decodes and re-encodes WebP without metadata. Proof uploads require admin. |
| GET | `/api/media/:uploadId` | authorised viewer | Read sanitised media. Product media becomes public only through an approved live product; documents and proofs remain private. |
| GET/POST | `/api/vendor/profile` | vendor applicant | Read or save encrypted phone, backup phone, pickup address, approved document and a selling window no longer than seven days. Material changes return an approved application to review. |
| GET/POST | `/api/admin/uploads[/:id/review]` | admin | List pending uploads; approve or reject with `status` and `note`. Self-review is blocked. |

## Delivery and fulfilment

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/delivery-zones` | public | Active service zones. |
| POST | `/api/admin/delivery-zones` | admin | Create or update a zone. |
| GET/POST | `/api/orders/:id/delivery` | customer | Read/save recipient name, phone, address, instructions, date and zone. Details are encrypted. |
| GET | `/api/vendor/orders/:id/delivery` | vendor | Read only delivery state/date; recipient contact and address are never returned. |
| POST | `/api/vendor/orders/:id/prepare` | vendor | Start preparation after verified payment. |
| POST | `/api/vendor/orders/:id/ready` | vendor | Mark ready for Fendor dispatch. |
| POST | `/api/admin/orders/:id/dispatch` | admin | Assign delivery and tracking reference. |
| POST | `/api/admin/orders/:id/delivery-failed` | admin | Record a failed attempt. |
| POST | `/api/admin/orders/:id/delivered` | admin | Complete with approved proof and `proofChecked: true`. |
| POST | `/api/admin/orders/:id/returned` | admin | Record physical return with approved proof and `proofChecked: true`. |

Fulfilment pauses while `financialHold` is true or a remedy is unresolved. Product stock is never silently returned; closing a remedy requires `stockChecked: true` and an explicit `restockQuantity`.

## Paid-order remedies and corrections

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/orders/:id/request-remedy` | customer | Request `cancellation` or `return` with a reason after payment. |
| POST | `/api/admin/orders/:id/review-remedy` | admin | Approve or reject with a review note. |
| POST | `/api/admin/orders/:id/close-remedy` | admin | Close only after funds are fully reversed and, for returns, goods are recorded returned. |
| POST | `/api/admin/orders/:id/correct-receipt` | admin | Add an immutable bank-checked correction using unique `requestId`; freezes fulfilment. |
| POST | `/api/admin/orders/:id/reconcile` | admin | Clear the financial hold only when the ledger matches the accepted total or zero after refund. |
| GET | `/api/orders/:id/remedy` | customer/admin | Read the remedy without exposing internal audit data. |

Approved remedies raise the refund ceiling for the existing refund endpoint. Corrections never overwrite the original payment record.

## Support, notifications and operations

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST/GET | `/api/support` | customer | Create idempotently with `requestId`, or list owned cases. |
| GET/POST | `/api/support/:id` | customer | Read history or reply. Internal notes are excluded. |
| GET/POST | `/api/admin/support[/:id]` | admin | List/read, reply, assign, change status, or add an internal note. |
| GET | `/api/notifications` | signed in | Cursor list for in-app notifications. |
| POST | `/api/notifications/:id/read` | owner | Mark one notification read. |
| GET | `/api/orders/:id/history` | participant | Order timeline; admin alone receives review notes. |
| GET | `/api/admin/operations` | admin | Operational counts, overdue vendor responses, finance/remedy queues, worker health and mail totals. |
| GET | `/api/admin/audit` | admin | Paginated administrative audit trail. |

The operations worker runs reservation expiry, event notifications, vendor reminders, deadline escalation, email retries and expired security-data cleanup. Availability requests receive one reminder near the deadline and are escalated to the customer and admin at expiry; the system does not falsely mark stock unavailable without a vendor decision.
