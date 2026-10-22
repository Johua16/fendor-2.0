# Folder ownership and first frontend task

## Shared foundation (coordinate changes)

- apps/web/package.json, package-lock.json, next.config.ts, tsconfig.json
- apps/web/src/app/layout.tsx and globals.css
- .github/workflows, AGENTS.md, README.md

## Frontend developer owns

- apps/web/src/components/ui/: shared UI components (backend team consumes these).
- apps/web/src/styles/: Figma design variables and typography.
- apps/web/public/: approved frontend images/fonts; no screenshots as implementation assets.
- apps/web/src/app/page.tsx: replace temporary root page with approved homepage.
- Future routes /welcome, /store, /products/[id], /cart, /login, /signup, /verify-email, /forgot-password, /reset-password, /vendor/apply and /vendor/* dashboard pages.
- apps/web/src/lib/api/: frontend adapters and explicit mock fixtures. Coordinate contracts first.

## Founder/backend team owns

- server/src/, server/db/ and server/test/.
- apps/web/src/app/api/: real server endpoints.
- Future /checkout/*, /account/*, /orders/*, /support/* and /admin/* interfaces.
- docs/handoffs/api-contracts.md and database/identity configuration.

These route names reserve ownership, not implemented or approved API behaviour. Coordinate additions rather than creating overlapping routes. Shared UI changes must preserve existing consumers.

## Starting instructions for the other developer

After the foundation PR is merged and your checkout is clean:

```
git switch main
git pull --ff-only origin main
git switch -c codex/frontend-foundation
npm ci --prefix apps/web
npm run dev --prefix apps/web
```

If you already have edits, preserve them before switching. If the branch already exists, reuse it after checking its state. First deliver shared visual components and the homepage with responsive layouts. Open a PR against main. Do not implement checkout/admin or reconstruct the entire app in the first PR.

The homepage placeholder uses a system font intentionally. It is not a substitute for checking the approved Figma font and assets. Robots are disabled for the development preview; enable indexing only when the public site is approved for release.
