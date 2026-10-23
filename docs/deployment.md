# Portable staging and production handoff

This repository contains a portable staging stack. It is an operations baseline, not a live deployment. Production still needs an approved hosting account, HTTPS domain, managed PostgreSQL, SMTP provider, secrets manager, alert destination and a documented incident owner.

## Local staging

1. Install Docker with Compose support.
2. Copy `.env.staging.example` to `.env.staging`.
3. Replace every `CHANGE_ME` value. Generate `OUTBOX_KEY` with 32 random bytes encoded as 64 hexadecimal characters.
4. Start the stack from the repository root:

   ```sh
   docker compose --env-file .env.staging -f compose.staging.yaml up --build -d
   ```

5. Confirm `http://127.0.0.1:3000/api/health` and `http://127.0.0.1:3000/api/ready` return HTTP 200. View captured staging email at `http://127.0.0.1:8025`.
6. Inspect the operational queue with an admin session at `GET /api/admin/operations`.

The web container serves HTTP only. Put it behind a trusted HTTPS reverse proxy in any internet-accessible environment. Keep the database and Mailpit ports private. Mailpit is for staging only.

## Required services and secrets

- Node.js 24 runtime for the web and worker processes.
- PostgreSQL 17 with encrypted storage, restricted network access and TLS for hosted connections.
- A persistent web process and exactly one active operations-worker lease. Multiple worker processes are safe, but only one performs a cycle at a time.
- `DATABASE_URL`, `APP_ORIGIN`, `OUTBOX_KEY`, `RESERVATION_MINUTES`, `VENDOR_RESPONSE_MINUTES`, `SMTP_URL` and `MAIL_FROM`.
- A reverse proxy or platform gateway that enforces HTTPS and limits request body size to at most 5 MB.

Run migrations as a one-off release step before starting the new web and worker versions. Do not run unreviewed migrations against production. Take a database snapshot before each migration.

## Monitoring

- Liveness: `GET /api/health`.
- Readiness: `GET /api/ready` checks configuration, database access, migrations and both timing policies.
- Worker: `GET /api/admin/operations` exposes last start/success/failure, current lease, overdue availability requests, financial holds, open remedies and queued/failed mail.
- Failed email: `GET /api/admin/mail-failures`; retry an investigated item with `POST /api/admin/mail-failures/:id/retry` and an empty JSON object.

Alert when readiness fails for two checks, no worker cycle succeeds for two expected intervals, failed mail increases, availability requests are overdue, or financial holds remain unresolved. Logs contain event names and identifiers; private delivery fields and email bodies remain encrypted and are not logged.

## Backups and recovery

Create an encrypted-at-rest custom PostgreSQL dump:

```sh
BACKUP_DIR=./backups ./ops/backup.sh
```

Copy backups to storage separate from the database host and apply a retention policy approved by Fendor. Verify a backup without overwriting the active database:

```sh
./ops/restore-verify.sh ./backups/fendor-TIMESTAMP.dump
```

The verification script creates and destroys only a uniquely named `fendor_restore_check_*` database. A production launch requires a completed restore drill, recorded recovery time, and named ownership for daily backup checks.

## Production release gate

Before real customer data is accepted: merge the stacked pull requests in order, run CI on updated `main`, provision production secrets, configure real SMTP, replace staging Mailpit, complete a restore drill, connect frontend screens to the documented APIs, test customer/vendor/admin journeys on staging, and obtain business approval for reservation and vendor-response timings.
