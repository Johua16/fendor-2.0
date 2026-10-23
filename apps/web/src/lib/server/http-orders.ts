import { refunds } from './refunds.ts';
import { checkout } from './checkout.ts';
import type { Database } from './database.ts';
import { orders } from './orders.ts';
import { body } from './http-input.ts';
import { fail } from './identity.ts';
export async function orderResponse(req:Request,path:string[],db:Database,secret:string|undefined,headers:Headers):Promise<Response|null> {
  const scope=path[0]==='orders'?'customer':path[1]==='orders' && ['vendor','admin'].includes(path[0])?path[0] as 'vendor'|'admin':null;
  if(!scope) return null;
  const rest=path.slice(scope==='customer'?1:2),service=orders(db,{reservationMinutes:Number(process.env.RESERVATION_MINUTES),responseMinutes:Number(process.env.VENDOR_RESPONSE_MINUTES)});
  const payments=checkout(db);
  if(req.method==='GET') {
    if(rest.length===2 && rest[1]==='checkout' && scope!=='vendor') return Response.json(await payments.summary(secret,rest[0],scope==='admin'),{headers});
    if(rest.length===0) return Response.json(await service.list(secret,scope,new URL(req.url).searchParams),{headers});
    if(rest.length===1) return Response.json({order:await service.detail(secret,rest[0],scope)},{headers});
  } else if(req.method==='POST') {
    if(scope==='admin' && rest.length===2 && ['record-refund','close-refunded'].includes(rest[1])) {
      const input=await body(req);
      const allowed=rest[1]==='record-refund'?['version','paymentId','bankReference','amountKobo','note','bankRefundChecked']:['version','note'];
      if(Object.keys(input).some(k=>!allowed.includes(k))) fail(400,'UNKNOWN_FIELD','Unexpected request fields.');
      return Response.json(await refunds(db).change(secret,rest[0],input,rest[1] as 'record-refund'|'close-refunded'),{headers});
    }
    const paymentAction=rest[1];
    if(rest.length===2 && (scope==='admin'?['quote','record-payment','verify-payment'].includes(paymentAction):scope==='customer'&&paymentAction==='accept-quote')) {
      const input=await body(req);
      const allowed:Record<string,string[]>={quote:['version','packagingKobo','deliveryKobo','fulfilmentChecked','fulfilmentPlan'],'record-payment':['version','bankReference','receivedKobo','receiptNote'],'verify-payment':['version','paymentId','bankReceiptChecked'],'accept-quote':['version','quoteId','totalKobo']};
      if(Object.keys(input).some(k=>!allowed[paymentAction].includes(k))) fail(400,'UNKNOWN_FIELD','Unexpected request fields.');
      return Response.json(await payments.change(secret,rest[0],input,paymentAction as 'quote'|'record-payment'|'verify-payment'|'accept-quote'),{headers});
    }
    const create=scope==='customer' && rest.length===0;
    const action=rest[1];
    if(!create && !(rest.length===2 && (scope==='customer'?['personalise','cancel'].includes(action):scope==='vendor'?['reserve','decline'].includes(action):false))) fail(404,'NOT_FOUND','Endpoint not found.');
    const input=await body(req);
    const fields=create?['clientRequestId','productVariantId','quantity']:action==='personalise'?['version','giftDetails']:['version'];
    if(Object.keys(input).some(k=>!fields.includes(k))) fail(400,'UNKNOWN_FIELD','Unexpected request fields.');
    const order=create?await service.create(secret,input):await service.change(secret,rest[0],input,action as 'personalise'|'cancel'|'reserve'|'decline');
    return Response.json({order},{status:create?201:200,headers});
  }
  fail(404,'NOT_FOUND','Endpoint not found.');
}
