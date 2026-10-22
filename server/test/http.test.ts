import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/http.ts';
test('health is available but readiness never falsely claims connected storage', async () => {
  const app = createApp();
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve));
  try {
    const address = app.address();
    if (!address || typeof address === 'string') throw Error('Missing listener');
    const base = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(base + '/api/health')).status, 200);
    assert.equal((await fetch(base + '/api/ready')).status, 503);
    assert.equal((await fetch(base + '/api/orders')).status, 404);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); }
});
