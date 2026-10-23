import {randomUUID} from 'node:crypto';
import type {Database} from './database.ts';
import {uuid} from './catalogue.ts';
import {text,fail} from './identity.ts';
import {balances} from './refunds.ts';
import {integer,lockOrder,orderEvent,audit} from './operations-common.ts';
export function remedies(db:Database) {
 return {
  async change(secret:string|undefined,id:string,input:Record<string,unknown>,action:string) {
   const note=text(input.note,'review reason',10,1000);
   return db.transaction(async tx=>{const {row,by}=await lockOrder(tx,id,secret,action==='request-remedy'?'customer':'admin',input.version);
    const remedy=(await tx.query<{id:string;status:string;kind:string}>('SELECT id,status,kind FROM order_remedies WHERE order_id=$1 FOR UPDATE',[id])).rows[0];
    if(action==='request-remedy') {
     if(!row.payment_verified||['refunded','cancelled'].includes(row.state))fail(409,'INVALID_STATE','Paid active/delivered order required.');
     if(remedy&&!['rejected'].includes(remedy.status))fail(409,'REMEDY_EXISTS','An existing remedy must be resolved.');
     const kind=text(input.kind,'remedy kind');if(!['cancellation','return'].includes(kind))fail(400,'INVALID_INPUT','Invalid remedy kind.');
     if(kind==='cancellation'&&!['confirmed','preparing','ready_for_dispatch'].includes(row.state))fail(409,'RETURN_REQUIRED','Dispatched goods need a return review.');
     await tx.query("INSERT INTO order_remedies(id,order_id,kind,status,reason) VALUES($1,$2,$3,'requested',$4) ON CONFLICT(order_id) DO UPDATE SET kind=$3,status='requested',reason=$4,review_note=NULL,refund_limit_kobo=0",[randomUUID(),id,kind,note]);
     return orderEvent(tx,row,by,row.state,'remedy_requested',note);
    }
    if(action==='review-remedy') {
     if(!remedy||remedy.status!=='requested')fail(409,'INVALID_STATE','Pending remedy required.');
     if(!['approved','rejected'].includes(String(input.decision)))fail(400,'INVALID_INPUT','Invalid decision.');
     await tx.query('UPDATE order_remedies SET status=$2,review_note=$3,reviewed_by=$4,refund_limit_kobo=$5 WHERE order_id=$1',[id,input.decision,note,by,input.decision==='approved'?row.accepted_total_kobo:0]);
     return orderEvent(tx,row,by,row.state,'remedy_reviewed',note);
    }
    if(action==='close-remedy') {
     if(!remedy||remedy.status!=='approved')fail(409,'INVALID_STATE','Approved remedy required.');
     if((await balances(tx,id)).net!==0n)fail(409,'FUNDS_REMAIN','Record completed refunds of all remaining funds first.');
     if(remedy.kind==='return'&&row.state!=='returned')fail(409,'RETURN_REQUIRED','Confirm physical return with evidence first.');
     if(remedy.kind==='cancellation'&&!['confirmed','preparing','ready_for_dispatch'].includes(row.state))fail(409,'RETURN_REQUIRED','Goods already dispatched.');
     const count=integer(input.restockQuantity,0,row.quantity);if(input.stockChecked!==true)fail(400,'STOCK_CHECK_REQUIRED','Inspect stock before closing.');
     if(count)await tx.query('UPDATE product_variants SET stock_quantity=stock_quantity+$2 WHERE id=$1',[row.product_variant_id,count]);
     await tx.query("UPDATE order_remedies SET status='closed',restock_quantity=$2,received_back=$3,review_note=$4 WHERE order_id=$1",[id,count,row.state==='returned',note]);
     await tx.query('UPDATE order_requests SET financial_hold=false WHERE id=$1',[id]);return orderEvent(tx,row,by,'refunded','remedy_closed',note);
    }
    if(action==='correct-receipt') {
     const paymentId=uuid(input.paymentId),requestId=uuid(input.requestId),corrected=integer(input.correctedKobo);
     if(input.bankChecked!==true)fail(400,'BANK_CHECK_REQUIRED','Check the bank ledger before correcting.');
     const prior=(await tx.query<{payment_id:string;corrected_kobo:string}>('SELECT payment_id,corrected_kobo FROM payment_corrections WHERE request_id=$1',[requestId])).rows[0];
     if(prior) {if(prior.payment_id!==paymentId||BigInt(prior.corrected_kobo)!==BigInt(corrected))fail(409,'IDEMPOTENCY_CONFLICT','Correction key already used.');return {orderId:id,version:row.version};}
     const ledger=await balances(tx,id),payment=ledger.rows.find(p=>p.id===paymentId);if(!payment)fail(404,'NOT_FOUND','Receipt not on this order.');
     if(BigInt(corrected)<BigInt(payment.refunded_kobo))fail(409,'REFUNDS_EXIST','Corrected receipt cannot fall below recorded refunds.');
     const delta=BigInt(corrected)-BigInt(payment.received_kobo);if(delta===0n)fail(400,'NO_CHANGE','Amount is unchanged.');
     await tx.query('INSERT INTO payment_corrections(id,payment_id,request_id,delta_kobo,corrected_kobo,actor_id,note) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),paymentId,requestId,delta.toString(),corrected,by,note]);
     await tx.query('UPDATE order_requests SET financial_hold=true WHERE id=$1',[id]);return orderEvent(tx,row,by,row.state,'receipt_corrected',note);
    }
    if(action==='reconcile') {
     if(input.bankChecked!==true)fail(400,'BANK_CHECK_REQUIRED','Reconcile against bank records.');
     const ledger=await balances(tx,id);
     if(row.payment_verified&&row.state!=='refunded'&&ledger.net!==BigInt(row.accepted_total_kobo??0))fail(409,'PAYMENT_MISMATCH','Resolve refund/top-up or remedy before reconciliation.');
     if(row.state==='refunded'&&ledger.net!==0n)fail(409,'PAYMENT_MISMATCH','Refunded order still has funds.');
     await tx.query('UPDATE order_requests SET financial_hold=false WHERE id=$1',[id]);return orderEvent(tx,row,by,row.state,'financial_reconciled',note);
    }
    fail(404,'NOT_FOUND','Operation unavailable.');
   });
  }
 };
}
