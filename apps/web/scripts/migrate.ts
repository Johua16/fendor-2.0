import { resolve } from 'node:path';
import { database } from '../src/lib/server/database.ts';
import { migrate } from '../src/lib/server/migrations.ts';
const db = database();
try { await migrate(db, resolve('../../server/db')); console.log('Database migrations applied.'); }
finally { await db.close(); }
