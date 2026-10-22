# Fendor backend foundation

This is the first new backend increment, not a complete marketplace API.
The legacy backend/ directory is preserved as a reference. The active Next.js application is apps/web; it imports these domain rules server-side. Do not run the legacy backend to serve the new application.

## Run locally

Requires Node.js 24. No external packages are needed for this foundation.

- `cd server`
- `npm test`
- `npm start`
- Open `http://127.0.0.1:4001/api/health`.

`GET /api/health` reports the HTTP process is alive.
`GET /api/ready` deliberately returns 503 until persistent storage and identity are wired.
There are no public order or identity mutation endpoints yet.

## Implemented

TypeScript domain transitions cover draft, availability check, reservation, quote, customer acceptance, admin-verified offline payment, preparation, dispatch and delivery. Tests check role/ownership restrictions, expiry, changed quotes, invalid amounts and duplicate verification. Money uses integer kobo. Quantity and variant remain fixed through a request; changing either needs a fresh availability check.

A stock reservation does not confirm an order. Quote creation is an admin action: its future service must validate packaging, delivery and preparation feasibility before calling it. `verify_payment` is only called after checking actual bank receipt, never a customer screenshot alone. Fulfilment permission here uses the vendor as the assigned preparer; partner assembly assignment remains an explicit future extension.

## Database draft

`db/001-foundation.sql` targets PostgreSQL. It is not applied or database-tested yet. It models identity, vendor approval, products, variant stock, order requests, payment records and audit events. This increment supports one variant/vendor per request, not an implemented multi-vendor basket.

Before exposing mutation APIs:

1. Provision development PostgreSQL and add a versioned migration runner; validate this migration against a real database.
2. Add persistent identity with password hashing, verification, expiring sessions, rate limits and role checks. Never accept actor roles from the request body.
3. Add transactional repository operations. Reserve stock with a conditional update/row lock, reject insufficient available stock, and save the order plus audit event in the same transaction.
4. Enforce optimistic order version checks and idempotency keys. Retry responses must not charge or reserve twice.
5. Atomically release expired/declined/cancelled holds. Convert reservations to allocated stock on verified payment. Recheck live stock and fulfilment feasibility before confirmation.
6. Reconcile late, partial and duplicate payments; do not silently cancel received funds. Add reviewed remedies/refunds for paid orders and stock loss.
7. Expose authenticated API contracts and integrate frontend screens.

Pure transition tests do not establish database concurrency safety, real authentication, payment receipt or successful deliveries. These are separate upcoming services.

## Integration

Keep domain rules independent of HTTP frameworks. They can be imported by Next.js server routes later, so frontend implementation need not block this backend work. The current Node HTTP entry is a local foundation harness, not a change to the agreed Next.js application direction. Native TypeScript execution does not type-check by itself. The apps/web typecheck command now includes server source and tests.
