import { randomUUID } from 'node:crypto';
import type { Database, Sql } from './database.ts';
import { token, digest, hashPassword, checkPassword, seal } from './security.ts';
export class ApiError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export function fail(status: number, code: string, message: string): never { throw new ApiError(status, code, message); }
export function text(value: unknown, field: string, min = 1, max = 200): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) fail(400, 'INVALID_INPUT', `Check ${field}.`);
  return value.trim();
}
export function email(value: unknown) {
  const result = text(value, 'email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400, 'INVALID_INPUT', 'Check email.');
  return result;
}
function password(value: unknown) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) fail(400, 'INVALID_INPUT', 'Use a password of 12–128 characters.');
  return value;
}
export type User = { id: string; email: string; fullName: string; verified: boolean; roles: string[] };
type Config = { origin: string; outboxKey: string; now?: () => number };
const generic = { message: 'If eligible, an email will be sent with the next step.' };
export function identity(db: Database, config: Config) {
  const now = config.now ?? Date.now;
  const instant = () => new Date(now());
  async function limit(bucket: string, max = 5) {
    const result = await db.query<{ count: number }>(`INSERT INTO auth_limits(bucket,count,expires_at) VALUES($1,1,$2)
      ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN auth_limits.expires_at <= $3 THEN 1 ELSE auth_limits.count+1 END,
      expires_at=CASE WHEN auth_limits.expires_at <= $3 THEN $2 ELSE auth_limits.expires_at END RETURNING count`,
      [digest(bucket), new Date(now() + 15 * 60_000), instant()]);
    if (result.rows[0].count > max) fail(429, 'RATE_LIMITED', 'Too many attempts. Try again in 15 minutes.');
  }
  async function queue(tx: Sql, userId: string, address: string, purpose: 'verify' | 'reset') {
    const secret = token();
    await tx.query('DELETE FROM identity_tokens WHERE user_id=$1 AND purpose=$2', [userId, purpose]);
    await tx.query('INSERT INTO identity_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,$4)',
      [digest(secret), userId, purpose, new Date(now() + (purpose === 'verify' ? 24 : 1) * 3600_000)]);
    const pathname = purpose === 'verify' ? '/verify-email' : '/reset-password';
    // Fragment avoids leaking tokens in request logs. Frontend reads it and POSTs the token.
    const url = `${config.origin}${pathname}#token=${secret}`;
    await tx.query('INSERT INTO email_outbox(id,payload) VALUES($1,$2)', [randomUUID(), seal({ to: address, purpose, url }, config.outboxKey)]);
  }
  async function userFor(tx: Sql, id: string): Promise<User> {
    const u = (await tx.query<{ id: string; email: string; full_name: string; email_verified_at: Date | null }>('SELECT id,email,full_name,email_verified_at FROM users WHERE id=$1', [id])).rows[0];
    if (!u) fail(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    const roles = (await tx.query<{ role: string }>('SELECT role FROM user_roles WHERE user_id=$1 ORDER BY role', [id])).rows.map(r => r.role);
    return { id: u.id, email: u.email, fullName: u.full_name, verified: !!u.email_verified_at, roles };
  }
  async function session(tx: Sql, secret?: string): Promise<User> {
    if (!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret)) fail(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    const row = (await tx.query<{ user_id: string }>('SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>$2', [digest(secret), instant()])).rows[0];
    if (!row) fail(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    return userFor(tx, row.user_id);
  }
  function verified(u: User) { if (!u.verified) fail(403, 'EMAIL_UNVERIFIED', 'Verify your email first.'); }
  function admin(u: User) { verified(u); if (!u.roles.includes('admin')) fail(403, 'FORBIDDEN', 'Administrator access required.'); }
  return {
    throttleWrites: () => limit('account-writes-global', 1000),
    async signup(input: Record<string, unknown>) {
      const address = email(input.email), pass = password(input.password), name = text(input.fullName, 'full name', 2, 100);
      await limit(`email:${address}`); const encoded = await hashPassword(pass);
      await db.transaction(async tx => {
        const id = randomUUID();
        const result = await tx.query<{ id: string }>('INSERT INTO users(id,email,password_hash,full_name) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING RETURNING id', [id, address, encoded, name]);
        if (!result.rows.length) return;
        await tx.query("INSERT INTO user_roles(user_id,role) VALUES($1,'customer')", [id]);
        await queue(tx, id, address, 'verify');
      }); return generic;
    },
    async login(input: Record<string, unknown>) {
      const address = email(input.email);
      if (typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 128) fail(400, 'INVALID_INPUT', 'Check password.');
      const pass = input.password;
      await limit(`login:${address}`, 10);
      const row = (await db.query<{ id: string; password_hash: string }>('SELECT id,password_hash FROM users WHERE email=$1', [address])).rows[0];
      // Same expensive password work for an unknown account, with a fixed dummy hash.
      const ok = await checkPassword(pass, row?.password_hash ?? `scrypt$00000000000000000000000000000000$${'0'.repeat(128)}`);
      if (!row || !ok) fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
      const secret = token();
      const user = await db.transaction(async tx => {
        // Serialize password reset and session issuance for this user.
        const current = (await tx.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id=$1 FOR UPDATE', [row.id])).rows[0];
        if (current.password_hash !== row.password_hash) fail(401, 'INVALID_CREDENTIALS', 'Please sign in again.');
        await tx.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [digest(secret), row.id, new Date(now() + 7 * 86400_000)]);
        return userFor(tx, row.id);
      }); return { secret, user };
    },
    me: (secret?: string) => session(db, secret),
    async logout(secret?: string) { if (secret) await db.query('DELETE FROM sessions WHERE token_hash=$1', [digest(secret)]); },
    async requestEmail(input: Record<string, unknown>, purpose: 'verify' | 'reset') {
      const address = email(input.email); await limit(`email:${address}`);
      await db.transaction(async tx => {
        const row = (await tx.query<{ id: string; email_verified_at: Date | null }>('SELECT id,email_verified_at FROM users WHERE email=$1 FOR UPDATE', [address])).rows[0];
        if (row && (purpose === 'reset' || !row.email_verified_at)) await queue(tx, row.id, address, purpose);
      }); return generic;
    },
    async consume(input: Record<string, unknown>, purpose: 'verify' | 'reset') {
      const secret = text(input.token, 'token', 43, 43);
      await limit(`token:${digest(secret)}`);
      const encoded = purpose === 'reset' ? await hashPassword(password(input.password)) : undefined;
      await db.transaction(async tx => {
        const row = (await tx.query<{ user_id: string }>('DELETE FROM identity_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>$3 RETURNING user_id', [digest(secret), purpose, instant()])).rows[0];
        if (!row) fail(400, 'INVALID_TOKEN', 'This link is invalid or expired. Request a new one.');
        if (purpose === 'verify') await tx.query('UPDATE users SET email_verified_at=$2 WHERE id=$1', [row.user_id, instant()]);
        else {
          await tx.query('UPDATE users SET password_hash=$2 WHERE id=$1', [row.user_id, encoded]);
          await tx.query('DELETE FROM sessions WHERE user_id=$1', [row.user_id]);
        }
      }); return { message: purpose === 'verify' ? 'Email verified. Sign in to continue.' : 'Password updated. Sign in again.' };
    },
    async apply(secret: string | undefined, input: Record<string, unknown>) {
      const businessName = text(input.businessName, 'business name', 2, 160), location = text(input.businessLocation, 'business location', 5, 500);
      const country = text(input.country, 'country', 2, 2).toUpperCase();
      if (country !== 'NG') fail(400, 'UNSUPPORTED_COUNTRY', 'Vendor onboarding currently supports Nigeria.');
      const registration = text(input.registrationNumber, 'registration number', 1, 80);
      return db.transaction(async tx => {
        const u = await session(tx, secret); verified(u);
        await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [u.id]);
        const old = (await tx.query<{ id: string; status: string }>('SELECT id,status FROM vendor_applications WHERE user_id=$1', [u.id])).rows[0];
        if (old && !['draft', 'changes_requested'].includes(old.status)) fail(409, 'APPLICATION_EXISTS', 'Your existing application cannot be resubmitted in its current state.');
        const id = old?.id ?? randomUUID();
        const row = (await tx.query(`INSERT INTO vendor_applications(id,user_id,business_name,business_location,country,registration_number,status)
          VALUES($1,$2,$3,$4,$5,$6,'submitted') ON CONFLICT(user_id) DO UPDATE SET business_name=$3,business_location=$4,country=$5,registration_number=$6,status='submitted',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL RETURNING id,status`, [id, u.id, businessName, location, country, registration])).rows[0];
        await tx.query('INSERT INTO vendor_review_events(id,application_id,actor_id,from_status,to_status,note) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), id, u.id, old?.status ?? 'draft', 'submitted', 'Application submitted']);
        return row;
      });
    },
    async application(secret?: string) {
      const u = await session(db, secret);
      return (await db.query('SELECT id,business_name,business_location,country,registration_number,status,review_note FROM vendor_applications WHERE user_id=$1', [u.id])).rows[0] ?? null;
    },
    async vendorAccess(secret?: string) {
      const u = await session(db, secret); verified(u);
      const row = (await db.query<{ status: string }>('SELECT status FROM vendor_applications WHERE user_id=$1', [u.id])).rows[0];
      if (!u.roles.includes('vendor') || row?.status !== 'approved') fail(403, 'VENDOR_NOT_APPROVED', 'Approved vendor access required.');
      return { allowed: true, userId: u.id };
    },
    async applications(secret?: string) {
      admin(await session(db, secret));
      return (await db.query('SELECT id,business_name,business_location,country,registration_number,review_note,status,created_at FROM vendor_applications ORDER BY created_at DESC LIMIT 100')).rows;
    },
    async review(secret: string | undefined, id: string, input: Record<string, unknown>) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) fail(400, 'INVALID_INPUT', 'Invalid application ID.');
      const decision = text(input.decision, 'decision'), note = text(input.note, 'review note', 1, 1000);
      if (!['approved', 'rejected', 'changes_requested', 'suspended'].includes(decision)) fail(400, 'INVALID_INPUT', 'Invalid decision.');
      return db.transaction(async tx => {
        const u = await session(tx, secret); admin(u);
        const old = (await tx.query<{ user_id: string; status: string }>('SELECT user_id,status FROM vendor_applications WHERE id=$1 FOR UPDATE', [id])).rows[0];
        if (!old) fail(404, 'NOT_FOUND', 'Application not found.');
        if (u.id === old.user_id) fail(403, 'SELF_REVIEW', 'You cannot review your own application.');
        const valid = decision === 'suspended' ? old.status === 'approved' : old.status === 'submitted';
        if (!valid) fail(409, 'INVALID_STATE', 'This decision is not allowed in the current state.');
        await tx.query('UPDATE vendor_applications SET status=$2,reviewed_by=$3,reviewed_at=$4,review_note=$5 WHERE id=$1', [id, decision, u.id, instant(), note]);
        if (decision === 'approved') await tx.query("INSERT INTO user_roles(user_id,role) VALUES($1,'vendor') ON CONFLICT DO NOTHING", [old.user_id]);
        else await tx.query("DELETE FROM user_roles WHERE user_id=$1 AND role='vendor'", [old.user_id]);
        await tx.query('INSERT INTO vendor_review_events(id,application_id,actor_id,from_status,to_status,note) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), id, u.id, old.status, decision, note]);
        return { id, status: decision };
      });
    }
  };
}
