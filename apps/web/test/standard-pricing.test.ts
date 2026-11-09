import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './order-fixture.ts';
import {checkout} from '../src/lib/server/checkout.ts';
test('customer checkout calculates stored prices without admin quote and freezes accepted total',async()=>{
 const f=await fixture();try{
  const p=checkout(f.db);let order=await f.api.create(f.customer.secret,f.input());
  await f.db.query("INSERT INTO packaging_options(id,name,price_kobo) VALUES('wrap','Gift wrap',50000)");
  await assert.rejects(p.change(f.customer.secret,order.id,{version:0,packagingId:'wrap'},'auto-quote'),{code:'RESERVATION_EXPIRED'});
  order=await f.api.change(f.vendor.secret,order.id,{version:0},'reserve');
  await f.seedDelivery(order.id);
  await assert.rejects(p.change(f.customer.secret,order.id,{version:order.version,packagingId:'wrap'},'auto-quote'),{code:'DELIVERY_REQUIRED'});
  await f.db.query('UPDATE delivery_zones SET fee_kobo=100000');
  await assert.rejects(p.change(f.other.secret,order.id,{version:order.version,packagingId:'wrap'},'auto-quote'),{code:'NOT_FOUND'});
  await p.change(f.customer.secret,order.id,{version:order.version,packagingId:'wrap'},'auto-quote');
  const s=await p.summary(f.customer.secret,order.id);const q=s.quote! as {id:string;details:{totalKobo:number}};
  assert.equal(q.details.totalKobo,160000);
  await p.change(f.customer.secret,order.id,{version:s.version,quoteId:q.id,totalKobo:160000},'accept-quote');
  await f.db.query('UPDATE delivery_zones SET fee_kobo=200000');
  const accepted=await p.summary(f.customer.secret,order.id);
  assert.equal((accepted.quote!.details as {totalKobo:number}).totalKobo,160000);
  assert.equal(accepted.state,'awaiting_payment');assert.equal(accepted.orderConfirmed,false);
 }finally{await f.db.close();}
});
