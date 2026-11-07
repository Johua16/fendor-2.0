# Fendor product and operating decisions

## Automatic destination pricing — 5 November 2026

- Standard orders use centrally maintained packaging prices and an average fixed delivery fee for each supported destination, initially Abuja. Vendor pickup locations can differ; the destination fee is the business's average, not a live route calculation.
- Vendors still confirm and reserve stock. Customers choose packaging, save recipient/address details, calculate the total and accept it before paying. Admin quoting is an exception, not the standard path.
- Relationship and occasion remain in gift details. Customer totals are calculated on the server and stored as immutable quotes; later rate edits do not alter accepted totals.
- Rates remain unconfigured by default. Local sample rates are explicitly labelled test data; they are not approved public prices or nationwide coverage.
- Local in-app notifications and expiry run using `node --env-file=.env.local scripts/local-operations.ts` from apps/web. This local worker intentionally does not send external email.

## Review programme retired — 3 November 2026

- The founder requested ending the temporary team-review flow both locally and on Netlify, restoring the standard customer and vendor journeys.
- Application runtime no longer enables the access-code gate, automatic account verification, or simulated checkout through BETA_REVIEW_MODE. Old review entry links return to the homepage.
- Homepage and shop remain public. New accounts use email verification; customer sign-in opens the homepage unless continuing an explicit task, while vendor and admin destinations follow server identity.
- Paystack test credentials remain test credentials. Ending team review does not authorise real charges or remove stock, quote, vendor approval, or payment-verification checks.
- Historical review accounts and order records are retained. Designer-screen fidelity and outstanding onboarding work require a separate comparison against the approved Figma flow.
- Netlify must receive the updated application before this retirement takes effect there.

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
- The private-review gate opens the customer/vendor choice first. Review-mode signup creates the verified session immediately: customers continue to the homepage and vendor applicants continue through vendor onboarding.
- A distinct multi-step customer preferences/onboarding journey is still outstanding. The current customer path covers role choice, account creation and automatic review sign-in only; do not report the additional customer journey as complete until its approved fields and screens are implemented.

## Local customer account experience — 26 October 2026

- Customer signup and ordinary sign-in open the homepage. The header uses My Account for the private order/tracking/support space.
- Explicit sign-in destinations, including My Account, order details and checkout, remain intact.
- Approved vendors, vendor applicants and administrators retain their role-specific destinations.
- Build and review these changes locally. Do not push, merge or deploy them until the founder explicitly requests publishing.

## Local vendor catalogue experience — 26 October 2026

- Approved vendors can create drafts, securely upload product images, edit listing details, price and stock, submit listings for moderation, and pause live listings.
- Any vendor edit returns the listing to draft and requires a fresh Fendor review before it becomes public again.
- Listings with reserved customer stock cannot be edited until Fendor resolves the active requests.
- Customer availability requests expose only the product, quantity and fulfilment state to the vendor. Fendor retains customer identity, personalisation, payment and delivery details.
- These vendor improvements remain local until the founder explicitly requests publishing.

## Hosted online checkout — 26 October 2026

- Live checkout begins only after the vendor confirms availability, Fendor prepares the full product, packaging and delivery quote, and the customer accepts that exact quote.
- Customers may use Paystack, Flutterwave or PayPal when Fendor has configured the provider. Provider secret keys remain on the server and checkout opens on the provider's hosted payment page.
- A browser redirect never confirms an order. Fendor rechecks the reference, exact provider amount, currency and final status through the provider API; signed webhooks provide a second confirmation path.
- PayPal uses an approved settlement currency and a locked NGN-per-unit conversion rate because the Fendor quote is in NGN. The displayed provider total is stored with the payment attempt and must match exactly on verification.
- If money succeeds after stock, reservation or quote details change, Fendor records the payment, freezes the order for financial review and does not promise fulfilment until an administrator resolves it.
- Offline bank-transfer code remains available for historical records and later policy decisions, but the customer checkout presents hosted online payment when providers are configured.
- This checkout implementation remains local. Test credentials and provider sandbox accounts are required before staging validation; merchant approval and live credentials are required before collecting real money.
