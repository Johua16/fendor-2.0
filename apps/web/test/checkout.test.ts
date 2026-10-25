import { handleIdentity } from '../src/lib/server/http-identity.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './order-fixture.ts';
import { checkout } from '../src/lib/server/checkout.ts';
const quote={packagingKobo:1000,deliveryKobo:2000,fulfilmentChecked:true,fulfilmentPlan:'Standard gift box, Abuja delivery, preparation and route checked.'};
async function ready() {
 const f=await fixture(),pay=checkout(f.db);const order=await f.api.create(f.customer.secret,f.input());await f.api.change(f.vendor.secret,order.id,{version:0},'reserve');await f.seedDelivery(order.id);return {...f,pay,id:order.id};
}
test('quote acceptance, bank receipt and exactly-once stock allocation',async()=>{
 const f=await ready();const {pay,db,id,admin,customer,vendor,other}=f;
 try {
  await assert.rejects(pay.change(vendor.secret,id,{...quote,version:1},'quote'),{code:'FORBIDDEN'});
  await assert.rejects(pay.summary(other.secret,id),{code:'NOT_FOUND'});
  const q=await pay.change(admin.secret,id,{...quote,version:1},'quote');assert.equal(q.totalKobo,13000);
  await pay.change(customer.secret,id,{version:2,quoteId:q.quoteId,totalKobo:13000},'accept-quote');
  const receipt=await pay.change(admin.secret,id,{version:3,bankReference:'BANK-1',receivedKobo:13000,receiptNote:'Checked bank transaction record'},'record-payment');
  const replay=await pay.change(admin.secret,id,{version:3,bankReference:'bank-1',receivedKobo:13000,receiptNote:'Retry recorded receipt'},'record-payment');assert.equal(replay.paymentId,receipt.paymentId);
  await assert.rejects(f.api.change(customer.secret,id,{version:4},'cancel'),{code:'PAYMENT_REVIEW_REQUIRED'});
  await assert.rejects(pay.change(admin.secret,id,{version:4,paymentId:receipt.paymentId},'verify-payment'),{code:'BANK_CHECK_REQUIRED'});
  const results=await Promise.all([pay.change(admin.secret,id,{version:4,paymentId:receipt.paymentId,bankReceiptChecked:true},'verify-payment'),pay.change(admin.secret,id,{version:4,paymentId:receipt.paymentId,bankReceiptChecked:true},'verify-payment')]);assert.ok(results.every(r=>r.orderConfirmed));
  await pay.change(admin.secret,id,{version:4,paymentId:receipt.paymentId,bankReceiptChecked:true},'verify-payment');
  const stock=(await db.query('SELECT stock_quantity,reserved_quantity FROM product_variants')).rows[0];assert.equal(stock.stock_quantity,0);assert.equal(stock.reserved_quantity,0);
  assert.equal((await db.query("SELECT * FROM order_events WHERE event_type='payment_verified'")).rows.length,1);
  const summary=await pay.summary(customer.secret,id);assert.equal('payments' in summary,false);assert.equal(summary.orderConfirmed,true);
 }finally{await db.close();}
});
test('new quotes invalidate acceptance and personalised edits invalidate quotes',async()=>{
 const f=await ready();const {pay,db,id,admin,customer}=f;
 try {
  await assert.rejects(pay.change(admin.secret,id,{...quote,version:1,fulfilmentChecked:false},'quote'),{code:'FEASIBILITY_REQUIRED'});
  const a=await pay.change(admin.secret,id,{...quote,version:1},'quote');
  await pay.change(customer.secret,id,{version:2,quoteId:a.quoteId,totalKobo:13000},'accept-quote');
  const b=await pay.change(admin.secret,id,{...quote,version:3,deliveryKobo:3000},'quote');
  await assert.rejects(pay.change(customer.secret,id,{version:4,quoteId:a.quoteId,totalKobo:13000},'accept-quote'),{code:'QUOTE_CHANGED'});
  assert.equal((await pay.summary(customer.secret,id)).acceptedQuoteId,null);
  await f.api.change(customer.secret,id,{version:4,giftDetails:{giftMessage:'Changed message'}},'personalise');
  assert.equal((await pay.summary(customer.secret,id)).quote,null);
  assert.equal((await db.query('SELECT * FROM quote_acceptances')).rows[0].quote_id,a.quoteId);
  assert.equal((await db.query('SELECT * FROM order_quotes')).rows.length,2);assert.notEqual(a.quoteId,b.quoteId);
 }finally{await db.close();}
});
test('mismatched and late funds are retained without confirmation',async()=>{
 const f=await ready();const {pay,db,id,admin,customer}=f;
 try {
  const q=await pay.change(admin.secret,id,{...quote,version:1},'quote');
  await pay.change(customer.secret,id,{version:2,quoteId:q.quoteId,totalKobo:13000},'accept-quote');
  const receipt=await pay.change(admin.secret,id,{version:3,bankReference:'SHORT',receivedKobo:100,receiptNote:'Partial actual receipt'},'record-payment');
  await assert.rejects(pay.change(admin.secret,id,{version:4,paymentId:receipt.paymentId,bankReceiptChecked:true},'verify-payment'),{code:'PAYMENT_MISMATCH'});
  f.advance();await f.api.expireBatch();
  assert.equal((await db.query('SELECT * FROM payment_records')).rows.length,1);
  await assert.rejects(pay.change(admin.secret,id,{version:5,paymentId:receipt.paymentId,bankReceiptChecked:true},'verify-payment'),{code:'RESERVATION_EXPIRED'});
  const extra=await pay.change(admin.secret,id,{version:5,bankReference:'LATE',receivedKobo:12900,receiptNote:'Late additional receipt'},'record-payment');assert.ok(extra.paymentId);
  assert.equal((await pay.summary(customer.secret,id)).orderConfirmed,false);
  assert.equal((await db.query('SELECT * FROM payment_records')).rows.length,2);
 }finally{await db.close();}
});
test('checkout HTTP permissions, field validation and receipt reference conflicts',async()=>{
 const f=await ready();const {db,id,admin,customer,pay}=f;
 const settings={origin:'http://localhost:3000',secure:false,outboxKey:'ab'.repeat(32)};
 async function call(path:string,body:unknown,secret:string) {return handleIdentity(new Request(`${settings.origin}/api/${path}`,{method:'POST',headers:{origin:settings.origin,'content-type':'application/json',cookie:`fendor_session=${secret}`},body:JSON.stringify(body)}),path.split('/'),{db,settings});}
 try {
  assert.equal((await call(`admin/orders/${id}/quote`,{...quote,version:1},customer.secret)).status,403);
  assert.equal((await call(`admin/orders/${id}/quote`,{...quote,version:1,totalKobo:1},admin.secret)).status,400);
  const q=await call(`admin/orders/${id}/quote`,{...quote,version:1},admin.secret);assert.equal(q.status,200);
  const receipt=await pay.change(admin.secret,id,{version:2,bankReference:'REF-CHECK',receivedKobo:100,receiptNote:'Actual receipt logged'},'record-payment');assert.ok(receipt.paymentId);
  await assert.rejects(pay.change(admin.secret,id,{version:3,bankReference:'REF-CHECK',receivedKobo:200,receiptNote:'Changed amount rejected'},'record-payment'),{code:'REFERENCE_CONFLICT'});
  assert.equal((await db.query('SELECT * FROM payment_records')).rows.length,1);
 }finally {await db.close();}
});

