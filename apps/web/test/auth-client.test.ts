import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthApiError, safeNext, signIn } from '../src/lib/client/auth.ts';

test('safeNext accepts only local application paths', () => {
  assert.equal(safeNext('/orders/123'), '/orders/123');
  assert.equal(safeNext('https://example.com'), '/account');
  assert.equal(safeNext('//example.com'), '/account');
  assert.equal(safeNext('/\\example.com'), '/account');
});

test('sign in uses the protected session endpoint and preserves API errors', async () => {
  const originalFetch = globalThis.fetch;
  let body = '';
  globalThis.fetch = async (_input, init) => { body = String(init?.body); return Response.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } }, { status: 401 }); };
  try {
    await assert.rejects(() => signIn('customer@example.com', 'wrong'), (error: unknown) => error instanceof AuthApiError && error.status === 401 && error.code === 'INVALID_CREDENTIALS');
    assert.deepEqual(JSON.parse(body), { email: 'customer@example.com', password: 'wrong' });
  } finally { globalThis.fetch = originalFetch; }
});
