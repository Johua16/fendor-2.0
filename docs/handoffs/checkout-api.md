# Quotes and offline-payment verification

Backend branch `codex/quotes-offline-payments` builds on order requests. Same-origin JSON/session/origin rules apply. No bank connection, automatic reconciliation, payment collection screen or fulfilment UI is delivered here.

## Routes and bodies

All mutations return HTTP 200 and the resulting orderId/version plus action-specific fields. Unknown fields are rejected.

| Route | Body |
|---|---|
| POST /api/admin/orders/:id/quote | version, packagingKobo, deliveryKobo, fulfilmentChecked:true, fulfilmentPlan |
| POST /api/orders/:id/accept-quote | version, quoteId, totalKobo |
| POST /api/admin/orders/:id/record-payment | version, bankReference, receivedKobo, receiptNote |
| POST /api/admin/orders/:id/verify-payment | version, paymentId, bankReceiptChecked:true |
| GET /api/orders/:id/checkout | Customer's own summary |
| GET /api/admin/orders/:id/checkout | Admin summary including bank receipts |

Only verified customers can accept their own quotes. Only verified admins can quote/record/verify; an admin who is the customer or vendor on an order cannot perform those actions. Vendors never receive bank references, payment notes, customer gift details or the checkout summary.

## Quote lifecycle

An active reservation, approved vendor and unchanged approved product are required. Fendor manually checks preparation, selected packaging, delivery coverage and timing, then submits fulfilmentChecked=true and a clear customer-facing fulfilmentPlan (10–2,000 characters). This attestation records the operator's check, not an automated carrier/coverage guarantee. Do not put internal secrets or third-party contact details in the plan.

The server computes product subtotal from the saved unit price × quantity. Packaging and delivery are nonnegative safe integers in NGN kobo; subtotal/total must be positive safe integers. Browser-supplied totals cannot override the quote. No extra taxes/fees/discounts are silently added. Quote creation returns quoteId and totalKobo, stores immutable quote history, clears previous acceptance, and leaves the order reserved.

Customers review the exact quoteId and totalKobo, then accept with the latest order version. Acceptance stores immutable evidence tied to that quote and moves to awaiting_payment. A new quote invalidates consent even if the amount is unchanged. Personalisation edits and stock expiry clear the current quote/acceptance; history is retained. Frontend must reload on STALE_VERSION or QUOTE_CHANGED rather than automatically accepting a new quote.

## Receipt versus confirmation

Recording funds means an admin has observed a real transaction in Fendor's bank records. receiptNote is 5–1,000 characters; bankReference is 3–160, trimmed and uppercased. Use the unique bank transaction identifier, not a customer-chosen memo. Amount must be a positive safe integer in kobo. This records an under_review receipt and audit event without confirming anything or deducting stock.

A bank reference can be used only once across all orders. Same order/reference/amount replay returns the existing paymentId despite an old version; changed order/amount gives REFERENCE_CONFLICT. Notes are not updated on retries. Do not log or expose full bank references outside the authorised admin interface.

Receipts can be recorded after reservation expiry, cancellation or confirmation so actual money is not discarded. Once any receipt exists, customer cancel/personalisation and vendor reserve/decline are blocked with PAYMENT_REVIEW_REQUIRED. New/revised quotes and acceptance are also blocked until financial review is resolved. Expiry may still release the physical hold and return the request to availability checking, but does not delete money records or acceptance history.

Verification requires exactly one receipt matching the accepted quote total, a live stock hold, valid vendor/product, and explicit bankReceiptChecked=true. Fendor must check actual receipt in its account; a customer screenshot alone is not proof. Partial, overpaid, multiple or additional receipts remain under review; no automatic confirmation/refund happens.

On successful verification, payment is marked verified and the order becomes confirmed in the same transaction that reduces both held quantity and physical available stock. The stock reduction represents allocation to this paid order, not physical dispatch. Parallel or repeated verification of the same receipt cannot deduct twice. Confirmation is not preparation, dispatch or delivery.

## Responses and exceptions

Summary: orderId, version, state, quote (`{id,details}` or null), acceptedQuoteId, orderConfirmed, reservationExpiresAt, reservationActive, fundsRecorded. Admin summary also includes payments with id, bank_reference, received_kobo (PostgreSQL bigint string), status, receipt_note, received_at. Quote details: productSubtotalKobo, packagingKobo, deliveryKobo, totalKobo, currency, fulfilmentPlan, fulfilmentChecked. Quote amounts are JSON numbers. General order reads now include quoteId, acceptedQuoteId and totalKobo for customer/admin only.

400 validation/feasibility/bank-check required; 401 session; 403 role/self-review; 404 ownership/missing order; 409 stale version, changed quote/product, inactive vendor, expired hold, mismatched payment, stock discrepancy or financial review. Failures roll back stock/state/verification changes. A previously recorded receipt remains saved if a later verification request fails.

## Launch blockers and next work

Manual exception resolution/refund and financial reconciliation workflows are NOT implemented. Late/partial/overpaid/multiple receipts therefore require operational review and cannot be cleared through these APIs yet. Do not launch payment collection until that workflow, bank-account instructions, notifications and operational procedures are ready. No payment gateway, escrow, refund promise or automatic bank verification is implied. Fulfilment scheduling, shipping details, preparation/dispatch/delivery and notifications are subsequent increments. Existing expiry worker and deployment requirements still apply.
