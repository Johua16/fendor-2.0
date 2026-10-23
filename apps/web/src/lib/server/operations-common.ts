import {randomUUID} from 'node:crypto';
import type {Sql} from './database.ts';
import {actor,uuid} from './catalogue.ts';
import {fail} from './identity.ts';
export function integer(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):number {if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max) fail(400,'INVALID_INPUT','Invalid integer.');return v;}
export function fields(input:Record<string,unknown>,names:string[]) {if(Object.keys(input).some(k=>!names.includes(k))) fail(400,'UNKNOWN_FIELD','Unexpected fields.');}
export type OperationalOrder=Record<string,unknown>&{id:string;customer_id:string;vendor_id:string;product_variant_id:string;quantity:number;version:number;state:string;payment_verified:boolean;financial_hold:boolean;stock_held:boolean;accepted_total_kobo:string|null};
export async function lockOrder(tx:Sql,id:string,secret:string|undefined,scope:'customer'|'admin'|'vendor',version?:unknown) {
 uuid(id);const by=await actor(tx,secret,scope);
 const initial=(await tx.query<OperationalOrder>('SELECT * FROM order_requests WHERE id=$1',[id])).rows[0];
 if(!initial||(scope==='customer'&&initial.customer_id!==by)||(scope==='vendor'&&initial.vendor_id!==by)) fail(404,'NOT_FOUND','Order not found.');
 if(scope==='admin'&&(by===initial.customer_id||by===initial.vendor_id)) fail(403,'SELF_REVIEW','Another operator must handle this order.');
 await tx.query('SELECT id FROM product_variants WHERE id=$1 FOR UPDATE',[initial.product_variant_id]);
 const row=(await tx.query<OperationalOrder>('SELECT * FROM order_requests WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(version!==undefined&&row.version!==integer(version)) fail(409,'STALE_VERSION','Reload before continuing.');return {by,row};
}
export async function orderEvent(tx:Sql,row:OperationalOrder,by:string,state:string,action:string,note='') {
 await tx.query('UPDATE order_requests SET state=$2,version=version+1 WHERE id=$1',[row.id,state]);
 await tx.query('INSERT INTO order_events(id,order_id,actor_id,from_state,to_state,order_version,event_type,review_note) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),row.id,by,row.state,state,row.version+1,action,note]);
 return {orderId:row.id,state,version:row.version+1};
}
export async function audit(tx:Sql,by:string,subject:string,action:string,note:string) {await tx.query('INSERT INTO operation_audit(id,actor_id,subject_id,action,note) VALUES($1,$2,$3,$4,$5)',[randomUUID(),by,subject,action,note]);}
