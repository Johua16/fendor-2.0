# Vercel staging deployment

This setup runs the Fendor web application on Vercel and uses managed services for the state that must survive deployments.

## Services

- **Application, domain and HTTPS:** Vercel project connected to `Johua16/fendor-2.0`, with the root directory set to `apps/web`.
- **PostgreSQL and encrypted uploads:** Neon Postgres through the Vercel Marketplace. Use its pooled `DATABASE_URL`. Fendor sanitises, re-encodes and encrypts uploaded files before storing them in PostgreSQL, so a separate object-storage account is not required for the private beta.
- **Transactional email:** Resend SMTP with a verified Fendor sending domain.
- **Scheduled operations:** Call `GET /api/internal/operations-worker` every five minutes with `Authorization: Bearer <CRON_SECRET>`. This runs reservation expiry, vendor deadlines, notifications, email delivery and cleanup. Vercel Pro cron can run this schedule. On Vercel Hobby, use a reliable external scheduler because Hobby cron is limited to once per day.
- **Private access:** Enable Vercel Authentication under Deployment Protection for the staging environment.

## Environment variables

Add these to the Vercel Preview environment. Keep production values separate.

```text
DATABASE_URL=
APP_ORIGIN=https://<staging-domain>
OUTBOX_KEY=<32-or-more-random-characters>
CRON_SECRET=<32-or-more-random-characters>
RESERVATION_MINUTES=60
VENDOR_RESPONSE_MINUTES=30
SMTP_URL=smtps://resend:<resend-api-key>@smtp.resend.com:465
MAIL_FROM=Fendor <notifications@<verified-domain>>
```

Add the following only after Fendor's bank details have been approved. Leaving them unset keeps payment instructions hidden.

```text
PAYMENT_BANK_NAME=
PAYMENT_BANK_ACCOUNT_NAME=
PAYMENT_BANK_ACCOUNT_NUMBER=
```

Do not commit real credentials or bank details to Git.

## Database setup

Pull the Preview environment locally through the Vercel CLI, then run the migrations against the staging database:

```bash
npm run db:migrate
```

Confirm that `/api/health/live` and `/api/health/ready` both return successful responses after deployment.

## Administrator access

Each administrator must first create and verify a normal Fendor account. Grant the admin role from a trusted machine with the staging `DATABASE_URL` loaded:

```bash
npm run admin:grant -- admin@example.com
```

Use a separate administrator account for each person so actions remain attributable.

## Production promotion

Create a separate production database and secrets, attach the production domain, run migrations, verify email delivery and backups, and complete the staging acceptance tests before promoting the application.
