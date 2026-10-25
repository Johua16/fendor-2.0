# Fendor product and operating decisions

Updated: 11 October 2026

## Agreed direction

- Keep a distinct Fendor homepage with a clear route to the store. This supersedes the earlier recommendation to use the store as Home.
- The UX handoff must cover the complete customer, vendor and Fendor operations journeys, including registration, login, recovery, account management and exceptions, rather than only ordering.

- Fendor manages customer communication and coordinates local vendors and fulfilment partners. The initial model does not use open customer-to-vendor chat.
- Customers may complete personalisation questions while product availability is pending. Save their progress and clearly distinguish a pending request from a confirmed order.
- Customers should be able to leave the page and receive an update rather than remain waiting for vendor approval.
- Put a deadline on vendor confirmation, with reminders, support escalation and alternatives. Exact timings remain undecided and must account for operating hours and delivery cutoffs.
- Vendor approval should reserve the exact product or variant and quantity for an explicit period. Recheck expired reservations before confirming fulfilment.
- Verify payment before beginning fulfilment. The previously selected initial approach is admin verification of offline payment.
- Do not substitute an unavailable product without customer approval. Fendor handles communication and offers appropriate alternatives or cancellation/refund if a confirmed order cannot be supplied. Supplier cost responsibility needs agreement.

## Constraints and priorities raised by the founder

- Fendor relies on local vendors across Nigerian states rather than a Fendor warehouse.
- Waiting for a vendor to inspect their phone and approve every purchase risks frustrating customers.
- Fast vendor responsiveness must be part of vendor eligibility. A literal always-online requirement is a founder suggestion, not a final operating rule.
- Record accepted solutions as discussions continue. Do not treat recommendations as agreed decisions.

## Proposal for discussion: advance stock allocation and service slots

- Vendors allocate a small, physical quantity of selected products to Fendor at their own premises for an agreed selling window.
- Fendor can accept orders against this allocation without manual per-order availability approval, subject to preparation capacity, supported options, delivery coverage and valid reservations.
- Restrict the faster path to standard packages with agreed prices, preparation commitments and delivery arrangements. Custom work retains confirmation requirements.
- Vendors open and close selling windows and maintain a primary and backup contact. Pause new orders when allocation freshness or operational coverage is uncertain.
- During the pilot, a human vendor check-in activates a selling window; phone notifications alone are not evidence of reliable stock or readiness.
- Pilot in one limited service area before expansion. Quantities, acknowledgement times, sales windows and delivery targets are not yet agreed.
- Offline payment verification remains a separate speed bottleneck and must not be presented as automatic confirmation.

## Temporary private-review decision — 25 October 2026

- The pre-November team review uses an explicit environment-gated test mode. It may auto-verify new reviewer accounts because the Resend sandbox cannot deliver verification mail to the full team without a verified Fendor domain.
- Test checkout never shows bank details or asks for a transfer. After quote acceptance, a Fendor administrator may create an auditable simulated payment so fulfilment screens can be reviewed end to end.
- Before the November beta, disable test mode, verify a Fendor email domain, approve the legal business bank account or payment provider, and rerun customer, vendor, admin, refund and payment checks using the real release configuration.
- The five-person team review may use a shared access-code gate in front of the otherwise public Netlify URL. The code is stored only in hosting configuration, grants a seven-day HTTP-only browser session and must be removed or rotated before wider access.
