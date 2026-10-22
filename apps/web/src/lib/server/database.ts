import { Pool } from 'pg';
export interface Sql {
  query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
  exec(text: string): Promise<unknown>;
}
export interface Database extends Sql {
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export function postgres(connectionString: string, options?: string): Database {
  const pool = new Pool({ connectionString, options, max: 5, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
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
export function database(): Database {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  return cached ??= postgres(process.env.DATABASE_URL);
}
