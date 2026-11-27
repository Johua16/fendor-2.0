# Cloudflare Workers + AWS PostgreSQL pilot

This runbook prepares a **protected pilot**, not a production cutover.  The
existing Netlify site, Neon production database and Supabase pilot remain
unchanged.  `PUBLIC_CHECKOUT_ENABLED=false` is required in every Cloudflare
environment.

## What is in this branch

- OpenNext for Cloudflare packages the existing Next.js 16 application.
- `wrangler.jsonc` targets a separate Worker named `fendora-pilot` and adds a
  five-minute Cron Trigger.
- `cloudflare/worker.ts` invokes the existing, bearer-protected operations
  endpoint rather than creating a second notification workflow.
- `DATABASE_PROVIDER=cloudflare_hyperdrive` makes the app fail closed unless a
  Cloudflare Hyperdrive binding is present.  It never falls back to an exposed
  RDS connection string.
- The adapter has no persistent cache in the protected pilot.  This avoids
  adding R2/KV cost and accepts lower cache performance for the test scope.

## Preconditions before any AWS resource is created

1. Sign in to the intended AWS account and inspect Free Tier/credit eligibility,
   active region, billing alerts and the estimated RDS charge.
2. Obtain written approval for the selected RDS region, instance class, storage,
   backup retention and the maximum monthly cost if it is not entirely covered
   by the account's current credits.
3. Configure a private RDS PostgreSQL instance with encryption, TLS, automated
   backups and separate administrator/application roles.  Do not make it public.
4. Use an approved verified export only.  Because Neon is quota-blocked, its
   newer records must first be recovered and reconciled before any production
   cutover.  A pilot may use only the approved November 9 export or synthetic
   data, clearly labelled as incomplete.

## Connectivity design

Workers cannot reach a private RDS endpoint directly.  The approved pilot
design is Cloudflare Hyperdrive connected through a private, reviewed network
path (Workers VPC/private networking where supported).  Do **not** add a broad
`0.0.0.0/0` RDS security-group rule or use an unvalidated public endpoint.

After the Hyperdrive resource is created, add its **non-secret resource ID** to
`apps/web/wrangler.jsonc`:

```jsonc
"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<approved-hyperdrive-id>" }]
```

Set the secret/non-secret Worker configuration only in Cloudflare's protected
environment settings:

- `DATABASE_PROVIDER=cloudflare_hyperdrive`
- `APP_ORIGIN=<the protected pilot HTTPS origin>`
- `OUTBOX_KEY=<existing secure secret>`
- `CRON_SECRET=<new random 32+ character secret>`
- `PUBLIC_CHECKOUT_ENABLED=false`
- existing session, SMTP/Brevo fallback and other application secrets required
  for the pilot; leave payment keys absent and live checkout disabled.

Hyperdrive supplies `HYPERDRIVE.connectionString` at runtime.  It is not put in
the browser bundle or committed to Git.  Database migration and backup tools
use a separate administrative connection outside Workers.

## Protected preview

Before `wrangler deploy`, create a non-production pilot hostname and a
Cloudflare Access policy that permits only named Fendora testers.  Verify the
policy blocks an anonymous browser before assigning the Worker route.  Do not
use an unprotected `workers.dev` URL for customer/vendor/admin testing.

Deploy only after the Access policy, environment secrets and Hyperdrive binding
are confirmed:

```bash
npm run build:cloudflare --prefix apps/web
npx wrangler deploy --config apps/web/wrangler.jsonc
```

The checked-in config has no RDS/Hyperdrive ID, account ID, route, secret or
production domain.  That omission is intentional: it prevents an accidental
deployment from connecting to any database.

## Database verification order

1. Create an encrypted backup outside the database service and validate an
   isolated restore.
2. Restore the approved pilot data into a private pilot database.
3. Apply migrations `001` through `013` in order using the administrative
   migration role; record schema version, foreign keys, indexes and counts.
4. Run application readiness through the Worker with the least-privilege app
   role, confirm TLS and certificate validation, then test rollback/transaction
   paths and connection reuse.
5. Run only synthetic customer/vendor/admin tests.  Do not send real mail or
   create a live payment.

## Rollback

Remove the pilot route or disable its Cloudflare Access application.  Keep
Netlify and Neon untouched.  Do not point `fendoraworld.com` at Cloudflare
until Neon data is recovered, reconciled, backed up and a separate production
approval is recorded.
