# Paystack controlled live-payment pilot

Status: code preparation only. Public checkout remains disabled. Do not apply migration 012, change Netlify variables, or initiate a real payment without release approval.

## Release safeguards

- Keep `PUBLIC_CHECKOUT_ENABLED=false`, `ALLOW_SANDBOX_PAYMENTS=false`, and `BETA_REVIEW_MODE=false`.
- Store the live Paystack secret and webhook signing secret only in Netlify's production secret manager.
- Set `CONTROLLED_LIVE_PAYMENT_TESTER_IDS` to the comma-separated UUIDs of the specifically approved, verified customer accounts. Do not use email addresses. Remove the IDs after the pilot.
- Configure the production HTTPS callback as `${APP_ORIGIN}/api/payments/callback/paystack` and webhook as `${APP_ORIGIN}/api/payments/webhooks/paystack`.
- Generate the current Paystack webhook signing secret and verify that live events carry `Paystack-Signature`. Keep legacy verification available during the documented transition.
- Confirm approved packaging options and Abuja delivery-zone fees in production before creating the pilot quote.

## Migration 012 preflight

Migration `012-payment-safety.sql` is additive, except for the active-attempt uniqueness rule. It deliberately stops if historical data contains more than one initializing or pending attempt for an order and provider.

Run this read-only query before the approved migration window:

```sql
SELECT order_id, provider, count(*) AS active_attempts,
       array_agg(reference ORDER BY created_at) AS references
FROM payment_attempts
WHERE status IN ('initializing', 'pending')
GROUP BY order_id, provider
HAVING count(*) > 1;
```

If rows are returned, do not delete or rewrite them. Verify every reference in the Paystack Dashboard/API, record any successful money, place the order on financial hold, and mark only confirmed abandoned attempts failed through an approved reconciliation change. Repeat the query until it returns no rows.

Before applying the migration:

1. Create a production backup and complete the isolated restore test.
2. Record migration checksums and the deployed commit.
3. Confirm the preflight query returns zero rows.
4. Apply migration 012 in the approved maintenance window.
5. Confirm the new partial unique index and `payment_webhook_events` table exist.
6. Run `/api/ready` and the read-only payment exception queries.

The migration runs transactionally. A preflight failure or SQL error rolls the migration back. Migration 012 must not be manually edited after application because the migration runner verifies its checksum. If the application deployment fails after migration, restore the previous application deploy; the added columns, index and webhook table are backwards compatible. Do not restore the production database unless corruption is confirmed and the incident owner approves the verified backup.

Expected SHA-256 for the reviewed migration: `376402aba8aacef0d9fd3377545da8ba273005244f3ee2ee24bc1910d0c77dda`.

## Manual refund procedure for the pilot

Fendora does not yet initiate Paystack refunds automatically. For the controlled pilot:

1. Freeze fulfilment and open the affected order in **Admin → Orders & finance**.
2. Compare the Fendora provider payment ID, reference, amount and customer with the Paystack live transaction. Never rely on a screenshot or debit alert.
3. Obtain the required internal approval for the refund and record the reason in the order/support case.
4. Initiate the full or partial refund in the Paystack Dashboard using the verified transaction. Do not send a separate transfer unless the documented Paystack refund route cannot be used and finance approves the exception.
5. Wait for Paystack to report the refund as processed. A pending or processing refund is not complete.
6. Record the completed Paystack refund reference and exact amount in Fendora. Attach the order remedy/return decision where principal funds are being refunded.
7. Confirm the Fendora net ledger, Paystack transaction and business bank settlement agree. Only then close the remedy or financial hold.
8. Notify the customer through Fendora and retain the Paystack reference. Do not promise a bank-arrival date that Paystack has not confirmed.

For duplicate or overpaid charges, do not fulfil twice. Keep the order on financial hold, refund the excess charge through Paystack, record it, reconcile the ledger, and have a second operator review the evidence.

## First controlled live-payment test

1. Deploy the reviewed commit and apply migration 012 only after backup, restore and preflight approval.
2. Confirm the production commit, `/api/ready`, HTTPS origin, callback and webhook.
3. Confirm public checkout is false and only the single approved customer UUID is allowlisted.
4. Create one approved vendor, one approved low-value genuine product, real stock quantity, one approved packaging option and one supported Abuja delivery fee.
5. As the allowlisted customer, request the product and save real test-recipient delivery details.
6. As the vendor, confirm and reserve the exact stock.
7. As the customer, calculate and accept the immutable product, packaging and delivery total.
8. Start Paystack once. Confirm one active payment attempt exists and the amount/reference match Paystack before paying.
9. Complete the payment using an authorised internal payer. Do not repeat it if the callback is slow.
10. Confirm the signed webhook is stored and processed, exactly one receipt exists, stock is allocated once, the order is confirmed, and customer/vendor/admin notifications arrive.
11. Complete preparation, dispatch and delivery evidence through the normal order flow.
12. Run a separate approved refund exercise, or refund this pilot order if the business decision is not to retain the test sale. Verify and record the completed refund using the procedure above.
13. Remove the tester UUID and confirm checkout is unavailable while `PUBLIC_CHECKOUT_ENABLED=false`.

Stop immediately for an unknown reference, amount/currency mismatch, duplicate charge, failed webhook, expired reservation, vendor/product change, financial hold, or disagreement between Paystack and Fendora records.

Provider references: [Paystack webhook verification](https://paystack.com/docs/payments/webhooks/), [server-side transaction verification](https://paystack.com/docs/payments/verify-payments/), and [refund lifecycle](https://paystack.com/docs/payments/refunds/). A Paystack refund is complete only when its status is `processed`; bank receipt can still take additional business days.
