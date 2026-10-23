# MVP backend remaining work

Planning estimate, not a fixed PR count or delivery commitment. Shared frontend integration and design approval are additional work. Several PRs remain open; merge reviewed dependencies in order instead of growing the stack indefinitely.

1. **Financial exceptions and paid-order remedies.** Partial receipts, pre-confirmation refunds, excess refunds and refunded closure are implemented in the payment-exceptions branch. Still needed: paid principal cancellations/returns, receipt corrections/reversals, operator reconciliation tools and procedures.
2. **Delivery and fulfilment.** Recipient delivery details, service coverage, packaging selections, assignments, preparation, dispatch, proof of delivery, failed delivery and returned stock. Integrate paid-order remedies here.
3. **Notifications and response deadlines.** Vendor/customer messages through Fendor, worker retries, agreed business-hour deadlines, reminders, escalation and recovery when vendors do not respond.
4. **Media and vendor onboarding completion.** Secure uploads, document/image validation, review details, remaining approved onboarding fields and supported product options.
5. **Support and admin operations.** Customer issue reporting, case history, operational queues, reviewed exception handling and audit visibility.
6. **Production readiness.** Deploy databases and workers, secrets, backups/restore checks, monitoring, abuse controls, operational permissions and full frontend-to-backend acceptance tests.

Current PR sequence: #1 foundation (merged), #2 identity, #3 catalogue, #4 order requests/reservations, #5 quotes/payment verification. Payment exceptions follows #5. These are backend APIs, not evidence that the screens are integrated or the app is deployed. Review and merge each dependency before retargeting the next stacked PR to main.
