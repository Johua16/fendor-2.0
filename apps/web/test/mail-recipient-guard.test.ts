import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './order-fixture.ts';
import {notify} from '../src/lib/server/notifications.ts';
import {seal} from '../src/lib/server/security.ts';
import {deliverOne,isPlaceholderEmail} from '../src/lib/server/mail.ts';
test('reserved recipients are recognised without blocking genuine domains',()=>{
 for(const address of ['customer.localcheckout@example.com','vendor@EXAMPLE.ORG','admin@sub.example.net','user@localhost','user@app.test','user@bad.invalid','dashboard-demo@fendor.local','admin@FENDOR.LOCAL','user@sub.fendor.local','user@fendor.local.'])assert.equal(isPlaceholderEmail(address),true);
 for(const address of ['officialfendora@gmail.com','customer@examplecompany.com','user@localbusiness.com'])assert.equal(isPlaceholderEmail(address),false);
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
