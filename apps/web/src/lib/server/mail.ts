import type { Database } from './database.ts';
import { unseal } from './security.ts';
export type OutgoingMail = {to:string;subject:string;text:string;html?:string};
const company='Fendora Innovations Limited';
const support='officialfendora@gmail.com';
const legalFooter=`\n\n—\n${company} · RC 9980315\nNigeria · ${support}\nPlease keep order and payment communication inside Fendora.`;

function escapeHtml(value:string) {
 return value.replace(/[&<>"']/g,character=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]!);
}
function frame(title:string,lead:string,content:string) {
 return `<!doctype html><html><body style="margin:0;background:#fff8f4;color:#2f2623;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(lead)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff8f4;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #f0ded6;border-radius:18px;overflow:hidden"><tr><td style="background:#2f2623;padding:22px 28px;color:#ffffff"><strong style="font-size:24px">Fendora</strong></td></tr><tr><td style="padding:32px 28px"><h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#2f2623">${escapeHtml(title)}</h1>${content}</td></tr><tr><td style="padding:20px 28px;background:#fff3ed;color:#6f625d;font-size:13px;line-height:1.6"><strong>${company}</strong><br>RC 9980315 · Nigeria<br><a href="mailto:${support}" style="color:#b74420">${support}</a><br><br>Please keep order and payment communication inside Fendora.</td></tr></table></td></tr></table></body></html>`;
}
function identityMail(purpose:'verify'|'reset',url:string):Omit<OutgoingMail,'to'> {
 const verification=purpose==='verify';
 const action=verification?'Verify my email':'Reset my password';
 const title=verification?'Verify your Fendora email':'Reset your Fendora password';
 const expiry=verification?'24 hours':'1 hour';
 const safeUrl=escapeHtml(url);
 const request=verification?'complete your Fendora account verification':'choose a new password for your Fendora account';
 const security=verification?'If you did not create a Fendora account, you can safely ignore this email.':'If you did not request a password reset, ignore this email. Your password will not change.';
 const text=`Use the secure link below to ${request}.\n\n${action}: ${url}\n\nThis single-use link expires in ${expiry}. ${security}${legalFooter}`;
 const html=frame(title,`${action}. This link expires in ${expiry}.`,`<p style="margin:0 0 24px;color:#6f625d;font-size:16px;line-height:1.6">Use the button below to ${escapeHtml(request)}.</p><p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;background:#ed6e3e;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px">${action}</a></p><p style="margin:0 0 8px;color:#6f625d;font-size:14px;line-height:1.6">If the button does not work, copy and paste this link into your browser:</p><p style="margin:0 0 24px;word-break:break-all;font-size:13px;line-height:1.5"><a href="${safeUrl}" style="color:#b74420">${safeUrl}</a></p><div style="border-left:4px solid #ed6e3e;background:#fff3ed;padding:14px 16px;color:#564945;font-size:14px;line-height:1.6"><strong>Security notice</strong><br>This is a single-use link and it expires in ${expiry}. ${escapeHtml(security)}</div>`);
 return {subject:title,text,html};
}
function notificationMail(subject:string,text:string):Omit<OutgoingMail,'to'> {
 const safeText=escapeHtml(text).replaceAll('\n','<br>');
 return {subject,text:`${text}${legalFooter}`,html:frame(subject,text,`<p style="margin:0;color:#6f625d;font-size:16px;line-height:1.7">${safeText}</p>`)};
}
export function isPlaceholderEmail(address:string) {
 const domain=address.trim().toLowerCase().split('@').at(-1)?.replace(/\.$/,'')??'';
 return ['example.com','example.net','example.org','test','invalid','localhost','local','example'].some(reserved=>domain===reserved||domain.endsWith('.'+reserved));
}
export async function deliverOne(db: Database, key: string, send: (mail: OutgoingMail)=>Promise<unknown>, blockTestRecipients=true) {
  return db.transaction(async tx => {
    const row=(await tx.query<{id:string;payload:string;attempts:number}>('SELECT id,payload,attempts FROM email_outbox WHERE sent_at IS NULL AND attempts<5 AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1')).rows[0];
    if(!row) return 'empty';
    await tx.query('UPDATE email_outbox SET attempts=attempts+1 WHERE id=$1',[row.id]);
    try {
      const mail=unseal(row.payload,key) as {to:string;purpose:string;url:string;subject?:string;text?:string};
      if(blockTestRecipients && isPlaceholderEmail(mail.to)) {await tx.query("UPDATE email_outbox SET next_attempt_at='infinity'::timestamptz,attempts=attempts-1 WHERE id=$1",[row.id]);return 'suppressed';}
      console.info(JSON.stringify({event:'email_delivery_attempt',outboxId:row.id,attempt:row.attempts+1,purpose:mail.purpose}));
      if(mail.purpose==='notification') await send({to:mail.to,...notificationMail(mail.subject!,mail.text!)});
      else await send({to:mail.to,...identityMail(mail.purpose as 'verify'|'reset',mail.url)});
    } catch {await tx.query("UPDATE email_outbox SET next_attempt_at=now()+LEAST(900,power(2,attempts)::int*30)*interval '1 second' WHERE id=$1",[row.id]);console.error(JSON.stringify({event:'email_delivery_failed',outboxId:row.id,attempt:row.attempts+1}));return 'failed';}
    await tx.query("UPDATE email_outbox SET sent_at=now(),payload='' WHERE id=$1",[row.id]);
    console.info(JSON.stringify({event:'email_delivery_sent',outboxId:row.id,attempt:row.attempts+1}));
    return 'sent';
  });
}
export async function drainMail(db:Database,key:string,send:(mail:OutgoingMail)=>Promise<unknown>,limit=5,blockTestRecipients=true) {
 let sent=0,failures=0,suppressed=0;
 for(let i=0;i<limit;i++) {
  const outcome=await deliverOne(db,key,send,blockTestRecipients);
  if(outcome==='empty')break;
  if(outcome==='failed')failures++;
  else if(outcome==='suppressed')suppressed++;
  else sent++;
 }
 return {sent,failures,suppressed};
}
