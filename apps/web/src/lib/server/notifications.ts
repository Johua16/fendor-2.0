import {randomUUID} from 'node:crypto';
import type {Database,Sql} from './database.ts';
import {seal} from './security.ts';
export async function notify(tx:Sql,userId:string,dedupe:string,title:string,message:string,key:string,origin:string) {
 const id=randomUUID();const inserted=(await tx.query('INSERT INTO notifications(id,user_id,dedupe_key,title,message) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,dedupe_key) DO NOTHING RETURNING id',[id,userId,dedupe,title,message])).rows;
 if(!inserted.length)return;
 const user=(await tx.query<{email:string}>('SELECT email FROM users WHERE id=$1 AND email_verified_at IS NOT NULL',[userId])).rows[0];
 if(user)await tx.query('INSERT INTO email_outbox(id,payload) VALUES($1,$2)',[randomUUID(),seal({to:user.email,purpose:'notification',subject:title,text:`${message}\nOpen Fendor to view the update: ${origin}/notifications`},key)]);
}
export async function produceNotifications(db:Database,key:string,origin:string,now:Date=new Date()) {
 return db.transaction(async tx=>{
  const events=(await tx.query<{id:string;order_id:string;event_type:string;customer_id:string;vendor_id:string;to_state:string}>(`SELECT e.id,e.order_id,e.event_type,e.to_state,o.customer_id,o.vendor_id FROM order_events e JOIN order_requests o ON o.id=e.order_id WHERE e.notified_at IS NULL ORDER BY e.created_at,e.id LIMIT 100 FOR UPDATE OF e SKIP LOCKED`)).rows;
  for(const e of events) {
   await notify(tx,e.customer_id,`order:${e.id}`,'Fendor order update',`Request ${e.order_id} has an update (${e.event_type.replaceAll('_',' ')}). View the current status in Fendor.`,key,origin);
   if(['request_created','reservation_expired','payment_verified','remedy_closed'].includes(e.event_type)) await notify(tx,e.vendor_id,`order:${e.id}`,'Fendor vendor update',`Assigned request ${e.order_id} has an update. Check Fendor for the current action.`,key,origin);
   await tx.query('UPDATE order_events SET notified_at=$2 WHERE id=$1',[e.id,now]);
  }
  const pending=(await tx.query<{id:string;vendor_id:string;customer_id:string;availability_deadline:Date;reminder_sent:boolean;escalated_at:Date|null}>(`SELECT id,vendor_id,customer_id,availability_deadline,reminder_sent,escalated_at FROM order_requests WHERE state='checking_availability' AND availability_deadline IS NOT NULL AND (NOT reminder_sent OR escalated_at IS NULL) ORDER BY availability_deadline LIMIT 100 FOR UPDATE SKIP LOCKED`)).rows;
  const admins=(await tx.query<{user_id:string}>("SELECT user_id FROM user_roles WHERE role='admin'")).rows;
  for(const row of pending) {
   const deadline=new Date(row.availability_deadline).getTime();
   if(deadline<=now.getTime()) {
    if(!row.escalated_at){for(const admin of admins)await notify(tx,admin.user_id,`deadline:${row.id}:${deadline}`,'Vendor response overdue',`Request ${row.id} needs operator follow-up. Do not promise availability without confirmation.`,key,origin);
     await notify(tx,row.customer_id,`deadline:${row.id}:${deadline}`,'Fendor is checking availability',`Request ${row.id} is taking longer than expected. Fendor has been alerted; you may review or cancel the pending request.`,key,origin);
     await tx.query('UPDATE order_requests SET escalated_at=$2,reminder_sent=true WHERE id=$1',[row.id,now]);}
   } else if(!row.reminder_sent && deadline-now.getTime()<=5*60000) {
    await notify(tx,row.vendor_id,`reminder:${row.id}:${deadline}`,'Availability response needed',`Check assigned request ${row.id} in Fendor before the response deadline.`,key,origin);
    await tx.query('UPDATE order_requests SET reminder_sent=true WHERE id=$1',[row.id]);
   }
  }
  return {events:events.length,deadlinesChecked:pending.length};
 });
}
