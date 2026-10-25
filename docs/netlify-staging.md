# Netlify beta deployment

This setup runs the Fendor beta on Netlify Free while GitHub remains the source-control and review system.

## Services

- **Application, API, domain and HTTPS:** Netlify project connected to `Johua16/fendor-2.0`. The repository's `netlify.toml` selects `apps/web`, builds Next.js and deploys the scheduled operations worker.
- **PostgreSQL and encrypted uploads:** Neon Postgres using its pooled `DATABASE_URL`. Fendor sanitises, re-encodes and encrypts uploaded files before storing them in PostgreSQL.
- **Transactional email:** Resend SMTP with a verified Fendor sending domain.
- **Scheduled operations:** Netlify invokes `operations-worker` every five minutes. Each run expires reservations, escalates vendor deadlines, creates notifications, sends a bounded email batch and cleans up expired sessions and tokens.
- **Code review:** Pull requests use Netlify Deploy Previews. Publish to production only after the preview has been accepted because production deploys consume plan credits.

## Build settings

The committed `netlify.toml` supplies the required settings:

```text
Base directory: apps/web
Build command: npm run build
Publish directory: .next
Functions directory: netlify/functions
Node.js: 24
```

## Environment variables

Configure these in Netlify. Keep secrets out of Git.

```text
DATABASE_URL=
APP_ORIGIN=https://<netlify-or-custom-domain>
OUTBOX_KEY=<64-hex-character-random-key>
RESERVATION_MINUTES=60
VENDOR_RESPONSE_MINUTES=30
SMTP_URL=smtps://resend:<resend-api-key>@smtp.resend.com:465
MAIL_FROM=Fendor <notifications@<verified-domain>>
BETA_REVIEW_MODE=false
REVIEW_ACCESS_CODE=<long-random-team-review-code>
```

Add the approved bank details only when payment testing begins. Leaving any value unset keeps payment instructions closed.

```text
PAYMENT_BANK_NAME=
PAYMENT_ACCOUNT_NAME=
PAYMENT_ACCOUNT_NUMBER=
```

For a private product review before Fendor has approved bank details or a verified sending domain, set `BETA_REVIEW_MODE=true` and configure a long, unique `REVIEW_ACCESS_CODE`. The review code protects every product page and API except health/readiness checks with an HTTP-only seven-day access cookie, allowing Netlify's site visibility to remain public without exposing the beta to casual visitors. New review accounts are verified immediately and administrators receive a **Simulate test payment** action after a customer accepts a quote. No transfer is requested or recorded as real money. Rotate the review code if it is shared outside the approved team. Remove `REVIEW_ACCESS_CODE` and set `BETA_REVIEW_MODE=false` before the public beta, configure branded email and approved payment details, then repeat the payment and identity release checks.

## Database and account setup

Run migrations once against the Neon beta database from a trusted machine with the beta environment loaded:

```bash
npm run db:migrate --prefix apps/web
```

Each administrator must create and verify a normal Fendor account. Then grant access with the beta `DATABASE_URL` loaded:

```bash
npm run admin:grant --prefix apps/web -- admin@example.com
```

Use a separate administrator account for each person so actions remain attributable.

## Release checks

1. Confirm `/api/health` and `/api/ready` return HTTP 200.
2. Create one customer and one vendor account and verify both emails.
3. Approve the vendor, publish a test product and complete the request-to-payment-review journey.
4. Confirm the scheduled function records a successful worker cycle.
5. Test the customer, vendor and administrator routes on a phone-sized screen.
6. Monitor Netlify credits and Neon storage throughout the beta.

Free tiers have no service-level guarantee. Before a wider launch, create separate production secrets, complete a database restore drill and select paid capacity based on measured beta usage.
