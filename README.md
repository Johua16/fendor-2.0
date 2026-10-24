# Fendor

The new shared application is in **apps/web** (Next.js App Router, React, TypeScript).
Backend domain logic and the PostgreSQL migrations live in **server**.
Root HTML/assets and **backend/** are the preserved legacy prototype; do not use their install instructions for the new app.

## Start development

1. Install Node.js 24 (`nvm use` if you use nvm).
2. From the repository root: `npm ci --prefix apps/web`.
3. Run `npm run dev --prefix apps/web`.
4. Open http://localhost:3000.

The public homepage and store can be viewed without credentials. Account, catalogue, order, vendor and administrator journeys require database configuration; see [setup](docs/identity-setup.md).

## Verify

```
npm run typecheck --prefix apps/web
npm test --prefix apps/web
npm run build --prefix apps/web
```

Use npm and the committed **apps/web/package-lock.json** for the new app. Legacy lockfiles are retained solely for the old prototype. Do not run installation at the repository root or start the old backend for the new application.

## What works today

- `/` and `/shop`: responsive Fendor homepage and live marketplace catalogue.
- `/welcome`, `/signup`, `/login`, `/forgot-password`, `/verify-email`: complete customer and vendor account entry.
- `/orders`, `/cart`, `/saved`, `/notifications`, `/support`, `/account`: integrated customer marketplace journey.
- `/vendor`: reviewed vendor catalogue, inventory, order, analytics and readiness workspace.
- `/admin`: protected operations console for moderation, finance, fulfilment, support and monitoring.
- `GET /api/health`: HTTP 200, process health.
- `GET /api/ready`: HTTP 200 only after required configuration and database migrations; otherwise HTTP 503.
- The MVP backend supports accounts, reviewed vendors and products, availability requests, quotes, offline-payment verification, fulfilment, paid-order remedies, support and notifications.

See the [identity endpoints](docs/handoffs/identity-api.md), [catalogue endpoints](docs/handoffs/catalogue-api.md), [order requests](docs/handoffs/orders-api.md), [checkout contract](docs/handoffs/checkout-api.md) and [operations contract](docs/handoffs/operations-api.md). The MVP application and APIs are implemented but not deployed. Use the [portable staging and production handoff](docs/deployment.md) for the release step.

## Collaboration

Read [folder ownership](docs/handoffs/ownership.md), [API policy](docs/handoffs/api-contracts.md), [frontend brief](docs/handoffs/frontend-codex-brief.md) and [business decisions](docs/product-decisions.md).

Frontend and backend development use the same **apps/web** project and documented APIs. Start every change from current `main`, use a separate branch, and submit a pull request. Do not start a second Next.js scaffold.
