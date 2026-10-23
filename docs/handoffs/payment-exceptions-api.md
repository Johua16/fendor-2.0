# Payment exceptions and recorded refunds

This extends checkout on branch codex/payment-exceptions. Same-origin JSON, verified admin, no self-review, body limits and latest order version requirements apply. This is a ledger for bank transfers checked by a human; it neither sends money nor connects to a bank.

## Endpoints

POST `/api/admin/orders/:id/record-refund`

Body: `{version,paymentId,bankReference,amountKobo,bankRefundChecked:true,note}`. Record only an outbound refund confirmed complete in bank records. Note 10–1,000 characters; bank reference 3–160, trimmed/uppercased; positive safe integer NGN kobo amount. Reference must be unique across outbound refunds. Record inbound and outbound transaction IDs, not customer-entered memos. Returns `{refundId,orderId,version}`. Matching order/payment/reference/amount replay returns the existing record, even with the old version. Different details give 409 REFERENCE_CONFLICT.

A refund cannot exceed the unrefunded amount of the selected receipt. Before order confirmation, partial/full refunds can be recorded. After confirmation, only aggregate excess beyond the accepted purchase total can be refunded here. Refunding the allocated purchase price requires a separate fulfilment-aware cancellation/return flow and returns PAID_REMEDY_REQUIRED. Refunds do not replenish physical stock or silently change order state.

POST `/api/admin/orders/:id/close-refunded`

Body: `{version,note}`. Allowed only for unconfirmed requests with recorded receipts and a zero net balance. Releases any remaining hold once, clears the current quote, sets cancelled and writes a review note to the audit event. It never deletes receipts, refund records or acceptance history. Confirmed/fulfilled orders cannot use this endpoint. Requests with remaining money return FUNDS_REMAIN. To buy again after closure, create a new request and payment; no transfer of money between orders is supported.

## Updated verification and summary

`verify-payment` now reconciles all receipts minus recorded refunds on that order. Net amount must exactly match the accepted quote total; reservation/vendor/product/feasibility/acceptance checks still apply. Select any receipt with a positive remaining balance as paymentId. bankReceiptChecked means the admin checked **all** contributing receipts and refunds against bank records. All contributing receipts are marked verified atomically with one stock allocation. It can reconcile multiple partial receipts or an overpayment after the excess refund is recorded. It cannot automatically recover an expired hold where money is retained: refund-and-close is currently the supported resolution.

Checkout summary adds `netReceivedKobo` and `refundedKobo` as decimal strings to avoid overflow when aggregating receipts. Customer sees only amounts; admin also receives refund records with id, payment_id, bank_reference, amount_kobo, note and created_at. These are recorded totals, not live bank balances. Inbound status verified means that receipt contributed to confirmation; check refund ledger/net totals as well, not status alone.

Failures: 400 validation/missing bank check; 401 session; 403 role/self-review; 404 missing order/payment; 409 stale version, conflicting reference, excessive refund, remaining funds or paid-remedy requirement. Transactions lock the same variant/order as verification and expiry; competing refund requests cannot overdraw a receipt or release stock twice.

## Remaining limitations

No refund execution, failed-transfer recovery, bank reconciliation import, provider integration, automatic top-up requests, fraud investigation UI, financial approval separation or paid-order returns/remedies yet. Inbound receipt mistakes cannot be erased or silently rewritten; a reviewed correction/reversal workflow is still required before production financial operations. Customer support and finance procedures must handle these exceptions. Paid principal refunds require fulfilment-aware stock and return decisions, not an automatic restock. Do not treat this increment as a completed production payment system.
