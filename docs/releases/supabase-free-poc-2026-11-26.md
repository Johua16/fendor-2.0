# Supabase Free PostgreSQL proof of concept

Date: 26 November 2026

Scope: isolated `fendora-supabase-poc` project only

Decision: **GO for a limited non-production pilot; NO-GO for an immediate production cutover**

## Safety boundary

- Neon production, Netlify production, production environment variables, payment settings, and nameservers were not changed.
- `PUBLIC_CHECKOUT_ENABLED=false` was required by the load-test script and remained false throughout.
- No live payment was initiated.
- The approved 9 November 2026 backup was restored only into the isolated Supabase project.
- Supabase secrets and backup contents remain in Git-ignored, mode-`0600` local files. No credential is present in this report or Git.

## Project and connection model

- Supabase project: `fendora-supabase-poc` (`eu-west-1`, Free/Nano, no card added).
- Data API was disabled when the project was created.
- Application traffic used Supavisor transaction pooling on port `6543`.
- Administrative operations and migrations used session pooling on port `5432`.
- The direct database hostname is IPv6-only and was not reachable from this Mac; this is not a database authentication failure.
- TLS 1.3 was verified with the Supabase 2021 CA pinned through `NODE_EXTRA_CA_CERTS`.
- The application connection uses a dedicated least-privilege `fendora_poc_app` role. It can perform application DML but cannot create tables, databases, or roles.

## Restore and migration validation

Source backup:

- File: `backups/production/fendora-production-20261109T200238Z.dump`
- SHA-256: `bb840b15aa4fcac3b4fabaac35a6c569ec16867d7348b93b063a5e798246158a`
- PostgreSQL archive version: 18

The approved archive restored into the isolated Supabase `public` schema with ownership and ACLs omitted. Provider-managed schemas were not modified. The restored starting state contained migrations `001`–`008`, 29 application tables, 7 users, and no products, order requests, or payments.

Migrations were applied in order:

1. `009`–`011` through the repository migration runner.
2. `012` with reviewed SHA-256 `376402aba8aacef0d9fd3377545da8ba273005244f3ee2ee24bc1910d0c77dda`.
3. `013` with reviewed SHA-256 `411a656411a5fcac72faa7af403f3e984b390fa7011f722eb3876ba0eba16ea5`.

Final database integrity:

| Check | Result |
| --- | ---: |
| Applied migrations | 13 |
| Application tables | 32 |
| Foreign keys | 48 |
| Indexes | 69 |
| Unique constraints | 19 |
| Restored users | 7 |
| Products | 0 |
| Order requests | 0 |
| Payment records | 0 |

Transaction-pool compatibility passed for transactions, transaction-scoped advisory locks, prepared statements within a transaction, and rollback. Application code must not rely on session state when using the transaction pooler.

## Security findings and remediation

Restoring application tables created 448 table/schema/function/sequence grants for Supabase `anon` and `authenticated` roles, despite the Data API being disabled. Those grants were revoked, matching default privileges were revoked, and a dedicated application role was installed. A post-remediation audit found zero remaining grants to `anon` or `authenticated`. The application role's DDL-denial test passed.

The project's database network restriction currently permits all source IPs. Authentication, TLS, least privilege, and the disabled Data API reduce exposure, but this remains a production cutover blocker. A single `/32` rule is not suitable for Netlify's dynamic outbound addresses; the production design needs a stable egress path, a supported integration, or an explicitly accepted network policy.

## Application tests

The representative database-backed suite was run serially through the 15-connection session pool to avoid turning test-schema DDL into an artificial connection storm.

- Tests: 41
- Passed: 41
- Failed: 0
- Duration: about 17 minutes

Covered behaviour included identity and vendor lifecycle, catalogue moderation, reservations and oversell protection, quote invalidation, checkout, hosted online-payment verification, webhook authentication, late and mismatched funds, refunds, delivery, support isolation, durable notifications, email retry/deduplication, and administrator controls.

An earlier fully parallel remote run passed 62 of 79 tests and failed 17 while creating/migrating many test schemas concurrently. Every failure was a connection-capacity error rather than a product assertion. This demonstrates that schema-heavy CI must remain local or run serially; it does not represent the transaction-pooled application workload.

Final repository validation:

