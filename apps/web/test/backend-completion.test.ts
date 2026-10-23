import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {fixture} from './order-fixture.ts';
import {checkout} from '../src/lib/server/checkout.ts';
import {fulfilment} from '../src/lib/server/fulfilment.ts';
import {uploads} from '../src/lib/server/uploads.ts';
import {remedies} from '../src/lib/server/remedies.ts';
import {refunds} from '../src/lib/server/refunds.ts';
import {support} from '../src/lib/server/support.ts';
import {vendorProfile} from '../src/lib/server/vendor-profile.ts';
import {produceNotifications} from '../src/lib/server/notifications.ts';
import {runWorker} from '../src/lib/server/worker.ts';
import {handleIdentity} from '../src/lib/server/http-identity.ts';
const key='ab'.repeat(32),origin='http://localhost:3000';
const image=()=>sharp({create:{width:8,height:8,channels:3,background:'#ff7700'}}).png().toBuffer();
const reason='Operator reviewed the evidence and recorded the outcome.';
async function setup() {
 const f=await fixture(),pay=checkout(f.db),ship=fulfilment(f.db,key),files=uploads(f.db,key,origin),remedy=remedies(f.db);
 await f.db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",[f.other.id]);
 return {...f,pay,ship,files,remedy};
}
async function paid(f:Awaited<ReturnType<typeof setup>>) {
 const created=await f.api.create(f.customer.secret,f.input());const id=created.id;
 const zone=await f.ship.zone(f.admin.secret,{name:'Central Abuja',state:'FCT',city:'Abuja'});
 const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
 await f.ship.delivery(f.customer.secret,id,{version:0,zoneId:zone.id,recipientName:'Ada',phone:'+2348012345678',address:'10 Test Street, Abuja',deliveryDate:tomorrow});
 await f.api.change(f.vendor.secret,id,{version:1},'reserve');
 const q=await f.pay.change(f.admin.secret,id,{version:2,packagingKobo:1000,deliveryKobo:2000,fulfilmentChecked:true,fulfilmentPlan:'Standard package with checked delivery and preparation slot.'},'quote');
 await f.pay.change(f.customer.secret,id,{version:3,quoteId:q.quoteId,totalKobo:13000},'accept-quote');
 const p=await f.pay.change(f.admin.secret,id,{version:4,bankReference:randomUUID(),receivedKobo:13000,receiptNote:reason},'record-payment');
 await f.pay.change(f.admin.secret,id,{version:5,paymentId:p.paymentId,bankReceiptChecked:true},'verify-payment');return {id,paymentId:p.paymentId};
}
test('full paid order: private delivery, failed dispatch, delivery proof, reviewed return and restock once',async()=>{
 const f=await setup();try {
  const {id,paymentId}=await paid(f);
  const vendorView=await f.ship.read(f.vendor.secret,id,'vendor');assert.equal('phone' in vendorView!,false);assert.equal('address' in vendorView!,false);
  await assert.rejects(f.ship.read(f.outsider.secret,id,'vendor'),{code:'NOT_FOUND'});
  await f.ship.advance(f.vendor.secret,id,{version:6,note:reason},'prepare','vendor');
  await f.ship.advance(f.vendor.secret,id,{version:7,note:reason},'ready','vendor');
  await f.ship.advance(f.admin.secret,id,{version:8,note:reason,assignedTo:f.admin.id,trackingReference:'DISPATCH-1'},'dispatch','admin');
  await f.ship.advance(f.admin.secret,id,{version:9,note:reason},'delivery-failed','admin');
  await f.ship.advance(f.admin.secret,id,{version:10,note:reason,assignedTo:f.admin.id,trackingReference:'DISPATCH-2'},'dispatch','admin');
  const proof=await f.files.create(f.admin.secret,'proof',await image());await f.files.review(f.other.secret,proof.id,{status:'approved',note:reason});
  await f.ship.advance(f.admin.secret,id,{version:11,note:reason,proofId:proof.id,proofChecked:true},'delivered','admin');
  assert.ok((await f.files.read(f.customer.secret,proof.id)).length>0);
  await assert.rejects(f.files.read(f.outsider.secret,proof.id),{code:'NOT_FOUND'});
  await f.remedy.change(f.customer.secret,id,{version:12,note:reason,kind:'return'},'request-remedy');
  await f.remedy.change(f.admin.secret,id,{version:13,note:reason,decision:'approved'},'review-remedy');
  await f.ship.advance(f.admin.secret,id,{version:14,note:reason,proofId:proof.id,proofChecked:true},'returned','admin');
  await refunds(f.db).change(f.admin.secret,id,{version:15,note:reason,paymentId,bankReference:'RETURN-REFUND',amountKobo:13000,bankRefundChecked:true},'record-refund');
  const results=await Promise.allSettled([f.remedy.change(f.admin.secret,id,{version:16,note:reason,restockQuantity:1,stockChecked:true},'close-remedy'),f.remedy.change(f.admin.secret,id,{version:16,note:reason,restockQuantity:1,stockChecked:true},'close-remedy')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await f.db.query('SELECT stock_quantity FROM product_variants')).rows[0].stock_quantity,1);
  assert.equal((await f.api.detail(f.customer.secret,id,'customer')).state,'refunded');
 }finally{await f.db.close();}
});
test('receipt correction freezes fulfilment until bank reconciliation; paid cancellation needs physical inspection',async()=>{
 const f=await setup();try {
  const {id,paymentId}=await paid(f);
  await f.remedy.change(f.admin.secret,id,{version:6,note:reason,paymentId,requestId:randomUUID(),correctedKobo:12000,bankChecked:true},'correct-receipt');
  await assert.rejects(f.ship.advance(f.vendor.secret,id,{version:7,note:reason},'prepare','vendor'),{code:'ORDER_BLOCKED'});
  await assert.rejects(f.remedy.change(f.admin.secret,id,{version:7,note:reason,bankChecked:true},'reconcile'),{code:'PAYMENT_MISMATCH'});
  const top=await f.pay.change(f.admin.secret,id,{version:7,bankReference:'TOP-UP',receivedKobo:1000,receiptNote:reason},'record-payment');
  await f.remedy.change(f.admin.secret,id,{version:8,note:reason,bankChecked:true},'reconcile');
  await f.remedy.change(f.customer.secret,id,{version:9,note:reason,kind:'cancellation'},'request-remedy');
  await f.remedy.change(f.admin.secret,id,{version:10,note:reason,decision:'approved'},'review-remedy');
  await refunds(f.db).change(f.admin.secret,id,{version:11,note:reason,paymentId,bankReference:'REFUND-A',amountKobo:12000,bankRefundChecked:true},'record-refund');
  await refunds(f.db).change(f.admin.secret,id,{version:12,note:reason,paymentId:top.paymentId,bankReference:'REFUND-B',amountKobo:1000,bankRefundChecked:true},'record-refund');
  await assert.rejects(f.remedy.change(f.admin.secret,id,{version:13,note:reason,restockQuantity:1},'close-remedy'),{code:'STOCK_CHECK_REQUIRED'});
  await f.remedy.change(f.admin.secret,id,{version:13,note:reason,restockQuantity:0,stockChecked:true},'close-remedy');
  assert.equal((await f.db.query('SELECT stock_quantity FROM product_variants')).rows[0].stock_quantity,0);
  assert.equal(Number((await f.db.query('SELECT received_kobo FROM payment_records WHERE id=$1',[paymentId])).rows[0].received_kobo),13000);
 }finally{await f.db.close();}
});
test('sanitised uploads, private documents, vendor profile review and upload HTTP bounds',async()=>{
 const f=await setup();try {
  await assert.rejects(f.files.create(f.vendor.secret,'product',Buffer.from('<svg><script>alert(1)</script></svg>')),{code:'INVALID_IMAGE'});
  await assert.rejects(f.files.create(f.vendor.secret,'product',Buffer.alloc(5242881)),{code:'UPLOAD_TOO_LARGE'});
  const doc=await f.files.create(f.vendor.secret,'document',await image());
  await assert.rejects(f.files.read(f.customer.secret,doc.id),{code:'NOT_FOUND'});
  await f.files.review(f.admin.secret,doc.id,{status:'approved',note:reason});
  const profile=vendorProfile(f.db,key,origin);
  const result=await profile.save(f.vendor.secret,{version:0,documentId:doc.id,phone:'+2348012345678',backupPhone:'+2348098765432',pickupAddress:'Updated pickup point in Abuja',windowStart:new Date().toISOString(),windowEnd:new Date(Date.now()+86400000).toISOString()});
  assert.equal(result.reviewRequired,true);
  assert.equal((await f.db.query('SELECT status FROM vendor_applications WHERE user_id=$1',[f.vendor.id])).rows[0].status,'changes_requested');
  const response=await handleIdentity(new Request(`${origin}/api/uploads?purpose=product`,{method:'POST',headers:{origin,cookie:`fendor_session=${f.customer.secret}`},body:new Uint8Array(await image())}),['uploads'],{db:f.db,settings:{origin,outboxKey:key,secure:false}});
  assert.equal(response.status,201);
 }finally{await f.db.close();}
});
test('support isolation, internal notes, replies and idempotent case creation',async()=>{
 const f=await setup();try {
  const svc=support(f.db,key,origin),input={requestId:randomUUID(),subject:'Help with gift order',message:'Please help me change the gift details.'};
  const ticket=await svc.create(f.customer.secret,input);assert.equal((await svc.create(f.customer.secret,input)).id,ticket.id);
  await assert.rejects(svc.read(f.outsider.secret,ticket.id,false),{code:'FORBIDDEN'});
  await svc.update(f.admin.secret,ticket.id,{version:0,message:'Internal operator investigation',internal:true,status:'open',assignedTo:f.admin.id},true);
  await svc.update(f.admin.secret,ticket.id,{version:1,message:'We are checking your request.',internal:false,status:'waiting_customer',assignedTo:f.admin.id},true);
  const customer=await svc.read(f.customer.secret,ticket.id,false);assert.equal(customer.messages.length,2);assert.ok(customer.messages.every(m=>m.internal===false));
  assert.equal((await svc.read(f.admin.secret,ticket.id,true)).messages.length,3);
  await svc.update(f.customer.secret,ticket.id,{version:2,message:'Thank you. Please proceed.'},false);
  assert.equal((await svc.read(f.customer.secret,ticket.id,false)).status,'open');
 }finally{await f.db.close();}
});
test('deadline escalation and durable notifications deduplicate; worker retries failed mail',async()=>{
 const f=await setup();try {
  const order=await f.api.create(f.customer.secret,f.input());await f.db.query("UPDATE order_requests SET availability_deadline=now()-interval '1 minute' WHERE id=$1",[order.id]);
  await produceNotifications(f.db,key,origin);const count=(await f.db.query('SELECT id FROM notifications')).rows.length;
  await produceNotifications(f.db,key,origin);assert.equal((await f.db.query('SELECT id FROM notifications')).rows.length,count);
  assert.ok((await f.db.query('SELECT escalated_at FROM order_requests WHERE id=$1',[order.id])).rows[0].escalated_at);
  const first=await runWorker(f.db,key,origin,async()=>{throw Error('Test SMTP offline');});assert.ok('failures' in first&&first.failures!>0);
  await f.db.query('UPDATE email_outbox SET next_attempt_at=now()');const sent:string[]=[];
  await runWorker(f.db,key,origin,async mail=>{sent.push(mail.subject);});assert.ok(sent.length>0);
  assert.ok((await f.db.query("SELECT last_succeeded FROM worker_health WHERE name='operations'")).rows[0].last_succeeded);
 }finally{await f.db.close();}
});
