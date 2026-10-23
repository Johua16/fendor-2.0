import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Database } from './database.ts';
export async function migrate(db: Database, directory: string) {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const files = (await readdir(directory)).filter(f => /^\d+.*\.sql$/.test(f)).sort();
  await db.transaction(async tx => {
    await tx.query('SELECT pg_advisory_xact_lock(46291001)');
    for (const name of files) {
      const source = await readFile(`${directory}/${name}`, 'utf8');
      const hash = createHash('sha256').update(source).digest('hex');
      const previous = (await tx.query<{ checksum: string }>('SELECT checksum FROM schema_migrations WHERE name=$1', [name])).rows[0];
      if (previous) { if (previous.checksum !== hash) throw Error(`Migration checksum changed: ${name}`); continue; }
      // Historical foundation has transaction markers; this runner owns the encompassing transaction.
      await tx.exec(source.replace(/^BEGIN;\s*$/gm, '').replace(/^COMMIT;\s*$/gm, ''));
      await tx.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, hash]);
    }
  });
}
export async function checkDatabase(db: Database) {
  const result = await db.query<{ name: string }>("SELECT name FROM schema_migrations WHERE name IN ('001-foundation.sql','002-identity.sql')");
  if (result.rows.length !== 2) throw Error('Pending migrations');
  await db.query('SELECT token_hash FROM sessions LIMIT 0');
}
