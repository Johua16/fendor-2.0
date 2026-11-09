# PR #35 production database migration plan

Status: prepared only. Do not run against production until the release owner gives separate approval.

## Scope and compatibility

PR #35 requires migrations 009–011. The application migration runner applies numbered files once, records a SHA-256 checksum in `schema_migrations`, and holds a PostgreSQL advisory lock inside one transaction.

| Migration | Change | Compatibility with the current production application | SHA-256 |
| --- | --- | --- | --- |
| `009-online-payments.sql` | Adds hosted-payment attempts and provider evidence fields | Additive. Existing offline-payment reads and writes remain valid. | `b2197834276771f5fb50ebd8c0c967751efcf743d7f19c8d7f8cfeda7032121a` |
| `010-standard-pricing.sql` | Adds nullable delivery-zone fees and packaging options | Additive. Existing zones remain valid and are not assigned invented fees. | `efa84464aeaaacecac1dd3c695df03578ac1e3b1d07b022404c90c6d93695068` |
| `011-delivery-scheduling.sql` | Makes the customer delivery date optional | Backwards compatible. Existing dates are retained. | `0866878380fa6b3cc361d68c3d1800ab36e4b7dc00c9679e1b83b805836d7a4d` |

The release keeps `PUBLIC_CHECKOUT_ENABLED=false`, so applying migration 009 cannot open public checkout. Migration 010 does not seed prices. Approved packaging options and delivery-zone fees must be entered separately through an authorised operational process.

## Required release order

1. Confirm the production database host, database name, release operator and rollback owner.
2. Put the production connection string in the operator's temporary environment only. Never paste it into Git, chat, logs or Netlify build output.
3. Record the current deployed commit and Netlify deploy identifier.
4. Check current migration state:

   ```sql
   SELECT name, checksum, applied_at
   FROM schema_migrations
   ORDER BY name;
   ```

5. Create a custom-format backup with `ops/backup.sh`. Confirm the dump is non-empty, record its SHA-256 digest, size, UTC time and storage location, then copy it to encrypted storage outside the database provider.
6. Run `ops/restore-verify.sh <dump>` against an isolated PostgreSQL environment. It must create a temporary `fendor_restore_check_*` database, restore without errors, report counts for migrations, users and orders, and delete only the temporary database.
7. Record the restore duration and the three reported row counts. A backup is not considered verified until this restore drill passes.
8. Run `npm run db:migrate --prefix apps/web` once with the production `DATABASE_URL` loaded.
9. Confirm 009–011 appear exactly once with the checksums above. Confirm `/api/ready` returns 200 on the release candidate.
10. Verify `PUBLIC_CHECKOUT_ENABLED=false`, `ALLOW_SANDBOX_PAYMENTS=false` and `BETA_REVIEW_MODE=false` before merging PR #35.
11. Merge only after the deployment preview, CI, backup/restore evidence and migration checks are approved. Main currently publishes automatically to Netlify.
12. After deployment, verify the anonymous homepage, catalogue empty state or approved products, policies, `robots.txt`, `sitemap.xml`, `/api/health` and `/api/ready`.

## Backup and restore evidence record

Complete this immediately before the authorised release:

| Evidence | Required value |
| --- | --- |
| Backup filename | Pending production approval |
| Backup SHA-256 | Pending production approval |
| Backup size and UTC timestamp | Pending production approval |
| Off-host encrypted copy | Pending production approval |
| Restore target | Isolated temporary PostgreSQL database |
| Restore result and duration | Pending production approval |
| Migration/user/order counts | Pending production approval |
| Operator and reviewer | Pending production approval |

The backup and restore scripts pass shell syntax validation in this branch. A real restore test has deliberately not been claimed: this workspace has no authorised production dump or running staging PostgreSQL target.

## Rollback

- If migration fails, the migration transaction rolls back. Stop the release, preserve logs without secrets and do not deploy the new application.
- If the application deploy fails after migrations succeed, restore the previous Netlify deploy. Migrations 009–011 are backwards compatible with the previous application, so a database restore is not normally required.
- Restore the database only for confirmed data corruption, using the verified dump and a named incident owner. Never restore over the live database without a second-person review.
- Keep checkout disabled throughout rollback. Payment provider credentials alone must not make checkout available.

## Hard release blockers

- No successful production backup and isolated restore evidence.
- Migration checksums differ from this plan.
- CI or Netlify Deploy Preview fails.
- `PUBLIC_CHECKOUT_ENABLED` is missing or not exactly `false` in production.
- Anonymous visitors cannot load the homepage and policies.
- Public catalogue contains an unapproved listing.
