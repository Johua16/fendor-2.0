import { database } from '../src/lib/server/database.ts';
const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw Error('Usage: npm run admin:grant -- verified-email');
const db = database();
try {
 const result = await db.query("INSERT INTO user_roles(user_id,role) SELECT id,'admin' FROM users WHERE email=$1 AND email_verified_at IS NOT NULL ON CONFLICT DO NOTHING RETURNING user_id", [email]);
 if (!result.rows.length) throw Error('No newly granted role. Account must exist and be verified, or is already admin.');
 console.log('Administrator role granted to the verified account.');
} finally { await db.close(); }
