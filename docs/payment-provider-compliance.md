# Fendora payment-provider compliance handoff

This checklist contains no passwords, API keys, personal identification numbers or copies of company records. Upload compliance documents only inside the provider's authenticated dashboard. Never commit them to GitHub or paste them into a development chat.

## Approved public business identity

- Trading name: Fendora
- Legal entity: Fendora Innovations Limited
- Registration number: RC 9980315
- Entity type: Nigerian private company limited by shares
- Industry description: managed e-commerce marketplace, gifting coordination and digital services
- Public support contact: officialfendora@gmail.com
- Website policies: `/policies/terms`, `/policies/privacy`, `/policies/refunds`, `/policies/vendor-agreement`

Do not publish the registered street address, tax identifier, ownership records, director identity documents, signatures or private company filings on the website. Provide those items only to a verified compliance portal when the provider specifically requests them.

## Paystack activation

1. Change the Paystack profile from Starter Business to Registered Business.
2. Enter the legal entity and registration number exactly as recorded by the Corporate Affairs Commission.
3. Complete Profile, Contact, Account and Documents in the authenticated Compliance area.
4. Upload the incorporation and supporting records requested for the selected registration type.
5. Complete beneficial-owner/director verification privately, including provider-requested consent checks.
6. Add and verify the approved corporate settlement account.
7. Submit for review and keep the application in test mode until Paystack marks the business live.
8. After approval, create new live keys. Store them only in the production hosting secret manager, keep test keys separate and configure the production webhook secret and HTTPS callback URL.

## Flutterwave activation

1. Update the business profile to the registered legal entity.
2. Complete the dashboard verification checklist and submit only the documents requested for a Nigerian limited company.
3. Add the approved corporate settlement account and complete owner/director checks privately.
4. Keep the integration in test mode until the dashboard confirms live approval.
5. After approval, generate separate live credentials, store them only as production secrets and configure the production webhook hash and HTTPS callback URL.

## Before enabling live payments

- Legal and policy pages have received final Nigerian legal review.
- Product prices, packaging and delivery fees are disclosed before payment.
- Refund, return, cancellation and customer-support procedures are staffed and tested.
- Production PostgreSQL migrations and backups are verified.
- The production email domain, worker and administrator alerts are verified.
- Provider webhooks reject invalid signatures and duplicate events.
- A browser redirect never marks an order paid without server-side provider verification.
- Test and live credentials cannot be mixed.
- A low-value live transaction, refund and reconciliation test is completed by authorised operators before public release.
