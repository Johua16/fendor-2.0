import { Pool, type PoolConfig } from 'pg';
import { getCloudflareContext } from '@opennextjs/cloudflare';
export interface Sql {
  query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
  exec(text: string): Promise<unknown>;
}
export interface Database extends Sql {
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
function verifiedSsl() {
  const encoded = process.env.DATABASE_SSL_CA_BASE64?.trim();
  if (!encoded) return undefined;
  const ca = Buffer.from(encoded, 'base64').toString('utf8');
  if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
    throw new Error('DATABASE_SSL_CA_BASE64 must contain a base64-encoded PEM certificate.');
  }
  return { ca, rejectUnauthorized: true };
}
export function postgresPoolConfig(connectionString: string, options?: string): PoolConfig {
  const ssl = verifiedSsl();
  let effectiveConnectionString = connectionString;
  if (ssl) {
    const url = new URL(connectionString);
    for (const parameter of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) {
      url.searchParams.delete(parameter);
    }
    effectiveConnectionString = url.toString();
  }
  return {
    connectionString: effectiveConnectionString,
    options,
    ssl,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    maxLifetimeSeconds: 300,
    statement_timeout: 10000,
    query_timeout: 12000,
  };
}
export function postgres(connectionString: string, options?: string): Database {
  const pool = new Pool(postgresPoolConfig(connectionString, options));
  pool.on('error', () => console.error('Database connection interrupted.'));
  return {
    query: async <T extends Record<string, unknown>>(q: string, values?: unknown[]) => ({ rows: (await pool.query<T>(q, values)).rows }),
    exec: (q) => pool.query(q),
    async transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: async <R extends Record<string, unknown>>(q: string, values?: unknown[]) => ({ rows: (await client.query<R>(q, values)).rows }), exec: q => client.query(q) });
        await client.query('COMMIT'); return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end()
  };
}
let cached: Database | undefined;

/**
 * Resolves the database endpoint without making a browser-visible secret part
 * of the Worker configuration.  Local development, scripts and the existing
 * hosts continue to use DATABASE_URL.  The Cloudflare pilot deliberately
 * requires a Hyperdrive binding instead of falling back to a public RDS URL.
 */
function connectionString(): string {
  const provider = process.env.DATABASE_PROVIDER?.trim();
  if (provider === 'cloudflare_hyperdrive') {
    try {
      const context = getCloudflareContext();
      const hyperdrive = (context.env as { HYPERDRIVE?: { connectionString?: unknown } }).HYPERDRIVE;
      if (typeof hyperdrive?.connectionString === 'string' && hyperdrive.connectionString) {
        return hyperdrive.connectionString;
      }
    } catch {
      // A missing Worker request context is handled by the safe error below.
    }
    throw new Error('Cloudflare Hyperdrive is required when DATABASE_PROVIDER=cloudflare_hyperdrive.');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  return process.env.DATABASE_URL;
}

export function database(): Database {
  return cached ??= postgres(connectionString());
}
