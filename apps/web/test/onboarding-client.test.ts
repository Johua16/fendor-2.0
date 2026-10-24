import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthApiError } from '../src/lib/client/auth.ts';
import { uploadBusinessDocument } from '../src/lib/client/onboarding.ts';

test('business document upload sends an owned document image to the live upload route', async () => {
  const originalFetch = globalThis.fetch;
  const file = new File([new Uint8Array([1, 2, 3])], 'registration.png', { type: 'image/png' });
  let request: { path: string; method?: string; body?: BodyInit | null } | null = null;
  globalThis.fetch = async (input, init) => {
    request = { path: String(input), method: init?.method, body: init?.body };
    return Response.json({ id: 'document-id', purpose: 'document', status: 'pending', imagePath: '/api/media/document-id' }, { status: 201 });
  };
  try {
    const result = await uploadBusinessDocument(file);
    assert.deepEqual(request, { path: '/api/uploads?purpose=document', method: 'POST', body: file });
    assert.equal(result.status, 'pending');
  } finally { globalThis.fetch = originalFetch; }
});

test('business document upload rejects unsupported files and preserves server errors', async () => {
  await assert.rejects(
    () => uploadBusinessDocument(new File(['text'], 'document.pdf', { type: 'application/pdf' })),
    /JPEG, PNG or WebP/,
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: { code: 'EMAIL_UNVERIFIED', message: 'Verify your email.' } }, { status: 403 });
  try {
    await assert.rejects(
      () => uploadBusinessDocument(new File(['image'], 'document.png', { type: 'image/png' })),
      (error: unknown) => error instanceof AuthApiError && error.code === 'EMAIL_UNVERIFIED',
    );
  } finally { globalThis.fetch = originalFetch; }
});
