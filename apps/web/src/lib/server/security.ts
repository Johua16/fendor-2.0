import { randomBytes, createHash, scrypt, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
export const token = () => randomBytes(32).toString('base64url');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
async function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function checkPassword(password: string, encoded: string) {
  const [algorithm, salt, hash] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(hash, 'hex'));
}
function encryptionKey(key: string) {
  if (!/^[a-f0-9]{64}$/i.test(key)) throw Error('OUTBOX_KEY must be 32 random bytes encoded as hex.');
  return Buffer.from(key, 'hex');
}
export function seal(value: unknown, key: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64url')).join('.');
}
export function unseal(value: string, key: string): unknown {
  const [iv, tag, data] = value.split('.').map(s => Buffer.from(s, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key), iv); decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
}
