import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './order-fixture.ts';
import { checkout } from '../src/lib/server/checkout.ts';
import { refunds } from '../src/lib/server/refunds.ts';
async function setup() {
 const f=await fixture(),pay=checkout(f.db),refund=refunds(f.db);
 const order=await f.api.create(f.customer.secret,f.input());const id=order.id;await f.seedDelivery(id);
 await f.api.change(f.vendor.secret,id,{version:0},'reserve');
 const q=await pay.change(f.admin.secret,id,{version:1,packagingKobo:1000,deliveryKobo:2000,fulfilmentChecked:true,fulfilmentPlan:'Abuja route, standard packaging and preparation checked.'},'quote');
 await pay.change(f.customer.secret,id,{version:2,quoteId:q.quoteId,totalKobo:13000},'accept-quote');
 return {...f,pay,refund,id};
}
const note='Actual outbound refund checked against bank record';
test('multiple receipts plus overpayment refund reconcile to one paid allocation',async()=>{
 const f=await setup();const {db,pay,refund,id,admin,customer}=f;
 try {
  const a=await pay.change(admin.secret,id,{version:3,bankReference:'IN-A',receivedKobo:6000,receiptNote:'Actual first transfer'},'record-payment');
  const b=await pay.change(admin.secret,id,{version:4,bankReference:'IN-B',receivedKobo:8000,receiptNote:'Actual second transfer'},'record-payment');
  await assert.rejects(pay.change(admin.secret,id,{version:5,paymentId:a.paymentId,bankReceiptChecked:true},'verify-payment'),{code:'PAYMENT_MISMATCH'});
  const input={version:5,paymentId:b.paymentId,bankReference:'OUT-EXCESS',amountKobo:1000,bankRefundChecked:true,note};
  const r=await refund.change(admin.secret,id,input,'record-refund');
  assert.equal((await refund.change(admin.secret,id,input,'record-refund')).refundId,r.refundId);
  await pay.change(admin.secret,id,{version:6,paymentId:a.paymentId,bankReceiptChecked:true},'verify-payment');
  const summary=await pay.summary(customer.secret,id);assert.equal(summary.netReceivedKobo,'13000');assert.equal(summary.refundedKobo,'1000');assert.equal(summary.orderConfirmed,true);assert.equal('refunds' in summary,false);
  const extra=await pay.change(admin.secret,id,{version:7,bankReference:'IN-LATE',receivedKobo:500,receiptNote:'Duplicate late transfer'},'record-payment');
  await refund.change(admin.secret,id,{version:8,paymentId:extra.paymentId,bankReference:'OUT-LATE',amountKobo:500,bankRefundChecked:true,note},'record-refund');
  await assert.rejects(refund.change(admin.secret,id,{version:9,paymentId:a.paymentId,bankReference:'PRINCIPAL',amountKobo:1,bankRefundChecked:true,note},'record-refund'),{code:'PAID_REMEDY_REQUIRED'});
  assert.equal((await db.query('SELECT stock_quantity FROM product_variants')).rows[0].stock_quantity,0);
 } finally {await db.close();}
});
test('late funds can be refunded and request closed without erasing receipt history',async()=>{
 const f=await setup();const {db,pay,refund,id,admin}=f;
 try {
  const receipt=await pay.change(admin.secret,id,{version:3,bankReference:'LATE-IN',receivedKobo:13000,receiptNote:'Actual receipt after delay'},'record-payment');
  f.advance();await f.api.expireBatch();
  await assert.rejects(refund.change(admin.secret,id,{version:5,note},'close-refunded'),{code:'FUNDS_REMAIN'});
  await refund.change(admin.secret,id,{version:5,paymentId:receipt.paymentId,bankReference:'LATE-OUT',amountKobo:13000,bankRefundChecked:true,note},'record-refund');
  const result=await refund.change(admin.secret,id,{version:6,note},'close-refunded');assert.equal(result.state,'cancelled');
  assert.equal((await db.query('SELECT * FROM payment_records')).rows.length,1);
  assert.equal((await db.query('SELECT reserved_quantity FROM product_variants')).rows[0].reserved_quantity,0);
  assert.equal((await db.query("SELECT review_note FROM order_events WHERE event_type='refunded_request_closed'")).rows[0].review_note,note);
 } finally {await db.close();}
});
test('refund permissions and concurrent attempts cannot refund funds twice',async()=>{
 const f=await setup();const {db,pay,refund,id,admin,customer}=f;
 try {
  const p=await pay.change(admin.secret,id,{version:3,bankReference:'IN-CHECK',receivedKobo:1000,receiptNote:'Small received payment'},'record-payment');
  const input={version:4,paymentId:p.paymentId,bankReference:'OUT-A',amountKobo:1000,bankRefundChecked:true,note};
  await assert.rejects(refund.change(customer.secret,id,input,'record-refund'),{code:'FORBIDDEN'});
  await assert.rejects(refund.change(admin.secret,id,{...input,bankRefundChecked:false},'record-refund'),{code:'BANK_CHECK_REQUIRED'});
  const results=await Promise.allSettled([refund.change(admin.secret,id,input,'record-refund'),refund.change(admin.secret,id,{...input,bankReference:'OUT-B'},'record-refund')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  await assert.rejects(refund.change(admin.secret,id,{...input,version:5,bankReference:'OUT-C'},'record-refund'),{code:'REFUND_EXCEEDS_RECEIPT'});
  assert.equal((await db.query('SELECT * FROM payment_refunds')).rows.length,1);
 } finally {await db.close();}
});
