export function config() {
  const rawOrigin = process.env.APP_ORIGIN;
  const outboxKey = process.env.OUTBOX_KEY;
  if (!rawOrigin || !outboxKey || !/^[a-f0-9]{64}$/i.test(outboxKey)) throw Error('APP_ORIGIN and OUTBOX_KEY must be configured.');
  const url = new URL(rawOrigin);
  if (url.origin !== rawOrigin || !['http:', 'https:'].includes(url.protocol)) throw Error('APP_ORIGIN must be an origin without a path.');
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw Error('Production APP_ORIGIN must use HTTPS.');
  return {
    origin: url.origin,
    outboxKey,
    secure: url.protocol === 'https:',
    reviewMode: process.env.BETA_REVIEW_MODE === 'true',
  };
}
