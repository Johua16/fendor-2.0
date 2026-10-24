import assert from 'node:assert/strict';
import test from 'node:test';
import { addCartItem, cartItemCount, readCart } from '../src/lib/client/cart.ts';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
  };
}

const product = {
  id: 'variant-1', productId: 'product-1', variantId: 'variant-1', name: 'Gift box', vendor: 'Verified vendor',
  priceKobo: 12_500_00, art: 'bag', tint: '#ead8c6', option: 'Standard finish',
};

test('cart persists products and combines repeat additions', () => {
  const storage = memoryStorage();
  addCartItem(product, storage);
  addCartItem({ ...product, quantity: 2 }, storage);
  const cart = readCart(storage);
  assert.equal(cart.length, 1);
  assert.equal(cart[0]?.quantity, 3);
  assert.equal(cartItemCount(cart), 3);
});

test('cart ignores malformed stored data and caps quantity', () => {
  const invalidStorage = memoryStorage('{broken');
  assert.deepEqual(readCart(invalidStorage), []);

  const storage = memoryStorage();
  addCartItem({ ...product, quantity: 10 }, storage);
  addCartItem({ ...product, quantity: 4 }, storage);
  assert.equal(readCart(storage)[0]?.quantity, 10);
});
