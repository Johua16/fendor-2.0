export const REVIEW_ACCESS_COOKIE = 'fendor_review_access';

export function reviewAccessEnabled() {
  return process.env.BETA_REVIEW_MODE === 'true' && Boolean(process.env.REVIEW_ACCESS_CODE?.trim());
}

export async function reviewAccessToken(code: string) {
  const bytes = new TextEncoder().encode(`fendor-private-review:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function safeReviewDestination(value: string | null | undefined) {
  if (!value?.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export function reviewEntryDestination(reviewMode: boolean, requested: string | null | undefined) {
  return reviewMode ? '/welcome' : safeReviewDestination(requested);
}

export function canonicalReviewOrigin(configuredOrigin: string | null | undefined, fallbackUrl: string) {
  try {
    const configured = new URL(configuredOrigin?.trim() || fallbackUrl);
    if (!['http:', 'https:'].includes(configured.protocol)) throw new Error('Unsupported origin protocol.');
    return configured.origin;
  } catch {
    return new URL(fallbackUrl).origin;
  }
}