- `npm run typecheck --prefix apps/web`: passed.
- `PUBLIC_CHECKOUT_ENABLED=false npm test --prefix apps/web`: 79/79 passed.
- `PUBLIC_CHECKOUT_ENABLED=false npm run build --prefix apps/web`: passed; all 44 static pages generated.

## Load test

The Supabase test modelled five application connections per warm Netlify instance and performed a representative transaction containing a rate-limit write, catalogue/order/mail reads, cleanup, and commit.

| Concurrency | Attempts | Success | Average | p95 |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 3 | 100% | 1,066.38 ms | 1,732.13 ms |
| 5 | 15 | 100% | 1,147.75 ms | 1,556.32 ms |
| 10 | 30 | 100% | 1,221.47 ms | 2,115.19 ms |
| 20 | 60 | 100% | 1,310.63 ms | 2,589.34 ms |
| 50 | 150 | 100% | 1,908.91 ms | 3,221.53 ms |

An extended 5-concurrent run completed 150/150 operations (100%), averaging 1,296.74 ms with 2,028.34 ms p95. Supavisor did not propagate the client `application_name` to `pg_stat_activity`, so backend-connection utilization could not be measured from that view and is reported as unavailable rather than zero.

For comparison, the same Aiven POC workload succeeded at 100% for concurrency 1, 5, and 10, then 65% at 20 and 28% at 50. Supabase was materially more reliable under this workload. No equivalent Neon load measurement is available.

## Backup and recovery

The app-only post-migration custom archive is Git-ignored and mode `0600`:

- `backups/supabase-poc/fendora-supabase-poc-post-migrations-20261126.dump`
- SHA-256: `dc1780da16dab00701da5c34cb760e4cecc88a8d32e45f14d7b56f0fe2d6a7d7`

Its AES-256-CBC/PBKDF2 encrypted copy has SHA-256:

- `628f003e750deedf30c40e58865ac9c81ed8b28f3734f52038728dfcec0112e6`

The raw Supabase archive includes 260 provider-specific `pg_attver` attributes. Supabase-compatible restore can consume them, but stock PostgreSQL 18 rejects them. A portable SQL recovery artifact was therefore generated with only those provider metadata lines removed, with owner and ACL commands omitted, and encrypted:

- `backups/supabase-poc/fendora-supabase-poc-portable-20261126.sql.enc`
- Encrypted SHA-256: `d5e4417cde52efad6b0acc33a23d68c17d9c41dde0efe0af3f9b47ccfbf55c47`
- Plaintext SHA-256 before encryption: `e1ecdad6740fb7ccd5ce184b1350833903cf61277cc3587a75d9400f24ce75f4`

The portable artifact restored successfully into a localhost-only stock PostgreSQL 18 cluster. Migration count, table count, constraints, indexes, and application record counts matched the source. A transactional write/rollback probe left no residue. The temporary database server was stopped after verification.

The earlier `pre-migrations-20261125.dump` captured provider-managed schemas (`auth`, `storage`, `realtime`, and others) and must **not** be used as the application recovery artifact. It is retained locally for audit only.

## Cost and operating constraints

- Current POC cost: `$0/month`; no card was added.
- Free projects may pause after inactivity and do not provide the same managed backup/PITR guarantees as paid production plans.
- Free compute, disk, and connection capacity are shared and constrained. The restored dataset is tiny, so present storage is not a limiting factor.
- A production launch would require scheduled encrypted off-platform backups, restore drills, quota/connection alerting, and an agreed response to Free-plan pausing and network exposure.

## Decision and next steps

**GO** for a limited internal/vendor pilot on Supabase Free after application configuration is reviewed in a separate release step. The schema, migrations, core workflows, transaction pooler, and portable recovery path are compatible.

**NO-GO** for replacing Neon production immediately. Before a production cutover:

1. Decide and document the database network-access model for Netlify.
2. Automate the app-only portable backup conversion, encryption, off-device storage, and restore verification.
3. Add quota, connection, database availability, and backup-age monitoring.
4. Make `sslmode=verify-full` explicit before the next major `pg`/`pg-connection-string` upgrade.
5. Run a rehearsed cutover from a fresh production backup, including record-count and application smoke checks.
6. Obtain separate approval before changing any production environment variable or database.
