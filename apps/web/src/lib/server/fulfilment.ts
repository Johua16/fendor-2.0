import {randomUUID} from 'node:crypto';
import type {Database} from './database.ts';
import {actor,uuid} from './catalogue.ts';
import {fail,text} from './identity.ts';
import {seal,unseal} from './security.ts';
import {integer,lockOrder,orderEvent,audit} from './operations-common.ts';
export function fulfilment(db:Database,key:string) {
 return {
  async zone(secret:string|undefined,input:Record<string,unknown>) {
   const name=text(input.name,'name',2,100),state=text(input.state,'state',2,100),city=text(input.city,'city',2,100);
   return db.transaction(async tx=>{const by=await actor(tx,secret,'admin');if(input.id){const id=uuid(input.id);if(typeof input.active!=='boolean') fail(400,'INVALID_INPUT','Active flag required.');const changed=(await tx.query('UPDATE delivery_zones SET name=$2,state=$3,city=$4,active=$5,version=version+1 WHERE id=$1 AND version=$6 RETURNING id,version',[id,name,state,city,input.active,integer(input.version)])).rows[0];if(!changed) fail(409,'STALE_VERSION','Reload zone.');await audit(tx,by,id,'zone_updated',name);return changed;}
    const id=randomUUID();await tx.query('INSERT INTO delivery_zones(id,name,state,city) VALUES($1,$2,$3,$4)',[id,name,state,city]);await audit(tx,by,id,'zone_created',name);return {id,version:0};});
  },
  async zones(){return (await db.query('SELECT id,name,state,city,version FROM delivery_zones WHERE active ORDER BY state,city,id LIMIT 500')).rows;},
  async delivery(secret:string|undefined,id:string,input:Record<string,unknown>) {
   const zoneId=uuid(input.zoneId),recipientName=text(input.recipientName,'recipient name',2,100),phone=text(input.phone,'phone',7,25),address=text(input.address,'address',10,1000),instructions=text(input.instructions??'','instructions',0,1000);
   if(!/^\+?[0-9 ()-]+$/.test(phone)) fail(400,'INVALID_INPUT','Invalid phone.');
   const day=text(input.deliveryDate,'delivery date',10,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||Date.parse(day)<Date.now()-86400000) fail(400,'INVALID_INPUT','Choose a valid future delivery date.');
   return db.transaction(async tx=>{const {by,row}=await lockOrder(tx,id,secret,'customer',input.version);
    if(!['checking_availability','reserved'].includes(row.state)||row.payment_verified||(await tx.query('SELECT id FROM payment_records WHERE order_id=$1',[id])).rows.length) fail(409,'DELIVERY_LOCKED','Contact Fendor to change this delivery.');
    const zone=(await tx.query('SELECT id,state,city FROM delivery_zones WHERE id=$1 AND active FOR SHARE',[zoneId])).rows[0];if(!zone) fail(400,'UNSUPPORTED_ZONE','Delivery zone unavailable.');
    const details=seal({recipientName,phone,address,instructions,state:zone.state,city:zone.city,country:'NG'},key);
    await tx.query('INSERT INTO order_deliveries(order_id,zone_id,private_details,delivery_date) VALUES($1,$2,$3,$4) ON CONFLICT(order_id) DO UPDATE SET zone_id=$2,private_details=$3,delivery_date=$4',[id,zoneId,details,day]);
    await tx.query('UPDATE order_requests SET quote_id=NULL,accepted_quote_id=NULL,total_kobo=NULL,accepted_total_kobo=NULL WHERE id=$1',[id]);return orderEvent(tx,row,by,row.state,'delivery_saved');});
  },
  async read(secret:string|undefined,id:string,scope:'customer'|'admin'|'vendor') {
   return db.transaction(async tx=>{const {row}=await lockOrder(tx,id,secret,scope);const d=(await tx.query<{private_details:string;delivery_date:Date;proof_id:string|null;tracking_reference:string|null;attempts:number}>('SELECT * FROM order_deliveries WHERE order_id=$1',[id])).rows[0];if(!d)return null;
    if(scope==='vendor')return {state:row.state,deliveryDate:d.delivery_date};
    return {...unseal(d.private_details,key) as Record<string,unknown>,deliveryDate:d.delivery_date,proofId:d.proof_id,trackingReference:d.tracking_reference,attempts:d.attempts};});
  },
  async advance(secret:string|undefined,id:string,input:Record<string,unknown>,action:string,scope:'vendor'|'admin') {
   const note=text(input.note,'operation note',5,1000);
   return db.transaction(async tx=>{const {by,row}=await lockOrder(tx,id,secret,scope,input.version);
    if(!row.payment_verified||(action!=='returned'&&(row.financial_hold||(await tx.query("SELECT id FROM order_remedies WHERE order_id=$1 AND status IN ('requested','approved')",[id])).rows.length))) fail(409,'ORDER_BLOCKED','Payment or remedy review must be resolved.');
    const transitions:Record<string,{from:string[];to:string;role:string}>={prepare:{from:['confirmed'],to:'preparing',role:'vendor'},ready:{from:['preparing'],to:'ready_for_dispatch',role:'vendor'},dispatch:{from:['ready_for_dispatch','delivery_failed'],to:'out_for_delivery',role:'admin'},'delivery-failed':{from:['out_for_delivery'],to:'delivery_failed',role:'admin'},delivered:{from:['out_for_delivery'],to:'delivered',role:'admin'},returned:{from:['delivery_failed','out_for_delivery','delivered'],to:'returned',role:'admin'}};
    const rule=transitions[action];if(!rule||rule.role!==scope)fail(403,'FORBIDDEN','Operation not permitted.');if(!rule.from.includes(row.state))fail(409,'INVALID_STATE','Invalid fulfilment transition.');
    const delivery=(await tx.query<{zone_id:string}>('SELECT zone_id FROM order_deliveries WHERE order_id=$1',[id])).rows[0];if(!delivery)fail(409,'DELIVERY_REQUIRED','Save delivery details first.');
    if(action==='dispatch') {const assignee=uuid(input.assignedTo),tracking=text(input.trackingReference,'tracking reference',3,100);
     if(!(await tx.query("SELECT user_id FROM user_roles WHERE user_id=$1 AND role='admin'",[assignee])).rows.length)fail(400,'INVALID_ASSIGNEE','Assign a Fendor operator.');
     if(!(await tx.query('SELECT id FROM delivery_zones WHERE id=$1 AND active',[delivery.zone_id])).rows.length)fail(409,'UNSUPPORTED_ZONE','Delivery coverage needs review.');
     await tx.query('UPDATE order_deliveries SET assigned_to=$2,tracking_reference=$3,attempts=attempts+1 WHERE order_id=$1',[id,assignee,tracking]);
    }
    if(action==='delivered'||action==='returned') {const proof=uuid(input.proofId);if(input.proofChecked!==true)fail(400,'PROOF_REQUIRED','Check delivery/return evidence.');
     if(!(await tx.query("SELECT id FROM uploads WHERE id=$1 AND purpose='proof' AND status='approved'",[proof])).rows.length)fail(400,'PROOF_REQUIRED','Approved proof image required.');
     await tx.query('UPDATE order_deliveries SET proof_id=$2 WHERE order_id=$1',[id,proof]);}
    return orderEvent(tx,row,by,rule.to,action,note);
   });
  }
 };
}
