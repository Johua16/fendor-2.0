import type {Database} from './database.ts';
import {identity,fail,text} from './identity.ts';
import {uuid} from './catalogue.ts';
import {seal,unseal} from './security.ts';
import {integer,audit} from './operations-common.ts';
export function vendorProfile(db:Database,key:string,origin:string) {
 return {
  async save(secret:string|undefined,input:Record<string,unknown>) {
   const phone=text(input.phone,'phone',7,25),backupPhone=text(input.backupPhone,'backup phone',7,25),pickupAddress=text(input.pickupAddress,'pickup address',10,1000),documentId=uuid(input.documentId);
   if(!/^\+?[0-9 ()-]+$/.test(phone)||!/^\+?[0-9 ()-]+$/.test(backupPhone))fail(400,'INVALID_INPUT','Invalid phone number.');
   const start=new Date(text(input.windowStart,'window start')),end=new Date(text(input.windowEnd,'window end'));if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||end.getTime()<Date.now()||end.getTime()-start.getTime()>7*86400000)fail(400,'INVALID_WINDOW','Use a future selling window of at most seven days.');
   const u=await identity(db,{origin,outboxKey:key}).me(secret);if(!u.verified)fail(403,'EMAIL_UNVERIFIED','Verify email first.');
   return db.transaction(async tx=>{await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[u.id]);
    if(!(await tx.query("SELECT id FROM uploads WHERE id=$1 AND owner_id=$2 AND purpose='document' AND status='approved'",[documentId,u.id])).rows.length)fail(400,'DOCUMENT_REQUIRED','Approved owned business document required.');
    const old=(await tx.query<{version:number;document_id:string;private_details:string}>('SELECT version,document_id,private_details FROM vendor_profiles WHERE user_id=$1',[u.id])).rows[0];
    if(integer(input.version)!==(old?.version??0))fail(409,'STALE_VERSION','Reload profile.');
    const details={phone,backupPhone,pickupAddress};
    const changed=old&&(old.document_id!==documentId||JSON.stringify(unseal(old.private_details,key))!==JSON.stringify(details));
    if(changed){await tx.query("UPDATE vendor_applications SET status='changes_requested',review_note='Business details changed; review required' WHERE user_id=$1 AND status='approved'",[u.id]);await tx.query("DELETE FROM user_roles WHERE user_id=$1 AND role='vendor'",[u.id]);}
    await tx.query('INSERT INTO vendor_profiles(user_id,private_details,document_id,window_start,window_end,version) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id) DO UPDATE SET private_details=$2,document_id=$3,window_start=$4,window_end=$5,version=$6',[u.id,seal(details,key),documentId,start,end,(old?.version??0)+1]);
    await audit(tx,u.id,u.id,'vendor_profile_saved','Business profile/selling window updated');return {version:(old?.version??0)+1,reviewRequired:!!changed};});
  },
  async read(secret?:string) {const u=await identity(db,{origin,outboxKey:key}).me(secret);const row=(await db.query<{private_details:string}>('SELECT * FROM vendor_profiles WHERE user_id=$1',[u.id])).rows[0];if(!row)return null;const {private_details,...rest}=row;return {...rest,...unseal(private_details,key) as Record<string,unknown>};}
 };
}
