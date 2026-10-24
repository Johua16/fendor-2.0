import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrderRequest, listProducts, MarketplaceApiError } from '../src/lib/client/marketplace.ts';

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
