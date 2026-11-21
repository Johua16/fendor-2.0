# Domain email preparation — 22 November 2026

## Audit result

Fendora uses Nodemailer through the `SMTP_URL` environment variable. The same
transport is used by the immediate post-request fast path, the scheduled Netlify
worker, the portable cron route and the local worker. The durable source of truth
is the encrypted PostgreSQL `email_outbox`; provider failure never rolls back the
account, order or support transaction that queued the message.

The last documented working provider is Gmail SMTP with
`officialfendora@gmail.com`. The repository does not contain production SMTP
credentials, and the Git-ignored local production file contains no mail settings.
Therefore source inspection cannot honestly confirm the current secret Netlify
`SMTP_URL` host. Resend is the intended provider but remains unverified until its
dashboard supplies DNS records and reports the domain authenticated.

Already present before this change:

- Branded HTML and plain-text verification, reset and notification messages.
- Verification expiry of 24 hours and password-reset expiry of one hour.
- Single-use hashed tokens, 60-second resend cooldown and five accepted requests
  per address and purpose per hour.
- One stable pending identity-email record per user/purpose, preventing a backlog
  of stale verification links.
- Bounded exponential retry, encrypted payloads, recipient-safe logs and an admin
  failed-mail queue with manual retry.
- Immediate delivery attempts plus a durable scheduled-worker fallback.

Gaps corrected in this branch:

- Automated messages can consistently use `notifications@fendoraworld.com` via
  the deployment-level `MAIL_FROM` value.
- Identity/security replies route to `support@fendoraworld.com`.
- Order and general notification replies route to `hello@fendoraworld.com`.
- Support-case messages route to `support@fendoraworld.com` without creating a
  second notification workflow.
- Reply addresses are validated and remain optional so the Gmail configuration
  can be restored without a code rollback.
- Deployment documentation now uses the official origin and records a DNS-safe
  Resend cutover and rollback procedure.

## Verification performed

- `npm run typecheck --prefix apps/web`: passed.
- `npm test --prefix apps/web`: 79 passed, 0 failed. This includes provider
  failure/retry, deduplication, identity expiry, account/vendor lifecycle, order
  lifecycle and new reply-routing coverage.
- `npm run build --prefix apps/web`: passed; all application routes built.
- `PUBLIC_CHECKOUT_ENABLED=false` remains the documented/example production
  value. This branch does not modify checkout code or provider credentials.

No real Gmail or Outlook message was sent. Inbox placement and SPF/DKIM/DMARC
results remain pending because changing production SMTP/DNS is outside this
preparation branch. Record those results in
`docs/releases/email-onboarding-readiness-2026-11-14.md` only after inspecting
the received message headers.

## Release sequence

1. In the authenticated Resend account, add `fendoraworld.com` and capture every
   generated DNS field into `docs/resend-domain-email.md`.
2. Review the Namecheap export for conflicts and obtain approval for the DNS edit.
3. Add only the approved generated records; preserve website and forwarding DNS.
4. Wait for Resend verification and send protected-preview Gmail and Outlook
   tests with `APP_ORIGIN=https://fendoraworld.com`.
5. Record placement and SPF/DKIM/DMARC results.
6. Back up the working Gmail SMTP settings, then configure the five mail values
   in Netlify. Keep `PUBLIC_CHECKOUT_ENABLED=false`.
7. Deploy once, verify readiness and worker health, then run customer, vendor,
   reset, order and support journeys.
8. Roll back to the saved Gmail SMTP values if delivery or worker health regresses.

No database migration is required for this change.
