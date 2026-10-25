import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalReviewOrigin, reviewAccessToken, reviewEntryDestination, safeReviewDestination } from '../src/lib/review-access.ts';

test('review access token is stable without storing the plain access code', async () => {
  const token = await reviewAccessToken('example-secret');
  assert.equal(token.length, 64);
  assert.equal(token, await reviewAccessToken('example-secret'));
  assert.notEqual(token, 'example-secret');
});

test('review destinations stay on Fendor', () => {
  assert.equal(safeReviewDestination('/vendor/orders?view=open'), '/vendor/orders?view=open');
  assert.equal(safeReviewDestination('https://example.com'), '/');
  assert.equal(safeReviewDestination('//example.com'), '/');
  assert.equal(safeReviewDestination(undefined), '/');
});

test('private review entry starts with the onboarding choice', () => {
  assert.equal(reviewEntryDestination(true, '/shop'), '/welcome');
  assert.equal(reviewEntryDestination(false, '/shop'), '/shop');
});

test('review redirects use the configured canonical application origin', () => {
  assert.equal(canonicalReviewOrigin('https://fendor-beta.netlify.app', 'https://deploy-id--fendor-beta.netlify.app/signup'), 'https://fendor-beta.netlify.app');
  assert.equal(canonicalReviewOrigin(undefined, 'http://localhost:3000/signup'), 'http://localhost:3000');
  assert.equal(canonicalReviewOrigin('not a url', 'https://fendor-beta.netlify.app/signup'), 'https://fendor-beta.netlify.app');
});
