# Controlled online payment contract

Public checkout remains disabled unless `PUBLIC_CHECKOUT_ENABLED=true`. When it is false, only authenticated customer UUIDs listed in `CONTROLLED_LIVE_PAYMENT_TESTER_IDS` can see or initialize Paystack checkout. The allowlist is enforced after server-side session verification; the browser cannot submit or select an identity or role.

| Method | Path | Authentication | Result |
| --- | --- | --- | --- |
| GET | `/api/orders/:id/checkout` | owning customer or admin | Customer receives eligible provider names only; admin receives payment evidence and exceptions. |
| POST | `/api/orders/:id/pay` | owning customer | Accepts `{ "provider": "paystack" }`; returns an existing hosted URL, a newly initialized hosted URL, or confirmation/review state. |
| GET | `/api/payments/callback/paystack` | Paystack redirect | Re-verifies the reference with Paystack server-to-server and redirects to the order checkout result. Browser status parameters are not trusted. |
| POST | `/api/payments/webhooks/paystack` | valid Paystack signature | Stores the event durably before returning success, then processes it idempotently. |

## Initialization invariants

Before initialization the server locks the order and rechecks ownership, accepted immutable quote and total, active exact-stock reservation, vendor approval, current approved product version, active delivery coverage, open remedies, and financial holds. Migration 012 permits only one `initializing` or `pending` attempt for each order/provider pair. A repeat request reuses a valid hosted URL or reports initialization in progress.

An expired attempt is never silently discarded. Fendora verifies its reference with Paystack first. A successful charge is recorded, a pending charge remains blocking, and only a provider-confirmed failed/abandoned or unknown reference permits a new attempt.

## Confirmation invariants

Every successful provider response is compared with the stored reference, provider payment ID, amount and currency. Every attributable successful NGN charge is stored in `payment_records`. Only the first exact eligible payment may allocate inventory and confirm the order. A second successful charge, overpayment, amount/currency mismatch, or an eligibility change creates/retains a financial hold and never allocates stock or fulfils the order twice.

Webhook and callback processing converge on the same transactionally locked attempt, provider-payment uniqueness constraint, receipt ledger and order transition. Signed webhook events are deduplicated durably in `payment_webhook_events`; incomplete verification stays retryable through the operations worker.

## Failure and operator contract

- Failed, expired and cancelled attempts, failed webhook deliveries, financial holds and recorded refunds are visible under **Admin → Operations & audit** and **Admin → Orders & finance**.
- Automatic refunds are not part of this contract. Operators follow the controlled pilot runbook and record only provider-confirmed refund evidence.
- Provider secrets, signing secrets, full references and customer payment details are server-only.
- Migration 012 must be applied before the application version that queries its new columns/table.

See [the controlled Paystack pilot runbook](../releases/paystack-controlled-live-pilot.md) for migration, reconciliation, rollback and first-payment steps.
