# Fendor frontend Codex handoff

You are collaborating on the existing Fendor MVP with a founder/backend team. Build the assigned frontend in the same project. Do not independently redesign the product or invent a different backend.

## Source of truth and current state

- Repository: https://github.com/Johua16/fendor-2.0 (main is the integration branch).
- Figma: https://www.figma.com/design/2WYsgPZZDOqp4J895pa9Hk/FENDOR-PROJECT?node-id=175-2155
- Read applicable AGENTS.md instructions, repository documentation and docs/product-decisions.md if present.
- Request the designer's Fendor UI_UX Developer Handoff Specification.pdf if it has not been provided. Do not pretend to have read it.
- This foundation branch includes server/ domain rules and a PostgreSQL draft, not working signup/order APIs. Read README.md and docs/handoffs/ownership.md for the exact application structure. Health endpoints are not authentication or marketplace services.
- Inspect the actual checkout and remote state first. Do not reset, delete, overwrite or stage unrelated existing work. Do not revive an older prototype just because its files exist in Git history.
- Resolve conflicts between the designer's summary and founder-approved business rules explicitly. Prototype promises and sample figures are not confirmed requirements.

## Shared stack

Target: Next.js App Router + React + TypeScript; CSS with shared design variables; PostgreSQL owned by the backend team. One integrated application and one GitHub repository. Do not scaffold a separate Vite/Express application or a second backend/database.

The founder/backend team has scaffolded apps/web. Reuse it; do not scaffold again. There must be one agreed package manager, lockfile, dependency set and routing structure. Inspect existing files first. Use supported compatible versions and record them; do not independently upgrade shared dependencies. The server/ domain rules are intended to remain reusable from server-side Next.js routes.

## Your frontend scope

1. Shared design variables and components: fonts, colours, buttons, fields, cards, navigation, footer, vendor sidebar, dialogs and feedback.
2. Welcome/role selection, distinct homepage, store, search/filtering and product details.
3. Cart interface: quantities, removal, empty/unavailable states, totals and checkout entry.
4. Customer signup/login/verification/password recovery interfaces.
5. Vendor onboarding and application states: draft, submitted, changes requested, approved, rejected and suspended.
6. Vendor overview, product list/create/edit, media/variants/inventory interfaces.
7. Vendor availability requests, orders, preparation and handover interfaces.
8. Vendor settings, basic analytics and payment history.

The backend team owns persistence, authentication, permissions, APIs, reservation/order logic, payment verification and notifications. It also owns gift personalisation/final checkout, customer aftercare and the admin frontend. Coordinate the cart-to-checkout boundary; don't create a competing checkout implementation.

Vendor customer-profile access remains undecided. Do not expose contact details or unrestricted profiles based on the prototype's Customers page.

## Design implementation

Inspect the actual Figma frames and assets before implementation, following available Figma skills. Match the approved screens rather than copying an unrelated template. The file has Buyer Section, Vendor Section and Onboarding Flow; do not mix superseded designs with approved ones.

Use a shared component library in the repository. Obtain exact font, colour, spacing and asset details from Figma; do not guess from memory. The summary names #FD7A49 as the accent. Confirm dark/background tokens against the actual approved screens instead of assuming every dark surface is identical.

Main frames inspected so far are desktop-width. Dedicated mobile flows have not been verified. Inspect supplied mobile references if available; otherwise propose responsive behaviour using the existing visual language and identify the assumption. Implement accessible keyboard navigation, labels, focus states, readable contrast and mobile touch targets. Include loading, empty, validation, failed-request and success states.

## Integration rules

Agree API contracts with the backend team before wiring each feature: method/path, input, response, errors, authentication, permissions, pagination and status meanings. Proposed contracts must be labelled proposed, not represented as existing endpoints.

Keep typed mock fixtures behind a replaceable service adapter. Components must not embed fake data or rely on hardcoded success. Clearly label mock mode in development. Never silently fall back to mock success when a real API fails.

Keep server secrets and database credentials out of client code. Do not store passwords or pretend localStorage is real authentication. Agree the session mechanism with the backend team before wiring credentials. Server-side validation and authorisation remain mandatory.

Use integer kobo for NGN money at the agreed boundary; format it for display. Backend responses determine payable totals, stock and permissions. Do not infer business approval from an enabled button.

Preserve cart and intended destination through authentication. Distinguish email verification from password recovery. Keep existing-account login usable at checkout. Account and role routing must reflect backend permissions, not just the customer's role selection.

## Non-negotiable business behaviour

- Fendor is the customer contact and coordinates vendors and delivery. No direct vendor/customer chat or sharing of contact details without an explicit approved requirement.
- Vendor confirmation must reserve the exact variant and quantity; it does NOT confirm the final order.
- Personalisation can continue while availability is pending; show this honestly.
- Reservation expiry, rejected requests, price changes and alternatives need explicit customer-facing states. Never silently substitute products.
- Initial payment is offline and verified by Fendor staff. An uploaded receipt is not proof of cleared payment.
- Preparation starts only after payment verification and final feasibility checks.
- Do not implement escrow, guaranteed refunds, automated payouts, insurance or external-provider integrations solely because the mockup mentions them.
- Don't grant approved vendor access immediately after submitting an application.

## Collaboration and completion

Work on one small feature branch at a time; open a pull request against the agreed integration branch. Do not force-push or merge your own work without the team's review agreement. Coordinate edits to shared configuration, components, routes and contracts.

First deliverable: read the ownership map, install apps/web using npm ci, then implement the shared UI foundation and homepage on codex/frontend-foundation after the foundation PR is merged. Do not build every screen in one unreviewed change.

Each pull request must explain screens built, design references, mobile behaviour, tests performed, mock versus real API coverage, and outstanding questions. Run applicable build/type checks and meaningful interaction tests. Include screenshots where helpful.

Report each feature as UI in progress, UI ready with mocks, integrated with backend, or end-to-end verified. Only the last means the complete feature works.

When functionality is ambiguous, continue independent work and ask a specific question. Do not invent business policies, delivery guarantees, approval rules or payment logic. The founder/backend team will review your changes and may supply correction commits; coordinate before editing that branch again.
