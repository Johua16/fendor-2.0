# Aiven Free PostgreSQL proof of concept — 25 November 2026

## Decision

**NO-GO for Fendora production.** The Aiven Free service is compatible with the
Fendora schema and is suitable for isolated development or a small staging
environment, but its connection ceiling, latency, dynamic-IP access problem,
automatic power-off, and recovery limitations are not acceptable for the
public marketplace.

This proof of concept did not modify Neon, Netlify, payment settings, or any
production environment variable. `PUBLIC_CHECKOUT_ENABLED=false` was required
for every application test.

## Isolated service

- Project: `fendora-aiven-poc`
- Service: `fendora-poc-pg`
- PostgreSQL: 18.7
- Plan: Free-1-1gb, single node, 1 CPU, 1 GB RAM, 1 GB storage
- Region/provider: DigitalOcean Amsterdam
- Service connection limit: 20; observed application ceiling: 14
- Network: public endpoint restricted to one explicitly approved `/32` rule
- TLS: TLS 1.3 with hostname verification and the Aiven CA pinned locally
- Application role: `fendora_poc_app`, DML-only; DDL is rejected
- Secrets and CA material: Git-ignored local files, mode `0600`

The Mac's public IP changed twice during testing. The allowlist correctly
blocked connections each time. This proves the restriction works, but also
shows that a dynamic developer IP is operationally unsuitable and that a
static egress design is required before any production use.

## Data and migrations

The 9 November 2026 backup was restored only to the isolated Aiven service.
Its source checksum was:

`bb840b15aa4fcac3b4fabaac35a6c569ec16867d7348b93b063a5e798246158a`

The restored source contained 7 users, no products, orders, or payments, and
migrations 001–008. Migrations 009–011 were applied with the repository runner.
Migrations 012 and 013 were then applied in that order in one controlled
transaction and recorded in `schema_migrations`.

- Migration 012 checksum:
  `376402aba8aacef0d9fd3377545da8ba273005244f3ee2ee24bc1910d0c77dda`
- Migration 013 checksum:
  `411a656411a5fcac72faa7af403f3e984b390fa7011f722eb3876ba0eba16ea5`
- Final schema: 13 migrations, 32 public tables, 48 foreign keys, 69 indexes

No PostgreSQL extensions other than `plpgsql` are required. No Neon-specific
SQL was found.

## Backup and recovery

Before migration, a valid custom-format PostgreSQL 18 backup was created:

- `backups/aiven-poc/pre-migrations-20261125.dump`
- SHA-256:
  `fc9d61cdb7962193b5b775f1d8f5e6c54c37cabccb6dc60a8bd0f3c0d9463fb3`

After migration, another valid custom-format backup was created:

- `backups/aiven-poc/post-migrations-20261125.dump`
- Size: 684,857 bytes
- SHA-256:
  `e1b796609e2228ab180180fadabad394f15a160ff9a56f1b2a521745c8f2c3c1`

The post-migration backup was restored to the separately named temporary
database `fendora_restore_check_20261125`. Verification found 13 migrations,
32 tables, and 7 users. A write-and-rollback integrity test left zero rows.
Only that temporary restore database was then removed. The dump remains
recoverable and mode `0600` in the Git-ignored backup directory.

Aiven Free advertises disaster-recovery backups, not normal point-in-time
recovery or production HA. This remains a production blocker even though the
logical restore drill passed.

## Functional and load results

The complete local application suite remains the correctness baseline and
passed before the remote exercise (79/79). The selected real-PostgreSQL remote
suite ran 41 scenarios:

- 23 passed before the Mac's public IP rotated.
- 18 then failed at the five-second connection deadline.
- Failures were connection termination/timeouts, not assertion mismatches.
- Passing remote cases took roughly 13–59 seconds because each test creates an
  isolated schema and reapplies migrations on the constrained remote service.

The corrected representative transaction test simulated separate serverless
instances, each using Fendora's current five-connection pool:

| Concurrent workflows | Success | Average | p95 | Peak app connections |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 100% | 1,954 ms | 1,954 ms | 1 |
| 5 | 100% | 1,757 ms | 1,792 ms | 5 |
| 10 | 100% | 2,241 ms | 2,600 ms | 10 |
| 20 | 65% | 2,478 ms | 2,608 ms | 13 |
| 50 | 28% | 2,278 ms | 2,577 ms | 14 |

At 20 and 50 workflows PostgreSQL returned `too many clients` and reserved-slot
errors. A Netlify deployment can create multiple five-connection pools; only
three warm instances could consume 15 connections, already beyond the observed
14-connection application allowance. The free plan also provides no managed
connection pooler.

## Security results

- Non-TLS connections were rejected.
- TLS 1.3 and the pinned provider CA were verified.
- The application role can read and perform required DML but cannot create
  tables.
- A parameterized malicious value was stored inside a rolled-back transaction;
  the `users` table remained intact.
- Rollback behavior was verified both in the live POC and restored database.
- Connection strings and passwords were not printed or committed.
- Aiven remained restricted to a single `/32`; it was never open to all IPs.

## Why the Neon quota likely grew

The available evidence showed Neon usage above its free compute-hour allowance.
The most plausible cause is periodic application/worker activity waking the
database, combined with multiple serverless connection pools preventing rapid
autosuspension. This is an inference, not a proven billing attribution; Neon
usage metrics must be checked before changing providers.

## Recommendation

Keep the Aiven service only as an isolated POC or temporary staging database.
Do not point Netlify or production at it. For launch, use a managed PostgreSQL
plan with:

1. enough pooled/serverless connections for Netlify concurrency;
2. predictable availability without automatic idle shutdown;
3. point-in-time recovery and a documented retention window;
4. static/private network options or a secure pooler;
5. monitoring and an SLA appropriate for payments and fulfilment.

Before any future migration, repeat the same order: fresh production backup,
isolated restore, migration rehearsal, record-count reconciliation, controlled
cutover, and retained rollback snapshot. Live checkout must remain disabled
until the database and payment release are separately approved.
