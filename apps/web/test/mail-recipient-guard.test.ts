import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './order-fixture.ts';
import {notify} from '../src/lib/server/notifications.ts';
import {seal} from '../src/lib/server/security.ts';
import {deliverOne,drainMail,isPlaceholderEmail} from '../src/lib/server/mail.ts';
test('reserved recipients are recognised without blocking genuine domains',()=>{
 for(const address of ['customer.localcheckout@example.com','vendor@EXAMPLE.ORG','admin@sub.example.net','user@localhost','user@app.test','user@bad.invalid','dashboard-demo@fendor.local','admin@FENDOR.LOCAL','user@sub.fendor.local','user@fendor.local.'])assert.equal(isPlaceholderEmail(address),true);
 for(const address of ['officialfendora@gmail.com','customer@examplecompany.com','user@localbusiness.com'])assert.equal(isPlaceholderEmail(address),false);
});

test('the immediate fast path drains newly queued messages without waiting for the scheduled worker',async()=>{
 const f=await fixture(),key='ab'.repeat(32);try{
  await f.db.query('DELETE FROM email_outbox');
  for(const subject of ['Verify now','Admin action'])await f.db.query('INSERT INTO email_outbox(id,payload) VALUES($1,$2)',[randomUUID(),seal({to:'officialfendora@gmail.com',purpose:'notification',subject,text:'Open Fendora.'},key)]);
  const delivered:string[]=[];
  const result=await drainMail(f.db,key,async mail=>{delivered.push(mail.subject);},5);
  assert.deepEqual(result,{sent:2,failures:0,suppressed:0});
  assert.deepEqual(delivered,['Verify now','Admin action']);
  assert.equal((await f.db.query('SELECT id FROM email_outbox WHERE sent_at IS NULL')).rows.length,0);
 }finally{await f.db.close();}
});
test('SMTP policy suppresses placeholders without claiming delivery and continues to real recipients',async()=>{
 const f=await fixture(),key='ab'.repeat(32);try{
 await f.db.query('DELETE FROM email_outbox');
 const id=randomUUID();
 await f.db.query('INSERT INTO email_outbox(id,payload) VALUES($1,$2)',[id,seal({to:'dashboard-demo@fendor.local',purpose:'notification',subject:'Test',text:'Test'},key)]);
 let calls=0;
 assert.equal(await deliverOne(f.db,key,async()=>{calls++;}),'suppressed');assert.equal(calls,0);
 const row=(await f.db.query('SELECT sent_at,attempts,payload FROM email_outbox WHERE id=$1',[id])).rows[0];assert.equal(row.sent_at,null);assert.equal(row.attempts,0);assert.ok(row.payload);
 assert.equal(await deliverOne(f.db,key,async()=>{calls++;}),'empty');
 await f.db.query('INSERT INTO email_outbox(id,payload) VALUES($1,$2)',[randomUUID(),seal({to:'officialfendora@gmail.com',purpose:'notification',subject:'Test',text:'Test'},key)]);
 assert.equal(await deliverOne(f.db,key,async()=>{calls++;}),'sent');assert.equal(calls,1);
 }finally{await f.db.close();}
});

test('routine updates stay in-app while important updates queue exactly one email',async()=>{
 const f=await fixture(),key='ab'.repeat(32);try{
 await f.db.query('DELETE FROM email_outbox');
 await f.db.transaction(tx=>notify(tx,f.customer.id,'saved-details','Details saved','Saved your details',key,'http://localhost:4173',false));
 assert.equal((await f.db.query('SELECT id FROM email_outbox')).rows.length,0);
 assert.equal((await f.db.query("SELECT id FROM notifications WHERE dedupe_key='saved-details'")).rows.length,1);
 await f.db.transaction(tx=>notify(tx,f.customer.id,'paid-update','Payment verified','Your order is confirmed',key,'http://localhost:4173'));
 await f.db.transaction(tx=>notify(tx,f.customer.id,'paid-update','Payment verified','Your order is confirmed',key,'http://localhost:4173'));
 assert.equal((await f.db.query('SELECT id FROM email_outbox')).rows.length,1);
 }finally{await f.db.close();}
});

test('identity mail contains matching branded HTML and plain text without exposing tokens in logs',async()=>{
 const f=await fixture(),key='ab'.repeat(32);try{
  await f.db.query('DELETE FROM email_outbox');
  const link='https://fendor-beta.netlify.app/verify-email#token='+ 'a'.repeat(43);
  await f.db.query('INSERT INTO email_outbox(id,payload) VALUES($1,$2)',[randomUUID(),seal({to:'customer@examplecompany.com',purpose:'verify',url:link},key)]);
  let delivered:{subject:string;text:string;html?:string}|undefined;
  assert.equal(await deliverOne(f.db,key,async mail=>{delivered=mail;},false),'sent');
  assert.equal(delivered?.subject,'Verify your Fendora email');
  assert.match(delivered?.text??'',/single-use link expires in 24 hours/);
  assert.match(delivered?.text??'',/Fendora Innovations Limited/);
  assert.match(delivered?.html??'',/>Verify my email</);
  assert.match(delivered?.html??'',/fendor-beta\.netlify\.app\/verify-email#token=/);
  assert.match(delivered?.html??'',/Security notice/);
  assert.doesNotMatch(delivered?.html??'',/localhost/);
 }finally{await f.db.close();}
});

test('password reset mail states its shorter expiry and security consequence',async()=>{
 const f=await fixture(),key='ab'.repeat(32);try{
  await f.db.query('DELETE FROM email_outbox');
  await f.db.query('INSERT INTO email_outbox(id,payload) VALUES($1,$2)',[randomUUID(),seal({to:'customer@examplecompany.com',purpose:'reset',url:'https://fendor-beta.netlify.app/reset-password#token='+ 'b'.repeat(43)},key)]);
  let delivered:{text:string;html?:string}|undefined;
  await deliverOne(f.db,key,async mail=>{delivered=mail;},false);
  assert.match(delivered?.text??'',/expires in 1 hour/);
  assert.match(delivered?.text??'',/Your password will not change/);
  assert.match(delivered?.html??'',/>Reset my password</);
 }finally{await f.db.close();}
});
