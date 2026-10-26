import assert from 'node:assert/strict';
import test from 'node:test';
import { accountDestination, signInDestination, AuthApiError, reviewSignupDestination, safeNext, signIn } from '../src/lib/client/auth.ts';

test('safeNext accepts only local application paths', () => {
  assert.equal(safeNext('/orders/123'), '/orders/123');
  assert.equal(safeNext('https://example.com'), '/account');
  assert.equal(safeNext('//example.com'), '/account');
  assert.equal(safeNext('/\\example.com'), '/account');
});

test('review signups continue into the correct onboarding journey', () => {
  assert.equal(reviewSignupDestination('customer'), '/');
  assert.equal(reviewSignupDestination('vendor'), '/vendor/onboarding');
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

test('server identity sends vendors, applicants and administrators to their own workspace', () => {
  const customer = { roles: ['customer'], onboardingIntent: 'customer' as const };
  const applicant = { roles: ['customer'], onboardingIntent: 'vendor' as const };
  const vendor = { roles: ['customer', 'vendor'], onboardingIntent: 'vendor' as const };
  assert.equal(accountDestination(customer), '/account');
  assert.equal(accountDestination(applicant), '/vendor/onboarding');
  assert.equal(accountDestination(vendor), '/vendor');
  assert.equal(accountDestination({ ...vendor, roles: ['customer', 'vendor', 'admin'] }), '/admin');
  assert.equal(signInDestination(vendor, null), '/vendor');
  assert.equal(signInDestination(vendor, '/account'), '/vendor');
  assert.equal(signInDestination(applicant, '/account'), '/vendor/onboarding');
  assert.equal(signInDestination(vendor, '/orders/123'), '/orders/123');
  assert.equal(signInDestination(vendor, '//evil.example'), '/vendor');
  assert.equal(signInDestination(customer, null), '/account');
});
