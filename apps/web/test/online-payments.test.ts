import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { configuredProviders, createProviderCheckout, verifyProviderPayment, verifyWebhook } from '../src/lib/server/payment-providers.ts';
import { onlinePayments } from '../src/lib/server/online-payments.ts';
import { checkout } from '../src/lib/server/checkout.ts';
import { fixture } from './order-fixture.ts';

const origin = 'http://localhost:3000';
const quote = { packagingKobo: 1000, deliveryKobo: 2000, fulfilmentChecked: true, fulfilmentPlan: 'Standard gift box, Abuja delivery and route checked.' };
const originalFetch = globalThis.fetch;
const envNames = ['ALLOW_SANDBOX_PAYMENTS','PAYSTACK_SECRET_KEY','PAYSTACK_WEBHOOK_SECRET','FLUTTERWAVE_SECRET_KEY','FLUTTERWAVE_WEBHOOK_SECRET_HASH','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_CURRENCY','PAYPAL_NGN_PER_UNIT','PAYPAL_API_ORIGIN','PAYPAL_WEBHOOK_ID'] as const;
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const originalNodeEnv = process.env.NODE_ENV;
function response(value: unknown) { return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } }); }
function setNodeEnv(value: string | undefined) { if (value === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV'); else Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, enumerable: true, value, writable: true }); }
function restore() { globalThis.fetch = originalFetch; setNodeEnv(originalNodeEnv); for (const name of envNames) { const value = originalEnv[name]; if (value === undefined) delete process.env[name]; else process.env[name] = value; } }

test('public production checkout hides sandbox providers until live credentials are approved', { concurrency: false }, () => {
  setNodeEnv('production');
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_public_beta';
  process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-public-beta-X';
  process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH = 'flutterwave-hook';
  process.env.PAYPAL_CLIENT_ID = 'sandbox-client';
  process.env.PAYPAL_CLIENT_SECRET = 'sandbox-secret';
  process.env.PAYPAL_CURRENCY = 'USD';
  process.env.PAYPAL_NGN_PER_UNIT = '1600';
  process.env.PAYPAL_WEBHOOK_ID = 'sandbox-webhook';
  process.env.PAYPAL_API_ORIGIN = 'https://api-m.sandbox.paypal.com';
  try {
    assert.deepEqual(configuredProviders(), []);
    process.env.ALLOW_SANDBOX_PAYMENTS = 'true';
    assert.deepEqual(configuredProviders(), ['paystack', 'flutterwave', 'paypal']);
    delete process.env.ALLOW_SANDBOX_PAYMENTS;
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_approved';
    process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK-approved-X';
    process.env.PAYPAL_API_ORIGIN = 'https://api-m.paypal.com';
    assert.deepEqual(configuredProviders(), ['paystack', 'flutterwave', 'paypal']);
  } finally { restore(); }
});

test('Paystack, Flutterwave and PayPal use server-created hosted checkout and provider verification', { concurrency: false }, async () => {
  process.env.PAYSTACK_SECRET_KEY = 'paystack-test'; process.env.FLUTTERWAVE_SECRET_KEY = 'flutterwave-test'; process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH = 'flutterwave-hook'; process.env.PAYPAL_CLIENT_ID = 'paypal-id'; process.env.PAYPAL_CLIENT_SECRET = 'paypal-secret'; process.env.PAYPAL_CURRENCY = 'USD'; process.env.PAYPAL_NGN_PER_UNIT = '1600'; process.env.PAYPAL_API_ORIGIN = 'https://paypal.test';
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url.endsWith('/transaction/initialize')) { const sent = JSON.parse(String(init?.body)); assert.equal(sent.amount, 160000); assert.equal(sent.currency, 'NGN'); return response({ data: { authorization_url: 'https://paystack.test/pay' } }); }
    if (url.includes('/transaction/verify/')) return response({ data: { reference: 'REF-P', id: 11, amount: 160000, currency: 'NGN', status: 'success' } });
    if (url.endsWith('/v3/payments')) { const sent = JSON.parse(String(init?.body)); assert.equal(sent.amount, '1600.00'); return response({ data: { link: 'https://flutterwave.test/pay' } }); }
    if (url.includes('/transactions/22/verify')) return response({ data: { tx_ref: 'REF-F', id: 22, amount: 1600, currency: 'NGN', status: 'successful' } });
    if (url.endsWith('/v1/oauth2/token')) return response({ access_token: 'token' });
    if (url.endsWith('/v2/checkout/orders')) return response({ id: 'PAYPAL-ORDER', links: [{ rel: 'payer-action', href: 'https://paypal.test/pay' }] });
    if (url.endsWith('/v2/checkout/orders/PAYPAL-ORDER/capture')) return response({ status: 'COMPLETED', purchase_units: [{ reference_id: 'REF-PP', payments: { captures: [{ id: 'CAPTURE-1', status: 'COMPLETED', amount: { value: '1.00', currency_code: 'USD' } }] } }] });
    throw Error(`Unexpected provider request: ${url}`);
  }) as typeof fetch;
  try {
    const common = { amountKobo: 160000, email: 'customer@example.com', name: 'Customer', orderId: 'order', origin };
    assert.equal((await createProviderCheckout('paystack', { ...common, reference: 'REF-P' })).url, 'https://paystack.test/pay');
    assert.equal((await verifyProviderPayment('paystack', 'REF-P')).status, 'succeeded');
    assert.equal((await createProviderCheckout('flutterwave', { ...common, reference: 'REF-F' })).url, 'https://flutterwave.test/pay');
    assert.equal((await verifyProviderPayment('flutterwave', 'REF-F', '22')).providerAmount, '1600.00');
    const paypal = await createProviderCheckout('paypal', { ...common, reference: 'REF-PP' }); assert.equal(paypal.providerAmount, '1.00'); assert.equal(paypal.providerCurrency, 'USD');
    assert.equal((await verifyProviderPayment('paypal', 'REF-PP', 'PAYPAL-ORDER')).providerPaymentId, 'CAPTURE-1');
  } finally { restore(); }
});

