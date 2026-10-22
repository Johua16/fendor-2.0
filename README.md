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
No external account or database credentials are required for this foundation.

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
- `GET /api/ready`: HTTP 503, deliberately not ready until database and identity are connected.
- Backend order transitions tested independently. These are not exposed as public mutation APIs.

Database migration is a draft, not applied. Accounts, checkout, emails, payments and delivery are not live. See [backend limitations](server/README.md).

## Collaboration

Read [folder ownership](docs/handoffs/ownership.md), [API policy](docs/handoffs/api-contracts.md), [frontend brief](docs/handoffs/frontend-codex-brief.md) and [business decisions](docs/product-decisions.md).

After this foundation PR merges, frontend development starts from updated `main` on `codex/frontend-foundation`. Until merge, the foundation PR branch can be checked out for review only. Do not start a second Next.js scaffold.
