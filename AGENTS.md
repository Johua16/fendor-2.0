# Fendor shared instructions

- The active application is apps/web (Next.js App Router, React, TypeScript). server contains reusable server-only domain code. Root HTML and backend are legacy references; preserve them unless migration is explicitly requested.
- Read README.md, docs/handoffs/ownership.md, docs/handoffs/api-contracts.md and docs/product-decisions.md before changing application behaviour.
- Use npm and apps/web/package-lock.json. Coordinate root tooling/dependency changes. Do not introduce a separate frontend, Express service or database without agreement.
- Never import server modules into client components. Authentication and roles must come from server-verified identity, never browser-submitted roles.
- Vendor stock confirmation is not order confirmation. Require exact stock reservation, customer quote acceptance, feasibility checks and admin verification of offline payment before preparation.
- Customer communication goes through Fendor. Do not expose customer contacts or add direct vendor chat from placeholder designs.
- Mock data must be explicit, behind adapters, and must not silently replace failed real requests. Existing endpoints are documented in api-contracts.md; everything else needs an agreed contract.
- Build responsive accessible interfaces from the approved Figma frames; follow Figma skills when available. No invented escrow, insurance, payment or delivery guarantees.
- Work in feature branches, preserve unrelated edits, and use pull requests. Do not commit secrets or build outputs.
- Run npm run typecheck --prefix apps/web, npm test --prefix apps/web and npm run build --prefix apps/web for shared foundation changes. Test meaningful feature behaviour for subsequent changes.
