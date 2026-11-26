# Brevo domain email rollout

Brevo is Fendora's outbound transactional provider. It does not create receiving
mailboxes. Keep Namecheap forwarding and the existing receiving routes for
`hello@fendoraworld.com`, `support@fendoraworld.com` and
`vendors@fendoraworld.com` unchanged.

## Verified DNS capture

Add `fendoraworld.com` in **Brevo → Settings → Senders, Domains & Dedicated IPs →
Domains**. Copy the values Brevo shows into this table before editing Namecheap.
Values are account-specific and must never be guessed.

| Purpose | Type | Name/host shown by Brevo | Value/target shown by Brevo | Namecheap value verified | Brevo verified |
| --- | --- | --- | --- | --- | --- |
| Brevo ownership code | TXT | _pending_ | _pending_ | No | No |
| DKIM | TXT or two CNAME records | _pending_ | _pending_ | No | No |
| DMARC | TXT | `_dmarc` | Brevo's verified value | No | No |

Brevo's shared-domain authentication requires its ownership code, DKIM and
DMARC. It does not require changing MX or adding a second SPF record. Preserve
the existing Namecheap forwarding MX records and the root forwarding SPF record.
There must be only one DMARC record. Start with the monitoring policy Brevo
shows (normally `p=none`) and do not strengthen it until reports are reviewed.

## Safe cutover

1. Record all existing Namecheap DNS records and export screenshots.
2. Add only the exact ownership, DKIM and DMARC records shown by Brevo.
3. Wait for Brevo to report the domain authenticated.
4. Create a restricted transactional API key and store it only in the hosting
   provider as `BREVO_API_KEY`.
5. Configure `EMAIL_FROM_ADDRESS=notifications@fendoraworld.com`,
   `EMAIL_FROM_NAME=Fendora`, the two reply-to addresses, the 300-message limit,
   a 30-message critical reserve and a random webhook secret.
6. In Brevo, create a transactional webhook for the production webhook URL and
   add custom header `x-fendora-webhook-secret` with the same secret.
7. Run one customer verification, vendor verification, password-reset and order
   notification test to controlled Gmail and Outlook inboxes. Inspect message
   headers for SPF, DKIM and DMARC; record inbox/spam placement.
8. Only after those tests pass, set `EMAIL_PROVIDER=brevo`. Keep the working
   Gmail `SMTP_URL` and `MAIL_FROM`; rollback is changing only `EMAIL_PROVIDER`
   to `smtp` and restarting the worker.

The free plan is limited to 300 messages per day and may add Brevo branding.
Fendora defers routine messages before the limit while reserving capacity for
identity, payment and security email. The application counter assumes this is
the only sender using the Brevo account; the Brevo dashboard remains the source
of truth.

References: [Brevo domain authentication](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC), [transactional API](https://developers.brevo.com/reference/send-transac-email), [webhooks](https://developers.brevo.com/docs/transactional-webhooks), and [free-plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).
