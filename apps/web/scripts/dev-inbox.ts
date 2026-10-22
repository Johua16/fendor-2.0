import { database } from '../src/lib/server/database.ts';
import { unseal } from '../src/lib/server/security.ts';
if (process.env.NODE_ENV === 'production') throw Error('Development inbox is disabled in production.');
const db = database();
try {
 const rows = await db.query<{ id: string; payload: string }>('SELECT id,payload FROM email_outbox WHERE sent_at IS NULL ORDER BY created_at DESC LIMIT 10');
 for (const r of rows.rows) console.log(JSON.stringify(unseal(r.payload, process.env.OUTBOX_KEY ?? '')));
} finally { await db.close(); }
