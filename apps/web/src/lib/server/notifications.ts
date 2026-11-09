import {randomUUID} from 'node:crypto';
import type {Database,Sql} from './database.ts';
import {seal} from './security.ts';
export async function notify(tx:Sql,userId:string,dedupe:string,title:string,message:string,key:string,origin:string,email=true) {
 const id=randomUUID();const inserted=(await tx.query('INSERT INTO notifications(id,user_id,dedupe_key,title,message) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,dedupe_key) DO NOTHING RETURNING id',[id,userId,dedupe,title,message])).rows;
 if(!inserted.length)return;
 const user=(await tx.query<{email:string}>('SELECT email FROM users WHERE id=$1 AND email_verified_at IS NOT NULL',[userId])).rows[0];
 if(user&&email)await tx.query('INSERT INTO email_outbox(id,payload) VALUES($1,$2)',[randomUUID(),seal({to:user.email,purpose:'notification',subject:title,text:`${message}\nOpen Fendora to view the update: ${origin}/notifications`},key)]);
}
export async function produceNotifications(db:Database,key:string,origin:string,now:Date=new Date()) {
 return db.transaction(async tx=>{
  const events=(await tx.query<{id:string;order_id:string;event_type:string;customer_id:string;vendor_id:string;to_state:string}>(`SELECT e.id,e.order_id,e.event_type,e.to_state,o.customer_id,o.vendor_id FROM order_events e JOIN order_requests o ON o.id=e.order_id WHERE e.notified_at IS NULL ORDER BY e.created_at,e.id LIMIT 100 FOR UPDATE OF e SKIP LOCKED`)).rows;
  for(const e of events) {
   const messages:Record<string,string>={request_created:'Your availability request has been received.',decline:'The requested product is unavailable. Open your order to review the next step.',cancel:'Your request has been cancelled.',remedy_requested:'Your cancellation or return request has been received.',remedy_closed:'Your order review has been resolved. Open your order to view the outcome.',reserve:'Your product is available. Continue to checkout to complete your details and pay.',quote_created:'Your complete total is ready to review.',online_payment_verified:'Payment verified. Your order is confirmed and awaiting preparation.',payment_verified:'Payment verified. Your order is confirmed and awaiting preparation.',prepare:'Your order is being prepared.',ready:'Your order is ready for Fendora to arrange dispatch.',dispatch:'Your order is out for delivery.','delivery-failed':'Delivery could not be completed. Fendora will coordinate the next step.',delivered:'Your order has been marked delivered with delivery evidence recorded.',returned:'Your order has been marked returned. Check your order for the next step.',online_payment_review_required:'Your payment needs review by Fendora. Please do not pay again while we check it.',reservation_expired:'Your stock hold expired. Availability needs confirmation again.'};
   await notify(tx,e.customer_id,`order:${e.id}`,'Fendora order update',`Request ${e.order_id}: ${messages[e.event_type]??'View your order for the latest update.'}`,key,origin,Boolean(messages[e.event_type]));
   const vendorMessages:Record<string,string>={request_created:'Confirm and reserve the requested stock, or decline if unavailable.',reservation_expired:'The stock hold expired. Check the request before acting.',payment_verified:'Payment is verified. Open Orders and start preparation.',online_payment_verified:'Payment is verified. Open Orders and start preparation.',online_payment_review_required:'Fendora is reviewing this payment. Do not start preparation.',prepare:'Preparation started. Mark ready when the product is ready for collection.',ready:'The order is ready. Fendora will coordinate dispatch.',dispatch:'Fendora has marked the order out for delivery.','delivery-failed':'Delivery needs Fendora follow-up.',delivered:'Fendora has recorded delivery.',returned:'Fendora has recorded a return. Check the order for instructions.',remedy_closed:'The order review has been resolved. Check the current permitted action.'};
   if(vendorMessages[e.event_type])await notify(tx,e.vendor_id,`order:${e.id}`,'Fendora vendor update',`Assigned request ${e.order_id}: ${vendorMessages[e.event_type]}`,key,origin);
   const adminMessages:Record<string,string>={payment_verified:'Payment verified; monitor preparation and coordinate fulfilment.',online_payment_verified:'Payment verified; monitor preparation and coordinate fulfilment.',online_payment_review_required:'Payment requires financial review. Resolve before fulfilment.',prepare:'Vendor preparation has started.',ready:'Vendor marked the product ready. Arrange packaging, collection and dispatch.',dispatch:'Order marked out for delivery. Monitor delivery progress.','delivery-failed':'Delivery failed. Coordinate another attempt or the appropriate resolution.',delivered:'Delivery recorded with evidence.',returned:'Return recorded. Review any outstanding financial resolution.'};
   if(adminMessages[e.event_type])for(const admin of (await tx.query<{user_id:string}>("SELECT user_id FROM user_roles WHERE role='admin'")).rows)await notify(tx,admin.user_id,`order:${e.id}`,'Fendora operations update',`Order ${e.order_id}: ${adminMessages[e.event_type]}`,key,origin);
   await tx.query('UPDATE order_events SET notified_at=$2 WHERE id=$1',[e.id,now]);
  }
  const pending=(await tx.query<{id:string;vendor_id:string;customer_id:string;availability_deadline:Date;reminder_sent:boolean;escalated_at:Date|null}>(`SELECT id,vendor_id,customer_id,availability_deadline,reminder_sent,escalated_at FROM order_requests WHERE state='checking_availability' AND availability_deadline IS NOT NULL AND (NOT reminder_sent OR escalated_at IS NULL) ORDER BY availability_deadline LIMIT 100 FOR UPDATE SKIP LOCKED`)).rows;
  const admins=(await tx.query<{user_id:string}>("SELECT user_id FROM user_roles WHERE role='admin'")).rows;
  for(const row of pending) {
   const deadline=new Date(row.availability_deadline).getTime();
   if(deadline<=now.getTime()) {
    if(!row.escalated_at){for(const admin of admins)await notify(tx,admin.user_id,`deadline:${row.id}:${deadline}`,'Vendor response overdue',`Request ${row.id} needs operator follow-up. Do not promise availability without confirmation.`,key,origin);
     await notify(tx,row.customer_id,`deadline:${row.id}:${deadline}`,'Fendora is checking availability',`Request ${row.id} is taking longer than expected. Fendora has been alerted; you may review or cancel the pending request.`,key,origin);
     await tx.query('UPDATE order_requests SET escalated_at=$2,reminder_sent=true WHERE id=$1',[row.id,now]);}
   } else if(!row.reminder_sent && deadline-now.getTime()<=5*60000) {
    await notify(tx,row.vendor_id,`reminder:${row.id}:${deadline}`,'Availability response needed',`Check assigned request ${row.id} in Fendora before the response deadline.`,key,origin);
    await tx.query('UPDATE order_requests SET reminder_sent=true WHERE id=$1',[row.id]);
   }
  }
  return {events:events.length,deadlinesChecked:pending.length};
 });
}
