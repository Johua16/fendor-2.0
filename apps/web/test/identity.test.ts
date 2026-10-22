import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { testDatabase } from './database.ts';
import { handleIdentity } from '../src/lib/server/http-identity.ts';
import { deliverOne } from '../src/lib/server/mail.ts';
import { identity } from '../src/lib/server/identity.ts';
import { migrate } from '../src/lib/server/migrations.ts';
import { unseal, digest } from '../src/lib/server/security.ts';

test('database-backed identity and vendor lifecycle', async () => {
  const db = await testDatabase();
  let time = Date.now();
  const key = 'ab'.repeat(32);
  const api = identity(db, {origin:'http://localhost:3000',outboxKey:key,now:()=>time});
  const pass='A long secure passphrase!';
  async function link(address:string, purpose:string) {
    const rows=(await db.query<{payload:string}>('SELECT payload FROM email_outbox ORDER BY created_at DESC')).rows;
    for(const row of rows) {
      const mail=unseal(row.payload,key) as {to:string;purpose:string;url:string};
      if(mail.to===address && mail.purpose===purpose) return new URLSearchParams(new URL(mail.url).hash.slice(1)).get('token')!;
    }
    throw Error('Missing email');
  }
  try {
    await migrate(db,resolve('../../server/db'));
    await migrate(db,resolve('../../server/db'));
    await api.signup({email:'vendor@example.com',password:pass,fullName:'Vendor Test'});
    const vendor=await api.login({email:'vendor@example.com',password:pass});
    assert.deepEqual(vendor.user.roles,['customer']);
    const application={businessName:'Test Gifts',businessLocation:'Abuja, Nigeria',country:'NG',registrationNumber:'TEST-123'};
    await assert.rejects(api.apply(vendor.secret,application),{code:'EMAIL_UNVERIFIED'});
    const verify=await link('vendor@example.com','verify');
    await api.consume({token:verify},'verify');
    await assert.rejects(api.consume({token:verify},'verify'),{code:'INVALID_TOKEN'});
    const submitted=await api.apply(vendor.secret,application);
    await assert.rejects(api.vendorAccess(vendor.secret),{code:'VENDOR_NOT_APPROVED'});
    await assert.rejects(api.review(vendor.secret,String(submitted.id),{decision:'approved',note:'Checked'}),{code:'FORBIDDEN'});
    await api.signup({email:'admin@example.com',password:pass,fullName:'Admin Test'});
    await api.consume({token:await link('admin@example.com','verify')},'verify');
    const admin=await api.login({email:'admin@example.com',password:pass});
    await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",[admin.user.id]);
    await api.review(admin.secret,String(submitted.id),{decision:'changes_requested',note:'Clarify location'});
    await api.apply(vendor.secret,application);
    await api.review(admin.secret,String(submitted.id),{decision:'approved',note:'Reviewed documents manually'});
    assert.equal((await api.vendorAccess(vendor.secret)).allowed,true);
    await assert.rejects(api.review(admin.secret,String(submitted.id),{decision:'approved',note:'Again'}),{code:'INVALID_STATE'});
    await api.review(admin.secret,String(submitted.id),{decision:'suspended',note:'Review required'});
    await assert.rejects(api.vendorAccess(vendor.secret),{code:'VENDOR_NOT_APPROVED'});
    assert.equal((await db.query('SELECT * FROM vendor_review_events')).rows.length,5);
    const stored=(await db.query<{token_hash:string}>('SELECT token_hash FROM sessions WHERE user_id=$1',[vendor.user.id])).rows[0];
    assert.equal(stored.token_hash,digest(vendor.secret));
    await api.requestEmail({email:'vendor@example.com'},'reset');
    const reset=await link('vendor@example.com','reset');
    await api.consume({token:reset,password:'A new secure passphrase!'},'reset');
    await assert.rejects(api.me(vendor.secret),{code:'UNAUTHENTICATED'});
    await assert.rejects(api.consume({token:reset,password:pass},'reset'),{code:'INVALID_TOKEN'});
    await assert.rejects(api.login({email:'vendor@example.com',password:pass}),{code:'INVALID_CREDENTIALS'});
    const fresh=await api.login({email:'vendor@example.com',password:'A new secure passphrase!'});
    const settings={origin:'http://localhost:3000',outboxKey:key,secure:false};
    const request=(origin:string,body:unknown)=>new Request('http://localhost:3000/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await handleIdentity(request('https://evil.example',{}),['auth','login'],{db,settings})).status,403);
    assert.equal((await handleIdentity(request(settings.origin,{email:'x@y.com',password:pass,role:'admin'}),['auth','signup'],{db,settings})).status,400);
    const response=await handleIdentity(request(settings.origin,{email:'vendor@example.com',password:'A new secure passphrase!'}),['auth','login'],{db,settings});
    assert.equal(response.status,200);
    assert.match(response.headers.get('set-cookie')!,/HttpOnly; SameSite=Lax/);
    assert.equal('secret' in await response.json(),false);
    assert.equal(await deliverOne(db,key,async()=>{throw Error('offline')}),'failed');
    assert.equal(await deliverOne(db,key,async mail=>{assert.match(mail.text,/http:\/\/localhost/);}), 'sent');
    assert.equal((await db.query("SELECT * FROM email_outbox WHERE sent_at IS NOT NULL AND payload='' ")).rows.length,1);
    time+=8*86400000;
    await assert.rejects(api.me(fresh.secret),{code:'UNAUTHENTICATED'});
  } finally {await db.close();}
});
