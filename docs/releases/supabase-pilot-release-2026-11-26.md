# Supabase controlled-pilot release preparation

Date: 26 November 2026

Status: **private pilot verified; production database cutover blocked**

## Reconciled release contents

The integration branch applies the outstanding work in migration order:

1. PR #40 payment safety and `012-payment-safety.sql`.
2. PR #42 Brevo delivery monitoring and `013-email-delivery-monitoring.sql`.
3. PR #45 Supabase compatibility evidence and load tooling.
4. Portable encrypted backup, restore verification, failure alerting, and certificate-pinned database configuration.

The integration preserves both payment-exception recovery and Brevo delivery telemetry. Database readiness requires migrations 001–013 exactly once.

## Current production evidence

- Netlify production deploy: commit `a4951a7`, deploy `6b06999f9f11e9c54ff08f02`, published 25 November 2026.
- `https://fendoraworld.com`: HTTP 200.
- `https://www.fendoraworld.com`: redirects to the canonical domain and returns HTTP 200.
- `/api/health`: HTTP 200.
- `/api/ready`: HTTP 503 because the active Neon database rejects connections with quota error `53000`.
- Netlify Free plan: 282.3 of 300 credits remaining for the 25 November–24 December billing period. Production deployment capacity is available.

## Mandatory cutover blocker

Neon production is currently quota-blocked. A fresh production backup, schema state, record counts, last-write time, and any changes after the 9 November backup cannot be verified. The 9 November archive is therefore not accepted as a current production snapshot.

Production `DATABASE_URL` must not be switched to the Supabase copy until one of these is completed:

1. Neon access returns and a fresh, encrypted backup and isolated restore pass; or
2. the founder explicitly approves a new isolated pilot data set after acknowledging that unverifiable post-9-November production records will not be present. That must use a separate pilot identity and must not be described as a complete migration of production data.

Neon has not been deleted, reset, migrated, or modified.

## Supabase pilot security

- Application traffic: least-privilege role through transaction pool port 6543.
- Migrations and manual recovery: administrative role through session pool port 5432 only.
- Data API: disabled.
- `anon` and `authenticated`: zero unintended application grants after the POC hardening.
- Connection pool: maximum five connections per warm application instance, 5-second connection timeout, 10-second idle timeout, 5-minute connection lifetime, 10-second statement timeout, and 12-second query timeout.
- TLS: application accepts a base64-encoded provider CA and sets `rejectUnauthorized=true`. Backup URLs must use `sslmode=verify-full` and the pinned Supabase CA.
- Credentials: server-side environment variables only. No database credential is committed.

The Supabase Free network endpoint cannot be restricted to one Netlify `/32` because Netlify Free does not provide stable outbound addresses. The compensating controls are TLS hostname verification, strong rotated credentials, a DML-only application role, disabled Data API, revoked public roles, conservative pooling, and monitoring. This residual public-endpoint risk must be explicitly accepted before production cutover.

## Backup system

`ops/portable-backup.sh`:

- dumps only the application `public` schema;
- excludes ownership and ACLs;
- removes only Supabase's non-portable `pg_attver` attributes;
- encrypts with AES-256-CBC/PBKDF2 using 200,000 iterations;
- produces plaintext and encrypted SHA-256 evidence without retaining plaintext.

`ops/verify-portable-backup.sh`:

- refuses non-local restore targets;
- requires an explicit destructive-restore guard for the disposable database;
- verifies the plaintext checksum after decryption;
- restores into stock PostgreSQL 18;
- requires at least 13 migrations and reports users, order requests, and payment records.

The scheduled GitHub Actions workflow runs daily, retains encrypted artifacts for 14 days, performs a complete restore before upload, and opens or updates a GitHub issue when backup or restore verification fails. It uses two protected repository secrets:

- `SUPABASE_BACKUP_DATABASE_URL`: certificate-verified least-privilege session-pool URL.
- `SUPABASE_BACKUP_PASSPHRASE`: independent high-entropy encryption passphrase.

The protected secrets were configured after explicit founder approval. GitHub Actions run `45774490702` completed successfully on 26 November 2026: it created an encrypted portable artifact, restored it into isolated PostgreSQL 18, and verified 13 migrations, 7 users, 0 order requests, and 0 payment records. The encrypted artifact `fendora-supabase-backup-45774490702` is retained through 10 December 2026. The temporary PR-only workflow trigger was removed after validation, so pull requests cannot access these secrets. The recurring schedule becomes active only after the reviewed workflow reaches the default branch.

