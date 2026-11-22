# Controlled onboarding email readiness — 14 November 2026

## Automated verification

- Customer and vendor signup share the same protected identity-email implementation; vendor intent does not weaken verification.
- Branded HTML and plain-text verification and password-reset messages are covered by automated tests.
- Production links are derived from the validated `APP_ORIGIN`; the production value is `https://fendoraworld.com`.
- Verification expiry: 24 hours. Password-reset expiry: one hour. Tokens are hashed, single-use and replaced on resend.
- Repeat-send protection: 60-second cooldown and five accepted requests per address and purpose per hour.
- Each account/purpose uses one stable outbox record. Resends replace it in constant time without scanning or locking unrelated mail, preventing a delayed worker from delivering several stale links.
- Delivery logs exclude recipient addresses, message contents, passwords and tokens. Exhausted failures remain visible in the administrator operations view.

## Provider and placement observations

Do not mark the rows below as passed until a human has inspected the received message. Gmail SMTP authentication success confirms only that the application can authenticate to the relay; it does not prove SPF, DKIM or DMARC results or Inbox placement.

| Journey | Recipient | Provider accepted | Placement | SPF | DKIM | DMARC | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Customer signup verification | Controlled Gmail | Pending live test | Pending | Pending | Pending | Pending | Inspect **Show original**. |
| Vendor signup verification | Controlled Gmail | Pending live test | Pending | Pending | Pending | Pending | Uses the same identity transport and template. |
| Password reset | Controlled Gmail | Pending live test | Pending | Pending | Pending | Pending | Confirm one-hour wording and successful reset. |
| Identity email | Controlled Outlook | Pending recipient and live test | Pending | Pending | Pending | Pending | Record Junk/Inbox and message headers. |

## Release boundary

These improvements support a small, monitored vendor-onboarding pilot. The
domain has been purchased, but Brevo authentication and received-message header
checks remain required. Follow `docs/brevo-domain-email.md`; do not claim SPF,
DKIM, DMARC or Inbox placement has passed before those checks are recorded.
