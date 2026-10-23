# Frontend homepage review notes

## Reference and status

- Desktop source: Figma `Landing Page`, node `174:380`.
- Responsive layouts are a frontend proposal because dedicated mobile frames have not been verified.
- Homepage catalogue, prices, ratings, availability, vendor credentials and fulfilment figures are explicit sample data supplied by `apps/web/src/lib/api/homepage.ts`.
- No account, catalogue, cart, newsletter, checkout or vendor API is connected. Preview interactions keep state in React memory and reset on reload.

## Responsive proposal

- Stack the logo/actions, search, and department control on mobile.
- Collapse the desktop department navigation behind an accessible toggle.
- Use horizontally scrollable department shortcuts and two-column product grids on common mobile widths; use one column only below 341px.
- Stack vendor, trust, seller and newsletter content into readable single-column sections.
- Preserve 44px touch targets and native dialog keyboard behaviour.

## Founder-approved copy corrections

The Figma frame and designer handoff contain behaviour that conflicts with `docs/product-decisions.md` and `AGENTS.md`. This implementation preserves the visual structure while replacing or omitting these claims:

- Escrow protection and release timings.
- Automatic vendor disbursement and payout promises.
- Integrated DHL or guaranteed fast dispatch.
- Physical product audits or inspection guarantees.
- Vendor access to customer profiles, contact details or lifetime value.
- Unsupported vendor counts, GMV, satisfaction, delivery, stock and marketplace statistics.
- Immediate vendor dashboard access after application submission.

Provisional homepage copy reflects the current rules: Fendor coordinates customer communication and fulfilment, vendor applications require approval, availability is distinct from confirmation, and preparation starts only after staff verify offline payment and feasibility.

## Decisions still needed

- Final public wording for vendor verification, marketplace trust and support availability.
- Which homepage statistics, vendor credentials, ratings, prices, stock labels and promotions are approved for launch.
- Whether recently viewed items should exist before account/catalogue contracts are agreed.
- Newsletter ownership, consent wording and API contract.
- Approved destination or disabled state for help, account, vendor guide, store and footer policy links in the homepage review.
- Dedicated mobile frames, if the designer has them.
