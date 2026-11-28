import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createEmailTransport,EmailProviderError} from '../src/lib/server/email-provider.ts';
import {deliverOne} from '../src/lib/server/mail.ts';
import {brevoDeliveryStatus,brevoWebhookAuthorised,recordBrevoDeliveryEvent} from '../src/lib/server/brevo-webhook.ts';
import {seal} from '../src/lib/server/security.ts';
import {fixture} from './order-fixture.ts';

const environment={EMAIL_PROVIDER:'brevo',BREVO_API_KEY:'test-secret-never-log',EMAIL_FROM_ADDRESS:'notifications@fendoraworld.com',EMAIL_FROM_NAME:'Fendora',EMAIL_DAILY_LIMIT:'300',EMAIL_DAILY_RESERVE:'30'};
test('Brevo transport sends the official API payload without placing the key in the message',async()=>{
 let requestUrl='',requestInit:RequestInit|undefined;
 const transport=createEmailTransport(environment,async(url,input)=>{requestUrl=String(url);requestInit=input;return new Response(JSON.stringify({messageId:'brevo-message-1'}),{status:201,headers:{'content-type':'application/json'}});});
 const result=await transport.send({to:'customer@examplecompany.com',subject:'Verify',text:'Plain text',html:'<p>Plain text</p>',replyTo:'support@fendoraworld.com'});
 assert.equal(requestUrl,'https://api.brevo.com/v3/smtp/email');assert.equal(result.messageId,'brevo-message-1');
 const body=JSON.parse(String(requestInit?.body));assert.deepEqual(body.sender,{name:'Fendora',email:'notifications@fendoraworld.com'});assert.equal(body.replyTo.email,'support@fendoraworld.com');assert.doesNotMatch(String(requestInit?.body),/test-secret-never-log/);
 assert.equal((requestInit?.headers as Record<string,string>)['api-key'],'test-secret-never-log');
});

test('Brevo rate limiting is classified for durable retry',async()=>{
 const transport=createEmailTransport(environment,async()=>new Response('{}',{status:429}));
 await assert.rejects(transport.send({to:'customer@examplecompany.com',subject:'Test',text:'Test'}),(error:unknown)=>error instanceof EmailProviderError&&error.code==='BREVO_RATE_LIMITED');
});

test('Brevo webhook authentication rejects missing or mismatched secrets',()=>{
 const secret='a'.repeat(32);assert.equal(brevoWebhookAuthorised(secret,secret),true);assert.equal(brevoWebhookAuthorised(secret,'b'.repeat(32)),false);assert.equal(brevoWebhookAuthorised(secret,undefined),false);assert.equal(brevoWebhookAuthorised('short','short'),false);
 assert.equal(brevoDeliveryStatus('hard_bounce'),'failed');assert.equal(brevoDeliveryStatus('soft-bounce'),'deferred');
});

test('daily reserve defers routine mail but still sends critical identity mail',async()=>{
 const f=await fixture(),key='ab'.repeat(32),policy={provider:'brevo' as const,dailyLimit:3,dailyReserve:1};try{
  await f.db.query('DELETE FROM email_outbox');
  await f.db.query("INSERT INTO email_outbox(id,payload,priority,provider,sent_at) VALUES($1,'',50,'brevo',now()),($2,'',50,'brevo',now())",[randomUUID(),randomUUID()]);
  const routine=randomUUID(),critical=randomUUID();
  await f.db.query('INSERT INTO email_outbox(id,payload,priority) VALUES($1,$2,50),($3,$4,100)',[routine,seal({to:'customer@examplecompany.com',purpose:'notification',subject:'Routine',text:'Routine'},key),critical,seal({to:'customer@examplecompany.com',purpose:'verify',url:'https://fendoraworld.com/verify-email#token='+'a'.repeat(43)},key)]);
  let calls=0;assert.equal(await deliverOne(f.db,key,async()=>{calls++;return {provider:'brevo',messageId:'critical-1',status:'accepted' as const};},false,{},policy),'sent');assert.equal(calls,1);
  assert.equal(await deliverOne(f.db,key,async()=>{calls++;},false,{},policy),'deferred');assert.equal(calls,1);
 }finally{await f.db.close();}
});

test('Brevo delivery events update idempotently and do not downgrade delivered mail',async()=>{
 const f=await fixture();try{
  const id=randomUUID();await f.db.query("INSERT INTO email_outbox(id,payload,provider,provider_message_id,provider_status,provider_status_at,sent_at) VALUES($1,'','brevo','message-1','accepted',to_timestamp(100),now())",[id]);
  await recordBrevoDeliveryEvent(f.db,{event:'delivered','message-id':'message-1',ts:200});
  await recordBrevoDeliveryEvent(f.db,{event:'click','message-id':'message-1',ts:300});
  const row=(await f.db.query<{provider_status:string}>('SELECT provider_status FROM email_outbox WHERE id=$1',[id])).rows[0];assert.equal(row.provider_status,'delivered');
 }finally{await f.db.close();}
});
