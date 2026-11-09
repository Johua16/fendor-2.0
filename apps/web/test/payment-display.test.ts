import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paymentDisplayStatus} from '../src/lib/client/payment-status.ts';
test('payment success is shown only when the server confirms the order',()=>{
 assert.equal(paymentDisplayStatus(false,false,undefined,'succeeded'),'pending');
 assert.equal(paymentDisplayStatus(false,false,'succeeded',''),'pending');
 assert.equal(paymentDisplayStatus(true,false,'pending',''),'succeeded');
 assert.equal(paymentDisplayStatus(false,true,'succeeded','succeeded'),'review');
 assert.equal(paymentDisplayStatus(false,false,'pending','cancelled'),'pending');
});
