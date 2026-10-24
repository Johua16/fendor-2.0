import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupportCase, getOrderRemedy, listNotifications, markNotificationRead, replyToSupportCase, requestOrderRemedy } from '../src/lib/client/customer-service.ts';

test('notifications use the private session endpoints', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; method?: string }> = [];
  globalThis.fetch = async (input, init) => { calls.push({ path: String(input), method: init?.method }); return Response.json(String(input) === '/api/notifications' ? { notifications: [], nextCursor: null } : { id: 'note-1' }); };
  try {
    await listNotifications(); await markNotificationRead('note-1');
    assert.deepEqual(calls, [{ path: '/api/notifications', method: undefined }, { path: '/api/notifications/note-1/read', method: 'POST' }]);
  } finally { globalThis.fetch = originalFetch; }
});

test('support creation preserves its idempotency key and replies use the latest version', async () => {
  const originalFetch = globalThis.fetch;
  const bodies: unknown[] = [];
  globalThis.fetch = async (_input, init) => { bodies.push(JSON.parse(String(init?.body))); return Response.json({ id: 'case-1', version: 1, status: 'open' }); };
  try {
    await createSupportCase({ requestId: 'request-1', subject: 'Help with an order', message: 'Please check this request.', orderId: 'order-1' });
    await replyToSupportCase('case-1', 3, 'Thank you for the update.');
    assert.deepEqual(bodies, [
      { requestId: 'request-1', subject: 'Help with an order', message: 'Please check this request.', orderId: 'order-1' },
      { version: 3, message: 'Thank you for the update.' },
    ]);
  } finally { globalThis.fetch = originalFetch; }
});

test('paid-order remedy reads status and submits the current order version', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; method?: string; body?: unknown }> = [];
  globalThis.fetch = async (input, init) => { calls.push({ path: String(input), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined }); return Response.json(init?.method ? { orderId: 'order-1', state: 'confirmed', version: 9 } : null); };
  try {
    await getOrderRemedy('order-1');
    await requestOrderRemedy('order-1', 8, 'cancellation', 'The recipient will no longer be available for this delivery.');
    assert.deepEqual(calls, [
      { path: '/api/orders/order-1/remedy', method: undefined, body: undefined },
      { path: '/api/orders/order-1/request-remedy', method: 'POST', body: { version: 8, kind: 'cancellation', note: 'The recipient will no longer be available for this delivery.' } },
    ]);
  } finally { globalThis.fetch = originalFetch; }
});
