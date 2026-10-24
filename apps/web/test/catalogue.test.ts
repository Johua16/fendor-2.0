import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { testDatabase } from './database.ts';
import { migrate, checkDatabase } from '../src/lib/server/migrations.ts';
import { catalogue } from '../src/lib/server/catalogue.ts';
import { handleIdentity } from '../src/lib/server/http-identity.ts';
import { digest, token } from '../src/lib/server/security.ts';
import type { Database } from '../src/lib/server/database.ts';

async function account(db:Database,role:string) {
  const id=randomUUID(),secret=token();
  await db.query('INSERT INTO users(id,email,password_hash,email_verified_at) VALUES($1,$2,$3,now())',[id,`${id}@example.com`,'fixture-no-login']);
  await db.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)',[id,role]);
  await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')",[digest(secret),id]);
  if(role==='vendor') await db.query("INSERT INTO vendor_applications(id,user_id,business_name,status) VALUES($1,$2,'Test Gifts','approved')",[randomUUID(),id]);
  return {id,secret};
}
const input={title:'Celebration hamper',description:'A selection of gifts in a presentation box.',category:'hampers',imagePath:'/media/catalogue/hamper.webp',sku:'HAMPER-1',priceKobo:2500000,stockQuantity:5};
async function fixture() {
  const db=await testDatabase(); await migrate(db,resolve('../../server/db')); await checkDatabase(db);
  return {db,api:catalogue(db),vendor:await account(db,'vendor'),other:await account(db,'vendor'),admin:await account(db,'admin'),customer:await account(db,'customer')};
}
test('catalogue moderation, ownership, edit invalidation and vendor suspension',async()=>{
  const {db,api,vendor,other,admin,customer}=await fixture();
  try {
    await assert.rejects(api.create(customer.secret,input),{code:'FORBIDDEN'});
    const product=await api.create(vendor.secret,input);
    assert.equal(product.status,'draft');
    assert.equal((await api.list(new URLSearchParams())).products.length,0);
    await assert.rejects(api.detail(product.id),{code:'NOT_FOUND'});
    await assert.rejects(api.mutate(other.secret,product.id,{...input,version:0},'edit'),{code:'NOT_FOUND'});
    assert.equal((await api.list(new URLSearchParams(),other.secret,'vendor')).products.length,0);
    await api.mutate(vendor.secret,product.id,{version:0},'submit');
    await assert.rejects(api.mutate(customer.secret,product.id,{version:1,decision:'approved',note:'No'},'review'),{code:'FORBIDDEN'});
    await api.mutate(admin.secret,product.id,{version:1,decision:'approved',note:'Reviewed content and image'},'review');
    const visible=await api.detail(product.id);
    assert.equal(visible.priceKobo,2500000);
    assert.equal(visible.availability,'confirmation_required');
    for(const field of ['vendor_user_id','sku','stockQuantity','reviewNote','email']) assert.equal(field in visible,false);
    await api.mutate(vendor.secret,product.id,{...input,title:'Updated hamper',version:2},'edit');
    await assert.rejects(api.detail(product.id),{code:'NOT_FOUND'});
    await api.mutate(vendor.secret,product.id,{version:3},'submit');
    await api.mutate(admin.secret,product.id,{version:4,decision:'approved',note:'Updated listing checked'},'review');
    await db.query("UPDATE vendor_applications SET status='suspended' WHERE user_id=$1",[vendor.id]);
    await assert.rejects(api.detail(product.id),{code:'NOT_FOUND'});
    assert.equal((await api.list(new URLSearchParams())).products.length,0);
    await assert.rejects(api.mutate(vendor.secret,product.id,{version:5},'pause'),{code:'VENDOR_NOT_APPROVED'});
    assert.equal((await db.query('SELECT * FROM product_events')).rows.length,6);
  } finally {await db.close();}
});
test('catalogue conflicts, invalid data, rollback, reservations and concurrent updates',async()=>{
  const {db,api,vendor,admin}=await fixture();
  try {
    await assert.rejects(api.create(vendor.secret,{...input,priceKobo:1.5}),{code:'INVALID_INPUT'});
    await assert.rejects(api.create(vendor.secret,{...input,imagePath:'https://untrusted.example/image.svg'}),{code:'INVALID_INPUT'});
    const p=await api.create(vendor.secret,input);
    await assert.rejects(api.create(vendor.secret,input),{code:'SKU_EXISTS'});
    const other=await api.create(vendor.secret,{...input,sku:'HAMPER-2',imagePath:null});
    await assert.rejects(api.mutate(vendor.secret,other.id,{version:0},'submit'),{code:'IMAGE_REQUIRED'});
    const upload=randomUUID();
    await db.query("INSERT INTO uploads(id,owner_id,purpose,payload,bytes) VALUES($1,$2,'product','fixture',1)",[upload,vendor.id]);
    const pending=await api.create(vendor.secret,{...input,sku:'HAMPER-UPLOAD',imagePath:`/api/media/${upload}`});
    await assert.rejects(api.mutate(vendor.secret,pending.id,{version:0},'submit'),{code:'IMAGE_REVIEW_PENDING'});
    await db.query("UPDATE uploads SET status='approved' WHERE id=$1",[upload]);
    assert.equal((await api.mutate(vendor.secret,pending.id,{version:0},'submit')).status,'under_review');
    await assert.rejects(api.mutate(vendor.secret,other.id,{...input,title:'Must roll back',version:0},'edit'),{code:'SKU_EXISTS'});
    assert.equal((await api.detail(other.id,vendor.secret,'vendor')).title,input.title);
    const results=await Promise.allSettled([
      api.mutate(vendor.secret,p.id,{...input,title:'First edit',version:0},'edit'),
      api.mutate(vendor.secret,p.id,{...input,title:'Second edit',version:0},'edit')
    ]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    const rejected=results.find(r=>r.status==='rejected') as PromiseRejectedResult;
    assert.equal(rejected.reason.code,'STALE_VERSION');
    await db.query('UPDATE product_variants SET reserved_quantity=1 WHERE product_id=$1',[p.id]);
    await assert.rejects(api.mutate(vendor.secret,p.id,{...input,version:1},'edit'),{code:'ACTIVE_RESERVATIONS'});
    await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",[vendor.id]);
    await api.mutate(vendor.secret,p.id,{version:1},'submit');
    await assert.rejects(api.mutate(vendor.secret,p.id,{version:2,decision:'approved',note:'Self'},'review'),{code:'SELF_REVIEW'});
    await api.mutate(admin.secret,p.id,{version:2,decision:'rejected',note:'Needs revision'},'review');
    await assert.rejects(api.mutate(admin.secret,p.id,{version:3,decision:'approved',note:'Bad transition'},'review'),{code:'INVALID_STATE'});
  } finally {await db.close();}
});
test('catalogue HTTP contract, pagination, filtering and CSRF',async()=>{
  const {db,api,vendor,admin}=await fixture();
  const settings={origin:'http://localhost:3000',outboxKey:'ab'.repeat(32),secure:false};
  const call=(path:string,method='GET',body?:unknown,secret?:string,origin=settings.origin)=>handleIdentity(new Request(`${settings.origin}/api/${path}`,{
    method,headers:{origin,'content-type':'application/json',...(secret?{cookie:`fendor_session=${secret}`}:{})},...(body?{body:JSON.stringify(body)}:{})
  }),path.split('?')[0].split('/'),{db,settings});
  try {
    assert.equal((await call('vendor/products','POST',input,vendor.secret,'https://other.example')).status,403);
    assert.equal((await call('vendor/products','POST',{...input,vendorId:vendor.id},vendor.secret)).status,400);
    assert.equal((await call('vendor/products','POST',input)).status,401);
    for(let i=0;i<3;i++) {
      const response=await call('vendor/products','POST',{...input,sku:`HTTP-${i}`},vendor.secret);
      assert.equal(response.status,201);
      const {product}=await response.json();
      await api.mutate(vendor.secret,product.id,{version:0},'submit');
      await api.mutate(admin.secret,product.id,{version:1,decision:'approved',note:'Reviewed'},'review');
    }
    const first=await (await call('products?limit=2')).json();
    assert.equal(first.products.length,2); assert.ok(first.nextCursor);
    const second=await (await call(`products?limit=2&after=${first.nextCursor}`)).json();
    assert.equal(second.products.length,1);assert.equal(second.nextCursor,null);
    assert.equal(new Set([...first.products,...second.products].map(p=>p.id)).size,3);
    assert.equal((await (await call('products?category=flowers')).json()).products.length,0);
    assert.equal((await call('products?status=draft')).status,400);
    assert.equal((await call('products?limit=-1')).status,400);
    assert.equal((await call('products/not-a-uuid')).status,400);
    assert.equal((await call('admin/products')).status,401);
    const detail=await call(`products/${first.products[0].id}`);
    assert.equal(detail.headers.get('cache-control'),'no-store');
    assert.equal(detail.status,200);
  } finally {await db.close();}
});
