import type { Database } from './database.ts';
import { unseal } from './security.ts';
export async function deliverOne(db: Database, key: string, send: (mail: {to:string;subject:string;text:string})=>Promise<unknown>) {
  return db.transaction(async tx => {
    const row=(await tx.query<{id:string;payload:string}>('SELECT id,payload FROM email_outbox WHERE sent_at IS NULL AND attempts<5 AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1')).rows[0];
    if(!row) return 'empty';
    await tx.query('UPDATE email_outbox SET attempts=attempts+1 WHERE id=$1',[row.id]);
    try {
      const mail=unseal(row.payload,key) as {to:string;purpose:string;url:string;subject?:string;text?:string};
      if(mail.purpose==='notification') {await send({to:mail.to,subject:mail.subject!,text:mail.text!});}
      else await send({to:mail.to,subject:mail.purpose==='verify'?'Verify your Fendor email':'Reset your Fendor password',text:`Use this link to ${mail.purpose==='verify'?'verify your email':'reset your password'}: ${mail.url}\nIf you did not request this, ignore this email.`});
    } catch {await tx.query("UPDATE email_outbox SET next_attempt_at=now()+LEAST(900,power(2,attempts)::int*30)*interval '1 second' WHERE id=$1",[row.id]);return 'failed';}
    await tx.query("UPDATE email_outbox SET sent_at=now(),payload='' WHERE id=$1",[row.id]);
    return 'sent';
  });
}
