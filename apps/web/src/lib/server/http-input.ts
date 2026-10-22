import { fail } from './identity.ts';
export async function body(req: Request): Promise<Record<string, unknown>> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) fail(415, 'JSON_REQUIRED', 'Send JSON.');
  const reader = req.body?.getReader(); if (!reader) fail(400, 'INVALID_JSON', 'JSON body required.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length; if (size > 16384) { await reader.cancel(); fail(413, 'BODY_TOO_LARGE', 'Request is too large.'); }
    chunks.push(value);
  }
  let parsed: unknown; try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'INVALID_JSON', 'Invalid JSON.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(400, 'INVALID_JSON', 'JSON object required.');
  return parsed as Record<string, unknown>;
}