test('provider webhooks reject unsigned requests and accept authentic payment events', { concurrency: false }, async () => {
  process.env.PAYSTACK_SECRET_KEY = 'paystack-test'; process.env.FLUTTERWAVE_SECRET_KEY = 'flutterwave-test'; process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH = 'flutterwave-hook';
  try {
    const paystackBody = JSON.stringify({ event: 'charge.success', data: { reference: 'REF-HOOK', id: 99 } });
    await assert.rejects(verifyWebhook('paystack', paystackBody, new Headers()), /signature/i);
    const paystackHeaders = new Headers({ 'x-paystack-signature': createHmac('sha512', 'paystack-test').update(paystackBody).digest('hex') });
    assert.deepEqual(await verifyWebhook('paystack', paystackBody, paystackHeaders), { reference: 'REF-HOOK', externalId: '99', capture: false });
    process.env.PAYSTACK_WEBHOOK_SECRET = 'whsec_test';
    const timestamp = String(Math.floor(Date.now()/1000));
    const paystackModernSignature = createHmac('sha512','whsec_test').update(`${timestamp}.${paystackBody}`).digest('hex');
    const modernHeaders = new Headers({ 'Paystack-Signature': `t=${timestamp},v1=whk_test:${paystackModernSignature}` });
    assert.deepEqual(await verifyWebhook('paystack',paystackBody,modernHeaders),{reference:'REF-HOOK',externalId:'99',capture:false});
    const stale = String(Math.floor(Date.now()/1000)-600), staleSignature = createHmac('sha512','whsec_test').update(`${stale}.${paystackBody}`).digest('hex');
    await assert.rejects(verifyWebhook('paystack',paystackBody,new Headers({'Paystack-Signature':`t=${stale},v1=whk_test:${staleSignature}`})),/signature/i);
    const flutterwaveBody = JSON.stringify({ event: 'charge.completed', data: { tx_ref: 'REF-FW', id: 101, status: 'successful' } });
    assert.deepEqual(await verifyWebhook('flutterwave', flutterwaveBody, new Headers({ 'verif-hash': 'flutterwave-hook' })), { reference: 'REF-FW', externalId: '101', capture: false });
    const modernSignature = createHmac('sha256', 'flutterwave-hook').update(flutterwaveBody).digest('base64');
    assert.deepEqual(await verifyWebhook('flutterwave', flutterwaveBody, new Headers({ 'flutterwave-signature': modernSignature })), { reference: 'REF-FW', externalId: '101', capture: false });
  } finally { restore(); }
});

async function payable() {
  const f = await fixture(), offline = checkout(f.db); const order = await f.api.create(f.customer.secret, f.input()); await f.api.change(f.vendor.secret, order.id, { version: 0 }, 'reserve'); await f.seedDelivery(order.id); const quoted = await offline.change(f.admin.secret, order.id, { ...quote, version: 1 }, 'quote'); await offline.change(f.customer.secret, order.id, { version: 2, quoteId: quoted.quoteId, totalKobo: 13000 }, 'accept-quote'); return { ...f, orderId: order.id };
}

