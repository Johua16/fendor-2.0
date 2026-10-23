import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { testDatabase } from './database.ts';
import { migrate } from '../src/lib/server/migrations.ts';
import { orders } from '../src/lib/server/orders.ts';
import { handleIdentity } from '../src/lib/server/http-identity.ts';
import { digest,token } from '../src/lib/server/security.ts';
async function fixture() {
  const db=await testDatabase();await migrate(db,resolve('../../server/db'));
  async function user(role:string) {
    const id=randomUUID(),secret=token();
    await db.query("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES($1,$2,'fixture',now())",[id,`${id}@example.com`]);
    await db.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)',[id,role]);
    await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')",[digest(secret),id]);
    if(role==='vendor') await db.query("INSERT INTO vendor_applications(id,user_id,business_name,status) VALUES($1,$2,'Gifts','approved')",[randomUUID(),id]);
    return {id,secret};
  }
  const customer=await user('customer'),other=await user('customer'),vendor=await user('vendor'),outsider=await user('vendor'),admin=await user('admin');
  const productId=randomUUID(),variantId=randomUUID();
  await db.query("INSERT INTO products(id,vendor_user_id,title,status) VALUES($1,$2,'Hamper','approved')",[productId,vendor.id]);
  await db.query("INSERT INTO product_variants(id,product_id,vendor_user_id,sku,price_kobo,stock_quantity) VALUES($1,$2,$3,'ONE',10000,1)",[variantId,productId,vendor.id]);
  let clock=Date.now();const api=orders(db,{reservationMinutes:30,now:()=>clock});
  const input=()=>({clientRequestId:randomUUID(),productVariantId:variantId,quantity:1});
  return {db,api,customer,other,vendor,outsider,admin,productId,variantId,input,advance:()=>{clock+=31*60000;}};
}
test('request retries, private personalisation, ownership and cancellation release',async()=>{
  const f=await fixture();const {db,api,customer,other,vendor,outsider,input}=f;
  try {
    const data=input();const order=await api.create(customer.secret,data);
    const replay=await api.create(customer.secret,data);assert.equal(replay.id,order.id);
    await assert.rejects(api.create(customer.secret,{...data,quantity:2}),{code:'IDEMPOTENCY_CONFLICT'});
    await assert.rejects(api.detail(other.secret,order.id,'customer'),{code:'NOT_FOUND'});
    await assert.rejects(api.change(outsider.secret,order.id,{version:0},'reserve'),{code:'NOT_FOUND'});
    await api.change(customer.secret,order.id,{version:0,giftDetails:{recipientName:'Private name',giftMessage:'A private message'}},'personalise');
    const view=await api.detail(vendor.secret,order.id,'vendor');assert.equal('giftDetails' in view,false);assert.equal('customer_id' in view,false);
    const held=await api.change(vendor.secret,order.id,{version:1},'reserve');assert.equal(held.state,'reserved');assert.equal(held.orderConfirmed,false);
    assert.equal((await db.query<{reserved_quantity:number}>('SELECT reserved_quantity FROM product_variants')).rows[0].reserved_quantity,1);
    await assert.rejects(api.change(vendor.secret,order.id,{version:1},'reserve'),{code:'STALE_VERSION'});
    await api.change(customer.secret,order.id,{version:2},'cancel');
    assert.equal((await db.query<{reserved_quantity:number}>('SELECT reserved_quantity FROM product_variants')).rows[0].reserved_quantity,0);
    await assert.rejects(api.change(customer.secret,order.id,{version:2},'cancel'),{code:'STALE_VERSION'});
    assert.equal((await db.query('SELECT * FROM order_events')).rows.length,4);
  } finally {await db.close();}
});
test('competing requests cannot oversell; expiry releases once and permits reconfirmation',async()=>{
  const f=await fixture();const {db,api,customer,other,vendor,input}=f;
  try {
    const a=await api.create(customer.secret,input()),b=await api.create(other.secret,input());
    const results=await Promise.allSettled([api.change(vendor.secret,a.id,{version:0},'reserve'),api.change(vendor.secret,b.id,{version:0},'reserve')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.code,'INSUFFICIENT_STOCK');
    const winner=results[0].status==='fulfilled'?a:b,owner=winner.id===a.id?customer:other;
    f.advance();assert.equal((await api.detail(owner.secret,winner.id,'customer')).reservationExpired,true);
    assert.equal(await api.expireBatch(),1);assert.equal(await api.expireBatch(),0);
    const expired=await api.detail(owner.secret,winner.id,'customer');assert.equal(expired.state,'checking_availability');assert.equal(expired.version,2);
    const renewed=await api.change(vendor.secret,winner.id,{version:2},'reserve');assert.equal(renewed.state,'reserved');
    await api.change(vendor.secret,winner.id,{version:3},'decline');
    assert.equal((await db.query<{reserved_quantity:number}>('SELECT reserved_quantity FROM product_variants')).rows[0].reserved_quantity,0);
    const event=(await db.query("SELECT actor_id FROM order_events WHERE event_type='reservation_expired'")).rows[0];assert.equal(event.actor_id,null);
  } finally {await db.close();}
});
test('HTTP guards, suspended vendors, missing policy and product changes',async()=>{
  const f=await fixture();const {db,api,customer,vendor,productId,input}=f;
  const settings={origin:'http://localhost:3000',secure:false,outboxKey:'ab'.repeat(32)};
  async function call(path:string,body:unknown,origin=settings.origin) {
    return handleIdentity(new Request(`${settings.origin}/api/${path}`,{method:'POST',headers:{origin,'content-type':'application/json',cookie:`fendor_session=${customer.secret}`},body:JSON.stringify(body)}),path.split('/'),{db,settings});
  }
  try {
    assert.equal((await call('orders',input(),'https://evil.example')).status,403);
    assert.equal((await call('orders',{...input(),vendorId:vendor.id})).status,400);
    const created=await call('orders',input());assert.equal(created.status,201);const {order}=await created.json();
    await assert.rejects(orders(db).change(vendor.secret,order.id,{version:0},'reserve'),{code:'RESERVATION_POLICY_REQUIRED'});
    await db.query('UPDATE products SET version=version+1,title=$2 WHERE id=$1',[productId,'New hamper']);
    await assert.rejects(api.change(vendor.secret,order.id,{version:0},'reserve'),{code:'PRODUCT_CHANGED'});
    const snapshot=await api.detail(customer.secret,order.id,'customer');assert.equal(snapshot.product.title,'Hamper');
    await db.query("UPDATE vendor_applications SET status='suspended' WHERE user_id=$1",[vendor.id]);
    await assert.rejects(api.create(customer.secret,input()),{code:'NOT_FOUND'});
    await assert.rejects(api.change(vendor.secret,order.id,{version:0},'decline'),{code:'VENDOR_NOT_APPROVED'});
    assert.equal((await call(`orders/${order.id}/verify-payment`,{version:0})).status,404);
  } finally {await db.close();}
});
