import { balances } from './refunds.ts';
import { randomUUID } from 'node:crypto';
import type { Database, Sql } from './database.ts';
import { actor, uuid } from './catalogue.ts';
import { fail, text } from './identity.ts';
import { transition, DomainError, type Order, type OrderState, type Command } from '../../../../../server/src/order.ts';
type Row=Record<string,unknown>&{id:string;customer_id:string;vendor_id:string;product_variant_id:string;quantity:number;state:OrderState;version:number;stock_held:boolean;reservation_expires_at:Date|null;product_snapshot:{unitPriceKobo:number;productVersion:number};total_kobo:string|null;accepted_total_kobo:string|null;payment_verified:boolean;quote_id:string|null;accepted_quote_id:string|null};
function amount(value:unknown,min=0):number {
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min) fail(400,'INVALID_AMOUNT','Use a valid integer amount in kobo.');return value;
}
export function checkout(db:Database,now:()=>number=Date.now) {
 async function load(tx:Sql,id:string):Promise<Row> {
  const row=(await tx.query<Row>('SELECT * FROM order_requests WHERE id=$1',[id])).rows[0];
  if(!row) fail(404,'NOT_FOUND','Order not found.');return row;
 }
 function authorise(row:Row,by:string,customer:boolean) {
  if(customer && row.customer_id!==by) fail(404,'NOT_FOUND','Order not found.');
  if(!customer && (row.customer_id===by||row.vendor_id===by)) fail(403,'SELF_REVIEW','Another Fendor administrator must review this order.');
 }
 function active(row:Row) {
  if(!row.stock_held || !row.reservation_expires_at || new Date(row.reservation_expires_at).getTime()<=now()) fail(409,'RESERVATION_EXPIRED','Reconfirm availability before payment or confirmation.');
 }
 async function audit(tx:Sql,row:Row,by:string,state:string,type:string) {
  await tx.query('INSERT INTO order_events(id,order_id,actor_id,from_state,to_state,order_version,event_type) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),row.id,by,row.state,state,row.version+1,type]);
 }
 function next(row:Row,by:string,role:'admin'|'customer',command:Command) {
  const order:Order={id:row.id,customerId:row.customer_id,vendorId:row.vendor_id,productVariantId:row.product_variant_id,quantity:row.quantity,state:row.state,version:row.version,reservationExpiresAt:row.reservation_expires_at?new Date(row.reservation_expires_at).getTime():undefined,totalKobo:row.total_kobo==null?undefined:Number(row.total_kobo),acceptedTotalKobo:row.accepted_total_kobo==null?undefined:Number(row.accepted_total_kobo),paymentVerified:row.payment_verified};
  try {return transition(order,{id:by,role},command,now());}catch(error){if(error instanceof DomainError) fail(409,error.code,error.message);throw error;}
 }
 return {
  async summary(secret:string|undefined,id:string,admin=false) {
   uuid(id);return db.transaction(async tx=>{
    const by=await actor(tx,secret,admin?'admin':'customer'),row=await load(tx,id);
    if(!admin && row.customer_id!==by) fail(404,'NOT_FOUND','Order not found.');
    const quote=row.quote_id?(await tx.query('SELECT id,details FROM order_quotes WHERE id=$1',[row.quote_id])).rows[0]:null;
    const payments=admin?(await tx.query('SELECT id,bank_reference,received_kobo,status,receipt_note,received_at FROM payment_records WHERE order_id=$1 ORDER BY received_at,id',[id])).rows:undefined;
    const ledger=await balances(tx,id);
    const refundRows=admin?(await tx.query('SELECT r.id,r.payment_id,r.bank_reference,r.amount_kobo,r.note,r.created_at FROM payment_refunds r JOIN payment_records p ON p.id=r.payment_id WHERE p.order_id=$1 ORDER BY r.created_at,r.id',[id])).rows:undefined;
    const recorded=(await tx.query('SELECT id FROM payment_records WHERE order_id=$1 LIMIT 1',[id])).rows.length>0;
    return {orderId:id,version:row.version,state:row.state,quote,acceptedQuoteId:row.accepted_quote_id,orderConfirmed:row.payment_verified,reservationExpiresAt:row.reservation_expires_at,reservationActive:row.stock_held && !!row.reservation_expires_at && new Date(row.reservation_expires_at).getTime()>now(),fundsRecorded:recorded,netReceivedKobo:ledger.net.toString(),refundedKobo:ledger.rows.reduce((sum,p)=>sum+BigInt(p.refunded_kobo),0n).toString(),...(admin?{payments,refunds:refundRows}:{})};
   });
  },
  async change(secret:string|undefined,id:string,input:Record<string,unknown>,action:'quote'|'accept-quote'|'record-payment'|'verify-payment') {
   uuid(id);const version=amount(input.version),customer=action==='accept-quote';
   return db.transaction(async tx=>{
    const by=await actor(tx,secret,customer?'customer':'admin'),initial=await load(tx,id);authorise(initial,by,customer);
    // Match catalogue/reservation lock order: vendor approval, product, stock, order.
    if(action!=='record-payment') {
     const vendor=(await tx.query<{status:string}>('SELECT status FROM vendor_applications WHERE user_id=$1 FOR SHARE',[initial.vendor_id])).rows[0];
     if(vendor?.status!=='approved') fail(409,'VENDOR_UNAVAILABLE','Fendor must resolve vendor availability.');
     const product=(await tx.query<{status:string;version:number}>('SELECT p.status,p.version FROM products p JOIN product_variants v ON v.product_id=p.id WHERE v.id=$1 FOR SHARE OF p',[initial.product_variant_id])).rows[0];
     if(product?.status!=='approved'||product.version!==initial.product_snapshot.productVersion) fail(409,'PRODUCT_CHANGED','Fendor must resolve the changed product.');
    }
    await tx.query('SELECT id FROM product_variants WHERE id=$1 FOR UPDATE',[initial.product_variant_id]);
    await tx.query('SELECT id FROM order_requests WHERE id=$1 FOR UPDATE',[id]);
    const row=await load(tx,id);
    if(action==='record-payment') {
     const reference=text(input.bankReference,'bank reference',3,160).toUpperCase(),received=amount(input.receivedKobo,1),note=text(input.receiptNote,'receipt note',5,1000);
     const existing=(await tx.query<{id:string;order_id:string;received_kobo:string}>('SELECT id,order_id,received_kobo FROM payment_records WHERE bank_reference=$1',[reference])).rows[0];
     if(existing) {if(existing.order_id!==id||Number(existing.received_kobo)!==received) fail(409,'REFERENCE_CONFLICT','Bank reference already recorded with different details.');return {paymentId:existing.id,orderId:id,version:row.version};}
     if(row.version!==version) fail(409,'STALE_VERSION','Reload the current order.');
     const paymentId=randomUUID();
     const inserted=(await tx.query('INSERT INTO payment_records(id,order_id,bank_reference,received_kobo,status,received_by,receipt_note) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(bank_reference) DO NOTHING RETURNING id',[paymentId,id,reference,received,'under_review',by,note])).rows;
     if(!inserted.length) fail(409,'REFERENCE_CONFLICT','Bank reference already recorded. Reload before retrying.');
     await tx.query('UPDATE order_requests SET version=version+1 WHERE id=$1',[id]);await audit(tx,row,by,row.state,'funds_recorded');
     return {paymentId,orderId:id,version:row.version+1};
    }
    if(row.financial_hold || (await tx.query("SELECT id FROM order_remedies WHERE order_id=$1 AND status IN ('requested','approved','closed')",[id])).rows.length) fail(409,'FINANCIAL_REVIEW','Resolve financial/remedy review first.');
    if(action==='verify-payment' && row.payment_verified) {
     const payment=(await tx.query('SELECT id FROM payment_records WHERE id=$1 AND order_id=$2 AND status=$3',[uuid(input.paymentId),id,'verified'])).rows[0];
     if(payment) return {orderId:id,state:row.state,version:row.version,orderConfirmed:true};
    }
    if(row.version!==version) fail(409,'STALE_VERSION','Reload the current order.');
    active(row);
    const receipts=(await tx.query<{id:string;received_kobo:string;status:string}>('SELECT id,received_kobo,status FROM payment_records WHERE order_id=$1 ORDER BY id',[id])).rows;
    if(action!=='verify-payment' && receipts.length) fail(409,'PAYMENT_REVIEW_REQUIRED','Resolve recorded funds before changing this quote.');
    if(action==='quote') {
     if(input.fulfilmentChecked!==true) fail(400,'FEASIBILITY_REQUIRED','Confirm packaging, delivery and preparation feasibility.');
     if(!(await tx.query('SELECT d.order_id FROM order_deliveries d JOIN delivery_zones z ON z.id=d.zone_id WHERE d.order_id=$1 AND z.active',[id])).rows.length) fail(409,'DELIVERY_REQUIRED','Select a supported delivery zone and save delivery details.');
     const plan=text(input.fulfilmentPlan,'fulfilment plan',10,2000);
     const packaging=amount(input.packagingKobo),delivery=amount(input.deliveryKobo),subtotal=amount(row.product_snapshot.unitPriceKobo*row.quantity,1),total=amount(subtotal+packaging+delivery,1);
     next(row,by,'admin',{type:'quote',totalKobo:total});
     const quoteId=randomUUID(),details={productSubtotalKobo:subtotal,packagingKobo:packaging,deliveryKobo:delivery,totalKobo:total,currency:'NGN',fulfilmentPlan:plan,fulfilmentChecked:true};
     await tx.query('INSERT INTO order_quotes(id,order_id,created_by,order_version,details) VALUES($1,$2,$3,$4,$5)',[quoteId,id,by,version+1,JSON.stringify(details)]);
     await tx.query("UPDATE order_requests SET quote_id=$2,accepted_quote_id=NULL,total_kobo=$3,accepted_total_kobo=NULL,state='reserved',version=version+1 WHERE id=$1",[id,quoteId,total]);
     await audit(tx,row,by,'reserved','quote_created');return {orderId:id,quoteId,version:version+1,totalKobo:total};
    }
    if(action==='accept-quote') {
     if(uuid(input.quoteId)!==row.quote_id) fail(409,'QUOTE_CHANGED','Review the current quote.');
     const total=amount(input.totalKobo,1);next(row,by,'customer',{type:'accept_quote',totalKobo:total});
     await tx.query('INSERT INTO quote_acceptances(id,order_id,quote_id,customer_id,total_kobo,order_version) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),id,row.quote_id,by,total,version+1]);
     await tx.query("UPDATE order_requests SET accepted_quote_id=quote_id,accepted_total_kobo=total_kobo,state='awaiting_payment',version=version+1 WHERE id=$1",[id]);
     await audit(tx,row,by,'awaiting_payment','quote_accepted');return {orderId:id,state:'awaiting_payment',version:version+1};
    }
    const paymentId=uuid(input.paymentId);
    if(input.bankReceiptChecked!==true) fail(400,'BANK_CHECK_REQUIRED','Verify actual receipt in Fendor’s bank account.');
    const ledger=await balances(tx,id);
    if(!ledger.rows.some(p=>p.id===paymentId && BigInt(p.received_kobo)>BigInt(p.refunded_kobo))) fail(409,'PAYMENT_REVIEW_REQUIRED','Select an outstanding receipt on this order.');
    if(ledger.net>BigInt(Number.MAX_SAFE_INTEGER)) fail(409,'PAYMENT_MISMATCH','Received funds exceed the supported quote range.');
    if(!row.quote_id||row.quote_id!==row.accepted_quote_id) fail(409,'QUOTE_CHANGED','Customer must accept the current quote.');
    next(row,by,'admin',{type:'verify_payment',receivedKobo:Number(ledger.net)});
    const allocated=(await tx.query('UPDATE product_variants SET stock_quantity=stock_quantity-$2,reserved_quantity=reserved_quantity-$2 WHERE id=$1 AND reserved_quantity>=$2 AND stock_quantity>=$2 RETURNING id',[row.product_variant_id,row.quantity])).rows;
    if(!allocated.length) fail(409,'STOCK_REVIEW_REQUIRED','Resolve the stock discrepancy before confirming.');
    for(const receipt of ledger.rows) if(BigInt(receipt.received_kobo)>BigInt(receipt.refunded_kobo)) await tx.query("UPDATE payment_records SET status='verified',verified_by=$2,verified_at=$3 WHERE id=$1",[receipt.id,by,new Date(now())]);
    await tx.query("UPDATE order_requests SET payment_verified=true,state='confirmed',stock_held=false,reservation_expires_at=NULL,version=version+1 WHERE id=$1",[id]);
    await audit(tx,row,by,'confirmed','payment_verified');return {orderId:id,state:'confirmed',version:version+1,orderConfirmed:true};
   });
  }
 };
}