test('verified online payment confirms once and stores provider evidence', { concurrency: false }, async () => {
  process.env.PAYSTACK_SECRET_KEY = 'paystack-test'; const f = await payable(); let reference = '';
  globalThis.fetch = (async (input, init) => { const url = String(input); if (url.endsWith('/transaction/initialize')) { reference = JSON.parse(String(init?.body)).reference; return response({ data: { authorization_url: 'https://paystack.test/pay' } }); } if (url.includes('/transaction/verify/')) return response({ data: { reference, id: 321, amount: 13000, currency: 'NGN', status: 'success' } }); throw Error(`Unexpected provider request: ${url}`); }) as typeof fetch;
  try {
    const payments = onlinePayments(f.db, origin), started = await payments.start(f.customer.secret, f.orderId, 'paystack'); assert.equal(started.url, 'https://paystack.test/pay');
    const customerSummary = await checkout(f.db).summary(f.customer.secret, f.orderId); assert.deepEqual(customerSummary.latestPayment && { provider: customerSummary.latestPayment.provider, status: customerSummary.latestPayment.status }, { provider: 'paystack', status: 'pending' }); assert.equal('reference' in (customerSummary.latestPayment ?? {}), false);
    const adminSummary = await checkout(f.db).summary(f.admin.secret, f.orderId, true); assert.equal(adminSummary.paymentAttempts?.[0]?.reference, reference); assert.equal(adminSummary.paymentAttempts?.[0]?.provider_currency, 'NGN');
    const result = await payments.callback('paystack', new URLSearchParams({ reference })); assert.equal(result.status, 'succeeded');
    assert.equal((await payments.callback('paystack', new URLSearchParams({ reference }))).status, 'succeeded');
    const order = (await f.db.query<{ payment_verified: boolean; state: string }>('SELECT payment_verified,state FROM order_requests WHERE id=$1', [f.orderId])).rows[0]; assert.equal(order.payment_verified, true); assert.equal(order.state, 'confirmed');
    const paidSummary = await checkout(f.db).summary(f.customer.secret, f.orderId); assert.equal(paidSummary.receipt?.provider, 'paystack'); assert.equal(Number(paidSummary.receipt?.received_kobo), 13000);
    const record = (await f.db.query<{ provider: string; provider_payment_id: string; verified_by: string | null }>('SELECT provider,provider_payment_id,verified_by FROM payment_records WHERE order_id=$1', [f.orderId])).rows[0]; assert.equal(record.provider, 'paystack'); assert.equal(record.provider_payment_id, '321'); assert.equal(record.verified_by, null);
    assert.equal((await f.db.query("SELECT id FROM order_events WHERE event_type='online_payment_verified'")).rows.length, 1);
  } finally { await f.db.close(); restore(); }
});

test('successful charge after reservation expiry is retained for Fendor financial review', { concurrency: false }, async () => {
  process.env.PAYSTACK_SECRET_KEY = 'paystack-test'; const f = await payable(); let reference = '';
  globalThis.fetch = (async (input, init) => { const url = String(input); if (url.endsWith('/transaction/initialize')) { reference = JSON.parse(String(init?.body)).reference; return response({ data: { authorization_url: 'https://paystack.test/pay' } }); } return response({ data: { reference, id: 654, amount: 13000, currency: 'NGN', status: 'success' } }); }) as typeof fetch;
  try {
    const payments = onlinePayments(f.db, origin); await payments.start(f.customer.secret, f.orderId, 'paystack'); await f.db.query("UPDATE order_requests SET reservation_expires_at=now()-interval '1 minute' WHERE id=$1", [f.orderId]);
    const result = await payments.callback('paystack', new URLSearchParams({ reference })); assert.equal(result.status, 'review');
    const order = (await f.db.query<{ payment_verified: boolean; financial_hold: boolean }>('SELECT payment_verified,financial_hold FROM order_requests WHERE id=$1', [f.orderId])).rows[0]; assert.equal(order.payment_verified, false); assert.equal(order.financial_hold, true);
    assert.equal((await f.db.query('SELECT id FROM payment_records WHERE order_id=$1', [f.orderId])).rows.length, 1);
  } finally { await f.db.close(); restore(); }
});
