import { randomUUID } from 'node:crypto';
import type { Database,Sql } from './database.ts';
import { actor,uuid } from './catalogue.ts';
import { fail,text } from './identity.ts';
export async function balances(tx:Sql,id:string) {
 const rows=(await tx.query<{id:string;received_kobo:string;refunded_kobo:string;status:string}>(`SELECT p.id,(p.received_kobo+COALESCE((SELECT sum(c.delta_kobo) FROM payment_corrections c WHERE c.payment_id=p.id),0))::text AS received_kobo,p.status,COALESCE((SELECT sum(r.amount_kobo) FROM payment_refunds r WHERE r.payment_id=p.id),0)::text AS refunded_kobo FROM payment_records p WHERE p.order_id=$1 ORDER BY p.id`,[id])).rows;
 const net=rows.reduce((sum,r)=>sum+BigInt(r.received_kobo)-BigInt(r.refunded_kobo),0n);
 return {rows,net};
}
export function refunds(db:Database) {
 return {
  async change(secret:string|undefined,id:string,input:Record<string,unknown>,action:'record-refund'|'close-refunded') {
   uuid(id);
   if(typeof input.version!=='number'||!Number.isSafeInteger(input.version)||input.version<0) fail(400,'INVALID_INPUT','Invalid version.');
   const note=text(input.note,'review note',10,1000);
   return db.transaction(async tx=>{
    const by=await actor(tx,secret,'admin');
    const initial=(await tx.query<{product_variant_id:string}>('SELECT product_variant_id FROM order_requests WHERE id=$1',[id])).rows[0];
    if(!initial) fail(404,'NOT_FOUND','Order not found.');
    await tx.query('SELECT id FROM product_variants WHERE id=$1 FOR UPDATE',[initial.product_variant_id]);
    const row=(await tx.query<{customer_id:string;vendor_id:string;version:number;state:string;payment_verified:boolean;stock_held:boolean;quantity:number;accepted_total_kobo:string|null}>('SELECT customer_id,vendor_id,version,state,payment_verified,stock_held,quantity,accepted_total_kobo FROM order_requests WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(by===row.customer_id||by===row.vendor_id) fail(403,'SELF_REVIEW','Another administrator must review this order.');
    const ledger=await balances(tx,id);
    if(action==='record-refund') {
     const paymentId=uuid(input.paymentId),reference=text(input.bankReference,'refund reference',3,160).toUpperCase();
     if(input.bankRefundChecked!==true) fail(400,'BANK_CHECK_REQUIRED','Check that the outbound bank refund actually completed.');
     if(typeof input.amountKobo!=='number'||!Number.isSafeInteger(input.amountKobo)||input.amountKobo<1) fail(400,'INVALID_AMOUNT','Invalid refund amount.');
     const existing=(await tx.query<{id:string;payment_id:string;amount_kobo:string}>('SELECT id,payment_id,amount_kobo FROM payment_refunds WHERE bank_reference=$1',[reference])).rows[0];
     if(existing) {
      if(!ledger.rows.some(p=>p.id===existing.payment_id)||existing.payment_id!==paymentId||BigInt(existing.amount_kobo)!==BigInt(input.amountKobo)) fail(409,'REFERENCE_CONFLICT','Refund reference already used.');
      return {refundId:existing.id,orderId:id,version:row.version};
     }
     if(row.version!==input.version) fail(409,'STALE_VERSION','Reload the order.');
     const remedy=(await tx.query<{refund_limit_kobo:string}>("SELECT refund_limit_kobo FROM order_remedies WHERE order_id=$1 AND status='approved'",[id])).rows[0];
     if(row.payment_verified && (row.accepted_total_kobo===null || ledger.net-BigInt(input.amountKobo)<BigInt(row.accepted_total_kobo)-BigInt(remedy?.refund_limit_kobo??0))) fail(409,'PAID_REMEDY_REQUIRED','Only excess funds can be refunded here after confirmation. Principal needs a fulfilment-aware remedy review.');
     const payment=ledger.rows.find(p=>p.id===paymentId);
     if(!payment) fail(404,'NOT_FOUND','Receipt not found on this order.');
     if(BigInt(input.amountKobo)>BigInt(payment.received_kobo)-BigInt(payment.refunded_kobo)) fail(409,'REFUND_EXCEEDS_RECEIPT','Refund exceeds remaining received funds.');
     const refundId=randomUUID();
     const inserted=(await tx.query('INSERT INTO payment_refunds(id,payment_id,bank_reference,amount_kobo,recorded_by,note) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(bank_reference) DO NOTHING RETURNING id',[refundId,paymentId,reference,input.amountKobo,by,note])).rows;
     if(!inserted.length) fail(409,'REFERENCE_CONFLICT','Refund reference already used.');
     await tx.query('UPDATE order_requests SET version=version+1 WHERE id=$1',[id]);
     await tx.query('INSERT INTO order_events(id,order_id,actor_id,from_state,to_state,order_version,event_type) VALUES($1,$2,$3,$4,$4,$5,$6)',[randomUUID(),id,by,row.state,row.version+1,'refund_recorded']);
     return {refundId,orderId:id,version:row.version+1};
    }
    if(row.version!==input.version) fail(409,'STALE_VERSION','Reload the order.');
    if(row.payment_verified || !['checking_availability','reserved','awaiting_payment','unavailable','cancelled'].includes(row.state)) fail(409,'PAID_REMEDY_REQUIRED','Confirmed/fulfilled orders require a separate remedy review.');
    if(!ledger.rows.length || ledger.net!==0n) fail(409,'FUNDS_REMAIN','All recorded funds must be refunded before closing.');
    if(row.stock_held) await tx.query('UPDATE product_variants SET reserved_quantity=reserved_quantity-$2 WHERE id=$1',[initial.product_variant_id,row.quantity]);
    await tx.query("UPDATE order_requests SET state='cancelled',stock_held=false,reservation_expires_at=NULL,total_kobo=NULL,accepted_total_kobo=NULL,quote_id=NULL,accepted_quote_id=NULL,version=version+1 WHERE id=$1",[id]);
    await tx.query("INSERT INTO order_events(id,order_id,actor_id,from_state,to_state,order_version,event_type,review_note) VALUES($1,$2,$3,$4,'cancelled',$5,'refunded_request_closed',$6)",[randomUUID(),id,by,row.state,row.version+1,note]);
    return {orderId:id,state:'cancelled',version:row.version+1};
   });
  }
 };
}
