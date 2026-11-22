import {timingSafeEqual} from 'node:crypto';
import type {Database} from './database.ts';

export function brevoWebhookAuthorised(expected:string|undefined,supplied:string|undefined){
 const secret=expected?.trim(),value=supplied?.trim();
 if(!secret||secret.length<32||!value||value.length!==secret.length)return false;
 return timingSafeEqual(Buffer.from(secret),Buffer.from(value));
}
export function brevoDeliveryStatus(event:string){
 const name=event.trim().toLowerCase().replaceAll('_','').replaceAll('-','');
 if(['request','sent','opened','uniqueopened','proxyopen','click'].includes(name))return 'accepted';
 if(name==='delivered')return 'delivered';
 if(['deferred','softbounce'].includes(name))return 'deferred';
 if(name==='spam')return 'complained';
 if(['hardbounce','blocked','invalid','invalidemail','error','unsubscribed'].includes(name))return 'failed';
 return null;
}
export async function recordBrevoDeliveryEvent(db:Database,input:Record<string,unknown>){
 const event=typeof input.event==='string'?input.event:'',messageId=typeof input['message-id']==='string'?input['message-id']:typeof input.messageId==='string'?input.messageId:'';
 const next=brevoDeliveryStatus(event);if(!next||!messageId)return false;
 const seconds=typeof input.ts==='number'?input.ts:typeof input.date==='number'?input.date:Date.now()/1000;
 const occurredAt=new Date(seconds>10_000_000_000?seconds:seconds*1000);if(Number.isNaN(occurredAt.valueOf()))return false;
 await db.query(`UPDATE email_outbox SET provider_status=$2,provider_status_at=$3,last_error_code=CASE WHEN $2 IN ('failed','complained') THEN upper($4) ELSE last_error_code END
  WHERE provider='brevo' AND provider_message_id=$1 AND (provider_status_at IS NULL OR provider_status_at<=$3)
  AND CASE $2 WHEN 'accepted' THEN 1 WHEN 'deferred' THEN 2 WHEN 'delivered' THEN 3 WHEN 'failed' THEN 3 WHEN 'complained' THEN 4 ELSE 0 END
      >= CASE provider_status WHEN 'accepted' THEN 1 WHEN 'deferred' THEN 2 WHEN 'delivered' THEN 3 WHEN 'failed' THEN 3 WHEN 'complained' THEN 4 ELSE 0 END`,[messageId,next,occurredAt,event.slice(0,80)]);
 return true;
}