## Private Netlify pilot

- Private alias: `https://supabase-pilot--fendor-beta.netlify.app`.
- Verified deploy: `6b0887fc12d7148f37245b5d`.
- Anonymous access: HTTP 401; the pilot does not expose restored data publicly.
- Authenticated `/api/ready`: HTTP 200 with `status=ready`.
- Database: DML-only Supabase transaction-pool role with the official Supabase 2021 CA pinned and `rejectUnauthorized=true`.
- Catalogue: database-backed and empty; the storefront displays the honest catalogue-preparation message rather than sample products.
- Email: deliberately disabled with a non-routable local SMTP target for this pilot.
- Payments: `PUBLIC_CHECKOUT_ENABLED=false`, sandbox payments disabled, and no controlled live-payment tester is configured.
- Production: unchanged on commit `a4951a7` and deploy `6b06999f9f11e9c54ff08f02`; Neon and production environment variables were not modified.

The pilot exposed and corrected an SSL precedence issue in `pg`: URL-level `sslmode` options were discarding the explicitly pinned CA. The database adapter now removes connection-string TLS options only when a pinned CA is configured, preserves unrelated query parameters, and supplies the verified CA object directly. The regression is covered by an automated test, and a live read-only probe through the corrected adapter returned all 13 migrations.

## Release validation

- Type checking: passed.
- Complete local automated suite: 99 tests passed, 0 failed.
- Production build with `PUBLIC_CHECKOUT_ENABLED=false`: passed; all application routes compiled.
- Isolated Supabase integration suite: 53 tests passed, 0 failed. This covered identity and vendor lifecycle, catalogue moderation, order/stock concurrency, fulfilment, email outbox retry, signed payment webhooks, checkout initialization races, quote mutation, exceptional payments, and refunds.
- Portable backup and isolated stock-PostgreSQL-18 restore: passed with 13 migrations, 7 users, 0 order requests, and 0 payment records.
- Secret scan and patch whitespace validation: passed; no production credential is part of the release diff.

These results establish application and schema compatibility with the isolated Supabase pilot. They do not establish that the 9 November data is a current copy of Neon production.

## Cutover sequence after the blocker clears

1. Announce a maintenance window and stop production writes.
2. Record Neon migration state, table counts, record counts, and the latest write timestamp.
3. Create, encrypt, and restore-verify a fresh Neon application backup.
4. Restore that fresh snapshot into a clean Supabase application schema.
5. Apply migrations 012 then 013 once under the migration advisory lock.
6. Reapply and verify the least-privilege Supabase application grants.
7. Compare source/destination records, constraints, indexes, and identifiers.
8. Run the Supabase-backed application suite and smoke tests.
9. Configure Netlify `DATABASE_URL` for the DML-only transaction pool, `DATABASE_SSL_CA_BASE64`, and `PUBLIC_CHECKOUT_ENABLED=false`.
10. Deploy once from the reviewed integration commit.
11. Verify readiness, authentication, approved catalogue visibility, vendor/admin access, permitted writes, workers, email queues, and checkout-disabled messaging.
12. Monitor errors, latency, connections, storage, backup age, and failed operations.

Abort before step 9 if any backup, restore, count, integrity, or smoke check fails.

## Return to Neon

There is no dual-write and no automatic failback.

1. Freeze Supabase writes.
2. Create and restore-verify a fresh encrypted Supabase backup.
3. Restore into an isolated Neon branch or database, never over the preserved fallback.
4. Reconcile every record created or changed since cutover, prioritising users, orders, payment evidence, inventory, deliveries, email outbox, and administrative roles.
5. Run migration, integrity, and application tests.
6. Change Netlify only after a second record-count comparison succeeds.
7. Verify Neon readiness and writes, then preserve the final Supabase snapshot.

A Neon quota reset alone does not authorize this return.

## Free-tier monitoring and limitations

Monitor through Netlify observability, application readiness, worker health, GitHub backup workflow status, and Supabase dashboard usage:

- database availability and readiness failures;
- pool/connection errors and latency;
- database size and Free-plan quota;
- project pausing after inactivity;
- failed transactions, login attempts, order operations, webhooks, and mail;
- backup workflow failures and artifacts older than 24 hours.

Supabase Free cannot eliminate shared-compute variability, inactivity pausing, lack of paid PITR, dynamic Netlify egress, or the need for externally retained backups. These are accepted only for a controlled pilot, not as the final launch architecture.
