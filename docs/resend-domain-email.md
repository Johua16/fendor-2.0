# Fendora domain email rollout

This is a release runbook. It does not assert that `fendoraworld.com` is already
authenticated for email, and it does not authorise a DNS or production change.

## Intended identities

- Automated sender: `Fendora <notifications@fendoraworld.com>`
- General replies and enquiries: `hello@fendoraworld.com`
- Support correspondence: `support@fendoraworld.com`

Resend supplies outbound transactional delivery only. Namecheap forwarding can
continue receiving `hello@` and `support@`; it does not create a mailbox capable
of sending as those addresses. Preserve the existing Namecheap MX and forwarding
records until a separate receiving-mail decision is approved.

## Resend DNS capture (required before any DNS edit)

Add the root domain `fendoraworld.com` in **Resend → Domains** so the application
can send from `notifications@fendoraworld.com`. Resend generates the authoritative
records for that specific domain and account. Copy them verbatim into the table
below before proposing a Namecheap change. Do not substitute sample values.

| Purpose | Type | Name/host from Resend | Value/target from Resend | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| DKIM | Pending dashboard capture | Pending | Pending | Pending | Not verified |
| SPF / return path | Pending dashboard capture | Pending | Pending | Pending | Not verified |
| Return-path MX, if supplied | Pending dashboard capture | Pending | Pending | Pending | Not verified |

Resend currently generates DKIM plus SPF/return-path records, and may use a
dedicated return-path subdomain. The dashboard-generated name, value and priority
are the only approved source. A DNS export and screenshot should be attached to
the release record before editing Namecheap.

### Conflict checks

1. Export or screenshot every existing Namecheap record first.
2. Do not edit the website `A`, `CNAME` or Netlify verification records.
3. Do not remove Namecheap forwarding MX records.
4. Do not publish two SPF TXT records at the same hostname. Resend's generated
   return-path record should remain on its specified subdomain; if it requests a
   hostname that is already used, stop and choose an unused custom return path in
   Resend rather than merging or replacing records by guesswork.
5. Wait for Resend to report the domain verified before sending from it.

## DMARC monitoring proposal

After SPF and DKIM are verified, add a DMARC record at `_dmarc.fendoraworld.com`
in monitoring mode. The exact reporting mailbox must exist and be tested first.
Use the following policy only after replacing the placeholder with that approved
mailbox:

```text
v=DMARC1; p=none; rua=mailto:APPROVED-DMARC-REPORT-INBOX; adkim=s; aspf=s; pct=100
```

This is a proposed policy, not a record that has been published. Review reports
before changing `p=none` to `quarantine` or `reject`.

## Application configuration after DNS verification

Keep these values in Netlify's encrypted environment, never in Git:

```dotenv
APP_ORIGIN=https://fendoraworld.com
SMTP_URL=smtps://resend:RESEND_API_KEY@smtp.resend.com:465
MAIL_FROM="Fendora <notifications@fendoraworld.com>"
MAIL_REPLY_TO=hello@fendoraworld.com
MAIL_SUPPORT_REPLY_TO=support@fendoraworld.com
PUBLIC_CHECKOUT_ENABLED=false
```

Create the Resend API key with sending-only permission if the account supports
that scope. Keep the working Gmail `SMTP_URL` and `MAIL_FROM` values in the
password manager as rollback material; do not run two delivery workers against
the same outbox.

## Acceptance test and rollback

1. Use a protected preview or local environment with the Resend values.
2. Send customer verification, vendor verification, password reset, order update
   and support reply messages to controlled Gmail and Outlook inboxes.
3. Record delivery time and Inbox/Promotions/Spam/Junk placement.
4. In Gmail **Show original**, record SPF, DKIM and DMARC results. In Outlook,
   inspect the message source and record the corresponding authentication results.
5. Exercise one forced SMTP failure and confirm the encrypted outbox retries it,
   then confirm exhausted failures remain visible in Admin Operations.
6. Confirm registration, verification, reset, order and support UI state is not
   rolled back when an immediate send fails; the durable worker must retry it.
7. Switch production only after all test messages use `fendoraworld.com` links and
   authentication passes. If delivery regresses, restore the saved Gmail SMTP
   values and run exactly one worker.

Provider acceptance is not proof of Inbox placement. Do not mark authentication
or placement as passed until the received-message headers have been inspected.

References: [Resend SMTP](https://resend.com/docs/send-with-smtp),
[Resend domains](https://resend.com/docs/dashboard/domains/introduction), and
[Google sender guidelines](https://support.google.com/a/answer/81126).
