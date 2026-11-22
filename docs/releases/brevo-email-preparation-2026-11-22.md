# Brevo transactional email release preparation — 2026-11-22

## Implemented

- Official Brevo `POST /v3/smtp/email` server-side integration with no browser
  exposure of the API key.
- Existing encrypted PostgreSQL outbox, stable identity-message deduplication,
  exponential retries and Gmail SMTP rollback preserved.
- Priority queue with a 300/day local limit and 30-message reserve for identity,
  payment and security notifications.
- Provider message IDs and delivery states recorded; authenticated Brevo webhook
  updates accepted, delivered, deferred, failed and complaint states.
- Administrator delivery exceptions and daily provider usage available through
  operations endpoints without recipient addresses or message contents.
- Fendora sender and reply routing prepared for `notifications@`, `hello@` and
  `support@fendoraworld.com`.

## Release gates

1. Apply migration `013-email-delivery-monitoring.sql` after a verified backup.
2. Capture and publish only Brevo-generated DNS values; preserve forwarding MX
   and existing SPF.
3. Confirm Brevo reports domain authentication successful.
4. Configure the Brevo API key and webhook secret in a protected environment.
5. Complete controlled Gmail and Outlook verification/reset/order tests and
   inspect authentication headers.
6. Keep `PUBLIC_CHECKOUT_ENABLED=false` throughout the rollout.

Until these gates pass, production remains on its current Gmail SMTP transport.
