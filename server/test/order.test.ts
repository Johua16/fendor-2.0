import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transition } from '../src/order.ts';
import type { Actor, Order } from '../src/order.ts';
const customer: Actor = { id: 'c1', role: 'customer' };
const vendor: Actor = { id: 'v1', role: 'vendor' };
const admin: Actor = { id: 'a1', role: 'admin' };
const now = 1000;
const draft = (): Order => ({ id: 'o1', customerId: 'c1', vendorId: 'v1', productVariantId: 'sku1', quantity: 2, state: 'draft', version: 0 });
function reserved() { return transition(transition(draft(), customer, { type: 'submit' }, now), vendor, { type: 'reserve', expiresAt: 5000 }, now); }
function awaiting() { return transition(transition(reserved(), admin, { type: 'quote', totalKobo: 500000 }, now), customer, { type: 'accept_quote', totalKobo: 500000 }, now); }
const error = (code: string) => (e: any) => e.code === code;
test('full order journey preserves immutable snapshots and requires verified funds', () => {
  const before = awaiting();
  let o = transition(before, admin, { type: 'verify_payment', receivedKobo: 500000 }, now);
  assert.equal(before.state, 'awaiting_payment');
  o = transition(o, vendor, { type: 'prepare' }, 6000);
  o = transition(o, vendor, { type: 'ready' }, 7000);
  o = transition(o, admin, { type: 'dispatch' }, 8000);
  o = transition(o, admin, { type: 'deliver' }, 9000);
  assert.equal(o.state, 'delivered'); assert.equal(o.version, 9);
});
test('vendor stock approval is not final order confirmation', () => {
  const o = reserved(); assert.equal(o.state, 'reserved'); assert.equal(o.paymentVerified, undefined);
  assert.throws(() => transition(o, vendor, { type: 'prepare' }, now), error('INVALID_STATE'));
});
test('unrelated actors and vendor payment confirmation are blocked', () => {
  assert.throws(() => transition(draft(), { ...customer, id: 'other' }, { type: 'submit' }, now), error('FORBIDDEN'));
  assert.throws(() => transition(awaiting(), vendor, { type: 'verify_payment', receivedKobo: 500000 }, now), error('FORBIDDEN'));
  assert.throws(() => transition(reserved(), { ...vendor, id: 'other' }, { type: 'decline' }, now), error('FORBIDDEN'));
});
test('expired reservation cannot accept a quote or confirm payment', () => {
  assert.throws(() => transition(awaiting(), admin, { type: 'verify_payment', receivedKobo: 500000 }, 5000), error('RESERVATION_EXPIRED'));
  assert.throws(() => transition(reserved(), admin, { type: 'quote', totalKobo: 500000 }, 5001), error('RESERVATION_EXPIRED'));
});
test('changed quote clears consent and requires fresh acceptance', () => {
  const o = transition(awaiting(), admin, { type: 'quote', totalKobo: 600000 }, now);
  assert.equal(o.acceptedTotalKobo, undefined);
  assert.throws(() => transition(o, customer, { type: 'accept_quote', totalKobo: 500000 }, now), error('QUOTE_CHANGED'));
});
test('wrong payments and duplicate verification cannot progress an order', () => {
  assert.throws(() => transition(awaiting(), admin, { type: 'verify_payment', receivedKobo: 499999 }, now), error('PAYMENT_MISMATCH'));
  const paid = transition(awaiting(), admin, { type: 'verify_payment', receivedKobo: 500000 }, now);
  assert.throws(() => transition(paid, admin, { type: 'verify_payment', receivedKobo: 500000 }, now), error('INVALID_STATE'));
  assert.throws(() => transition(paid, customer, { type: 'cancel' }, now), error('INVALID_STATE'));
});
test('invalid inventory and money inputs fail', () => {
  assert.throws(() => transition({ ...draft(), quantity: 0 }, customer, { type: 'submit' }, now), error('INVALID_QUANTITY'));
  for (const totalKobo of [-1, 0, 1.5, NaN, Infinity]) assert.throws(() => transition(reserved(), admin, { type: 'quote', totalKobo }, now), error('INVALID_AMOUNT'));
});
test('decline and cancellation remain distinct from delivery', () => {
  const o = transition(reserved(), vendor, { type: 'decline' }, now);
  assert.equal(o.state, 'unavailable');
  assert.equal(transition(o, customer, { type: 'cancel' }, now).state, 'cancelled');
});
