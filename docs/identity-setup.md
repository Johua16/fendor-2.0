# Running the identity backend

Requires Node 24, PostgreSQL 17, and the existing Next.js app. Legacy accounts are not imported.

1. Run `docker compose up -d` from the repository root (requires Docker), or provision PostgreSQL separately.
2. Copy `apps/web/.env.example` to `apps/web/.env.local`. Set DATABASE_URL and APP_ORIGIN to the exact browser origin (no trailing slash). Generate OUTBOX_KEY using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep it secret and stable. Never commit .env.local.
3. Run `npm ci --prefix apps/web`, then from apps/web run `npm run db:migrate` and `npm run dev`.
4. Register using the API. For local development only, `npm run mail:preview` displays verification/reset links. These links are credentials: do not share logs. Frontend token pages must be built before email links provide a usable browser journey.
5. After verifying an operator's account, run `npm run admin:grant -- operator@example.com` from apps/web. No public endpoint grants admins.
6. Configure SMTP_URL and MAIL_FROM; run `npm run mail:send` from apps/web to process up to 50 queued messages. Schedule this command through deployment infrastructure. Nothing in this PR creates that scheduler or sends live email. Production SMTP must use TLS (smtps or a provider enforcing STARTTLS). Monitor failures and unsent rows with attempts >=5; investigate before manually resetting attempts.

The outbox is encrypted at rest; tokens and session secrets are stored as hashes. Successfully sent payloads are erased. SMTP delivery is at-least-once: a crash after delivery but before transaction commit can cause a duplicate email. Retrying the link is safe because tokens are single-use. Losing OUTBOX_KEY makes queued messages unreadable; rotate deliberately and reissue outstanding links.

The full operations increment also requires `RESERVATION_MINUTES` and `VENDOR_RESPONSE_MINUTES` (agreed integer durations of 1–1,440 minutes) plus the continuously running `npm run worker -- --loop` process; see the orders and operations API handoffs.

Health only confirms app execution. Readiness verifies configuration, reservation policy and migrated database, not email delivery or full marketplace readiness. An unset database returns 503 rather than fake success. Production requires HTTPS APP_ORIGIN, managed secrets, TLS database connections, backups, a monitored mail worker, and edge/IP abuse protection. Database email/global rate limits are basic protection, not a substitute for edge controls. Add scheduled cleanup for expired sessions/tokens/rate-limit rows as part of deployment operations.

Tests use embedded PostgreSQL locally; CI uses PostgreSQL 17 through the production connection adapter. TEST_DATABASE_URL must point to a disposable empty test database; tests use isolated temporary schemas and clean those schemas after each test. No production database should be used for tests.
