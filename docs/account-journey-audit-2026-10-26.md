# Account journey audit — 26 October 2026

## Scope and limits

Inspected the active Next.js application, shared identity/approval services, customer account entry, vendor onboarding/workspace, administrative review, uploads, notifications, and existing order/operations regression coverage. Re-ran automated tests and production build. This is a source and automated integration review, not a claim that every screen has been tested in a deployed browser or that every production integration is ready.

## Confirmed defects corrected in this change

1. Approved vendor sign-in defaulted to `/account`, which always renders the customer dashboard. Default destination now follows server identity: admin → `/admin`, approved vendor → `/vendor`, vendor applicant → `/vendor/onboarding`, customer → `/account`.
2. Marketplace Account links and old `/login?next=/account` bookmarks could land vendors on customer content. `/account` now resolves identity before fetching customer-only data and forwards the appropriate workspace. Explicit order/cart destinations still work.
3. Customers starting vendor onboarding retained customer intent. Saving vendor contact details and submitting an application now persist vendor intent without granting the vendor permission. Existing applications override old customer intent in server-returned identity, so existing affected users do not need new accounts.
4. Vendor workspace fetched protected products/orders in parallel with checking approval. A rejected API call prevented the intended onboarding redirect. Identity and application status now load before protected requests.
5. Pending application screens linked back to the customer account and never refreshed their decision. They now retain vendor status, offer a status refresh, poll visible pending pages every 30 seconds, and offer marketplace browsing while awaiting review.
6. Review decisions updated roles but did not notify the applicant. Decision, audit event, in-app notification and queued email now commit in one transaction. Delivery of queued mail remains dependent on the worker/provider.
7. Notification emails linked to nonexistent `/account/notifications`. They now link to `/notifications`.
8. `/verify-email` without a token displayed an incomplete-link error even when a user was simply waiting for email. It now shows a waiting/request-another-link state; invalid supplied tokens still show errors.
9. Vendor onboarding displayed five steps in a four-column progress layout. Corrected to five columns. Email verification copy also no longer implies every review-mode user clicked an email link.
10. Automatic private-review signup now chooses its destination from the signed-in server identity rather than just the role tab submitted by the browser. Existing duplicate-email accounts are not converted or granted permissions by signup.

## Outstanding product and integration gaps

| Priority | Gap | Consequence / required next action |
| --- | --- | --- |
| High | Onboarding document uploads are separate from vendor applications. The form explicitly says this; application approval does not require an attached approved document. | Design and implement an owned document reference in the application, expose it to the reviewer, and enforce the agreed verification policy transactionally. Keep private documents private. |
| High | Business details typed in later onboarding steps are kept in component state until final submission. Save & exit does not persist those draft fields. | Add an authenticated server-side draft/resume contract; do not imply those fields were saved. |
| High before public beta | Real email delivery to all users, approved bank/provider configuration, worker execution and backup restoration need verification in the hosted environment. | Private review mode intentionally bypasses new-account verification and simulates payment; this does not establish public-beta readiness. |
| Medium | Application approval changes now generate notifications, but reminders/deadlines for application review are not defined. | Agree on review service hours and response targets, then add escalation policy. |
| Medium | Readiness settings reference a pending document via localStorage and cannot display its current moderation status directly. | Add an owned upload-status endpoint and show pending/approved/rejected status, including after returning on another device. |
| Medium | Individual applicants are required to provide a registration number. | Agree on accepted individual-vendor evidence before changing validation or excluding applicants. |
| Medium | Detailed customer preferences onboarding is still outstanding. | Implement the approved screens and persistence; current signup is not that full preferences journey. |
| Medium | Vendor payments shows operational order values, not a settlement ledger or withdrawal workflow. | Agree on vendor settlement rules and implement reconciled reporting before promising payouts. |
| Medium | Workspace header search fields are presentational. | Connect scoped search or remove the inactive control. |
| Medium | Several API lists cap results at a fixed page size; dashboards consume a single page. | Add pagination to the interfaces before treating displayed counts as full-business totals at scale. |
| Low | README/API overview/ownership documents contain superseded implementation/deployment/ownership statements. | Reconcile documentation with current routes, deployment and team ownership. |

## Regression coverage

- Role-based default routes, safe explicit local destinations and rejected external redirects.
- Customer → vendor applicant transition, legacy customer-intent application recovery, pending access denial, approval in an existing session and suspension without losing vendor application identity.
- Review notifications and corrected notification-email destination.
- Existing suite covers account verification/reset/session expiry, catalogue moderation, stock reservation/concurrency, quote acceptance, simulated/offline payment, fulfilment, returns/refunds, uploads/privacy, support isolation and worker retries.

## Required hosted acceptance checks after deployment

Use labelled team review accounts, not real bank transfers. Create a new vendor, complete all steps, leave and sign back in while pending, approve from a different administrator account, refresh status and open the vendor workspace. Confirm that marketplace Account returns to the vendor workspace and that customer identity remains private. Then verify product image moderation, listing approval, stock confirmation, customer quote acceptance, simulated payment and delivery. Repeat denied access after suspension. Test email delivery and backup restore separately against the intended public-beta configuration. Automated passing tests do not replace these hosted checks.