test('private review mode simulates payment without bank instructions or real receipt input',async()=>{
 const f=await fixture(),pay=checkout(f.db,Date.now,{reviewMode:true});
 const order=await f.api.create(f.customer.secret,f.input());
 await f.api.change(f.vendor.secret,order.id,{version:0},'reserve');
 await f.seedDelivery(order.id);
 try {
  const q=await pay.change(f.admin.secret,order.id,{...quote,version:1},'quote');
  await pay.change(f.customer.secret,order.id,{version:2,quoteId:q.quoteId,totalKobo:13000},'accept-quote');
  const customerSummary=await pay.summary(f.customer.secret,order.id);
  assert.equal(customerSummary.reviewMode,true);
  assert.equal('paymentInstructions' in customerSummary,false);
  await assert.rejects(checkout(f.db).change(f.admin.secret,order.id,{version:3,reviewModeAcknowledged:true},'simulate-payment'),{code:'REVIEW_MODE_REQUIRED'});
  const confirmed=await pay.change(f.admin.secret,order.id,{version:3,reviewModeAcknowledged:true},'simulate-payment');
  assert.equal(confirmed.orderConfirmed,true);
  const replay=await pay.change(f.admin.secret,order.id,{version:4,reviewModeAcknowledged:true},'simulate-payment');
  assert.equal(replay.orderConfirmed,true);
  const payment=(await f.db.query<{bank_reference:string;receipt_note:string;status:string}>('SELECT bank_reference,receipt_note,status FROM payment_records WHERE order_id=$1',[order.id])).rows[0];
  assert.match(payment.bank_reference,/^TEST-/);
  assert.equal(payment.status,'verified');
  assert.match(payment.receipt_note,/no funds moved/i);
  assert.equal((await f.db.query("SELECT * FROM order_events WHERE event_type='test_payment_simulated'")).rows.length,1);
 } finally {await f.db.close();}
});
