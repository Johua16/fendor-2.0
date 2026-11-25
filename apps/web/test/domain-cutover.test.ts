import assert from 'node:assert/strict';
import test from 'node:test';
import { officialRedirectUrl } from '../src/lib/official-origin.ts';

test('the legacy Netlify production hostname redirects permanently to the official domain', async () => {
  const destination = officialRedirectUrl(
    'https://fendor-beta.netlify.app/shop?category=gifts',
  );

  assert.equal(
    destination?.toString(),
    'https://fendoraworld.com/shop?category=gifts',
  );
});

test('the official domain does not redirect', () => {
  assert.equal(officialRedirectUrl('https://fendoraworld.com/shop'), null);
});
