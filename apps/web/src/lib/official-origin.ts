export const OFFICIAL_ORIGIN = 'https://fendoraworld.com';
const LEGACY_NETLIFY_HOST = 'fendor-beta.netlify.app';

export function officialRedirectUrl(requestUrl: string) {
  const source = new URL(requestUrl);
  if (source.hostname !== LEGACY_NETLIFY_HOST) return null;
  return new URL(`${source.pathname}${source.search}`, OFFICIAL_ORIGIN);
}
