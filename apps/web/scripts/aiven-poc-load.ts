import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const appUrl = process.env.AIVEN_POC_APP_DATABASE_URL;
const adminUrl = process.env.AIVEN_POC_DATABASE_URL;

if (!appUrl || !adminUrl) {
  throw new Error('AIVEN_POC_APP_DATABASE_URL and AIVEN_POC_DATABASE_URL are required.');
}

for (const [name, value] of [['app', appUrl], ['admin', adminUrl]] as const) {
  const host = new URL(value).hostname;
  if (!host.endsWith('.aivencloud.com')) {
    throw new Error(`Refusing to run: ${name} database is not an Aiven host.`);
  }
}

if (process.env.PUBLIC_CHECKOUT_ENABLED !== 'false') {
  throw new Error('Refusing to run unless PUBLIC_CHECKOUT_ENABLED=false.');
}

const concurrencyLevels = [1, 5, 10, 20, 50];
const iterations = Number.parseInt(process.env.AIVEN_POC_ITERATIONS ?? '3', 10);
const results: Array<Record<string, number>> = [];

function percentile(samples: number[], proportion: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * proportion) - 1)] ?? 0;
}

async function representativeWorkflow(pool: Pool, scenario: number, iteration: number, worker: number): Promise<number> {
  const started = performance.now();
  const client = await pool.connect();
  const bucket = `aiven-poc-load:${scenario}:${iteration}:${worker}:${randomUUID()}`;
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO auth_limits(bucket, count, expires_at)
       VALUES ($1, 1, now() + interval '5 minutes')
       ON CONFLICT(bucket) DO UPDATE SET count = auth_limits.count + 1`,
      [bucket],
    );
    await client.query(
      `SELECT
         (SELECT count(*) FROM products WHERE status = 'approved') AS approved_products,
         (SELECT count(*) FROM order_requests WHERE state NOT IN ('delivered', 'cancelled', 'unavailable')) AS active_orders,
         (SELECT count(*) FROM email_outbox WHERE sent_at IS NULL) AS pending_email`,
    );
    await client.query('DELETE FROM auth_limits WHERE bucket = $1', [bucket]);
    await client.query('COMMIT');
    return performance.now() - started;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

for (const concurrency of concurrencyLevels) {
  // Each pool represents a separate serverless application instance. Fendora's
  // production pool is capped at five connections per instance.
  const poolCount = Math.ceil(concurrency / 5);
  const pools = Array.from({ length: poolCount }, (_, index) => new Pool({
    connectionString: appUrl,
    max: 5,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    application_name: `fendora-aiven-poc-${concurrency}-${index}`,
  }));
  const monitor = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 5000 });
  const samples: number[] = [];
  let successes = 0;
  let failures = 0;
  let maxObservedConnections = 0;
  const failureMessages = new Set<string>();
  let monitoring = true;
  const monitorLoop = (async () => {
    while (monitoring) {
      try {
        const observed = await monitor.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM pg_stat_activity
           WHERE application_name LIKE 'fendora-aiven-poc-%'`,
        );
        maxObservedConnections = Math.max(maxObservedConnections, Number(observed.rows[0]?.count ?? 0));
      } catch {
        // The workload result records connection failures separately. Monitoring
        // must not make the test itself fail during deliberate saturation.
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  })();

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const batch = Array.from({ length: concurrency }, (_, worker) =>
      representativeWorkflow(pools[worker % pools.length]!, concurrency, iteration, worker));
    const settled = await Promise.allSettled(batch);
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        successes += 1;
        samples.push(result.value);
      } else {
        failures += 1;
        const reason = result.reason;
        failureMessages.add(reason instanceof Error ? reason.message : 'Unknown failure');
      }
    }
  }

  monitoring = false;
  await monitorLoop;
  await Promise.all(pools.map(pool => pool.end()));
  await monitor.end();

  const attempted = successes + failures;
  results.push({
    concurrency,
    attempted,
    successes,
    failures,
    successPercent: Number(((successes / attempted) * 100).toFixed(2)),
    averageMs: Number((samples.reduce((total, value) => total + value, 0) / Math.max(samples.length, 1)).toFixed(2)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(2)),
    maxObservedConnections,
  });
  if (failureMessages.size > 0) {
    console.error(JSON.stringify({ concurrency, failures: [...failureMessages].slice(0, 3) }));
  }
}

console.table(results);
if (results.some(result => result.failures > 0)) process.exitCode = 2;
