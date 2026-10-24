import assert from 'node:assert/strict';
import test from 'node:test';
import { isSaved, readSaved, toggleSavedItem } from '../src/lib/client/saved.ts';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
}

const product = { id: 'variant-1', productId: 'product-1', variantId: 'variant-1', name: 'Gift box', vendor: 'Verified vendor', priceKobo: 1_250_000, art: 'bag', tint: '#ead8c6', option: 'Standard finish' };

test('saved products toggle predictably and malformed browser data is ignored', () => {
  const storage = memoryStorage('{broken');
  assert.deepEqual(readSaved(storage), []);
  assert.equal(toggleSavedItem(product, storage).saved, true);
  assert.equal(isSaved(product.id, storage), true);
  assert.equal(toggleSavedItem(product, storage).saved, false);
  assert.deepEqual(readSaved(storage), []);
});
