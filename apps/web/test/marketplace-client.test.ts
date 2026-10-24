import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptOrderQuote, cancelOrderRequest, createOrderRequest, getCheckoutSummary, listOrderRequests, listProducts, MarketplaceApiError, saveOrderPersonalisation } from '../src/lib/client/marketplace.ts';

test('catalogue client sends supported public filters', async () => {
  const originalFetch = globalThis.fetch;
  let requested = '';
  globalThis.fetch = async (input) => {
    requested = String(input);
    return Response.json({ products: [], nextCursor: null });
  };
  try {
    await listProducts({ q: 'birthday hamper', category: 'hampers', limit: 20 });
    assert.equal(requested, '/api/products?limit=20&q=birthday+hamper&category=hampers');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('order request client preserves the idempotency key and quantity', async () => {
  const originalFetch = globalThis.fetch;
  let body = '';
  globalThis.fetch = async (_input, init) => {
    body = String(init?.body);
    return Response.json({ order: { id: 'order-1', productVariantId: 'variant-1', quantity: 2, state: 'checking_availability', version: 0 } }, { status: 201 });
  };
  try {
    await createOrderRequest('variant-1', 2, 'request-1');
    assert.deepEqual(JSON.parse(body), { clientRequestId: 'request-1', productVariantId: 'variant-1', quantity: 2 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('API error envelopes remain visible to the customer interface', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable.' } }, { status: 503 });
  try {
    await assert.rejects(() => listProducts({}), (error: unknown) => error instanceof MarketplaceApiError && error.status === 503 && error.code === 'SERVICE_UNAVAILABLE');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('customer request list uses the private session endpoint', async () => {
  const originalFetch = globalThis.fetch;
  let requested = '';
  let credentials = '';
  globalThis.fetch = async (input, init) => {
    requested = String(input); credentials = String(init?.credentials);
    return Response.json({ orders: [], nextCursor: null });
  };
  try {
    await listOrderRequests();
    assert.equal(requested, '/api/orders?limit=50');
    assert.equal(credentials, 'same-origin');
  } finally { globalThis.fetch = originalFetch; }
});

test('personalisation and cancellation include the latest order version', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; body: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ path: String(input), body: JSON.parse(String(init?.body)) });
    return Response.json({ order: {} });
  };
  try {
    await saveOrderPersonalisation('order-1', 4, { recipientName: 'Ada', giftMessage: 'Happy birthday' });
    await cancelOrderRequest('order-1', 5);
    assert.deepEqual(calls, [
      { path: '/api/orders/order-1/personalise', body: { version: 4, giftDetails: { recipientName: 'Ada', giftMessage: 'Happy birthday' } } },
      { path: '/api/orders/order-1/cancel', body: { version: 5 } },
    ]);
  } finally { globalThis.fetch = originalFetch; }
});

test('checkout reads the private summary and accepts the exact quoted total', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; method?: string; body?: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ path: String(input), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(init?.method ? { orderId: 'order-1', state: 'awaiting_payment', version: 7 } : { orderId: 'order-1', version: 6, quote: null });
  };
  try {
    await getCheckoutSummary('order-1');
    await acceptOrderQuote('order-1', 6, 'quote-1', 18_500_00);
    assert.deepEqual(calls, [
      { path: '/api/orders/order-1/checkout', method: undefined, body: undefined },
      { path: '/api/orders/order-1/accept-quote', method: 'POST', body: { version: 6, quoteId: 'quote-1', totalKobo: 18_500_00 } },
    ]);
  } finally { globalThis.fetch = originalFetch; }
});
