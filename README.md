# Fendor

The new shared application is in **apps/web** (Next.js App Router, React, TypeScript).
Backend domain logic and the draft PostgreSQL schema live in **server**.
Root HTML/assets and **backend/** are the preserved legacy prototype; do not use their install instructions for the new app.

## Start development

1. Install Node.js 24 (`nvm use` if you use nvm).
2. From the repository root: `npm ci --prefix apps/web`.
3. Run `npm run dev --prefix apps/web`.
4. Open http://localhost:3000.

The home screen is a temporary development placeholder, not the final Figma implementation.
The placeholder homepage needs no credentials. Backend accounts and catalogue require database configuration; see [setup](docs/identity-setup.md).

## Verify

```
npm run typecheck --prefix apps/web
npm test --prefix apps/web
npm run build --prefix apps/web
```

Use npm and the committed **apps/web/package-lock.json** for the new app. Legacy lockfiles are retained solely for the old prototype. Do not run installation at the repository root or start the old backend for the new application.

## What works today

- `/`: development foundation page.
- `GET /api/health`: HTTP 200, process health.
- `GET /api/ready`: HTTP 200 only after required configuration and database migrations; otherwise HTTP 503.
- Customer order requests, saved personalisation and vendor stock reservations are exposed on the orders feature branch; full checkout is not implemented.

This branch implements persistent accounts, vendor approval, the initial product catalogue, and order requests with stock reservations. See [identity endpoints](docs/handoffs/identity-api.md) and [catalogue endpoints](docs/handoffs/catalogue-api.md). See [order request endpoints](docs/handoffs/orders-api.md). These features are not deployed: frontend integration, database provisioning and scheduled email delivery are still required. Checkout, payments and delivery APIs are not live.

## Collaboration

Read [folder ownership](docs/handoffs/ownership.md), [API policy](docs/handoffs/api-contracts.md), [frontend brief](docs/handoffs/frontend-codex-brief.md) and [business decisions](docs/product-decisions.md).

After this foundation PR merges, frontend development starts from updated `main` on `codex/frontend-foundation`. Until merge, the foundation PR branch can be checked out for review only. Do not start a second Next.js scaffold.
