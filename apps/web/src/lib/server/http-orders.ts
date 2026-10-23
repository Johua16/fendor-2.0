import type { Database } from './database.ts';
import { orders } from './orders.ts';
import { body } from './http-input.ts';
import { fail } from './identity.ts';
export async function orderResponse(req:Request,path:string[],db:Database,secret:string|undefined,headers:Headers):Promise<Response|null> {
  const scope=path[0]==='orders'?'customer':path[1]==='orders' && ['vendor','admin'].includes(path[0])?path[0] as 'vendor'|'admin':null;
  if(!scope) return null;
  const rest=path.slice(scope==='customer'?1:2),service=orders(db,{reservationMinutes:Number(process.env.RESERVATION_MINUTES)});
  if(req.method==='GET') {
    if(rest.length===0) return Response.json(await service.list(secret,scope,new URL(req.url).searchParams),{headers});
    if(rest.length===1) return Response.json({order:await service.detail(secret,rest[0],scope)},{headers});
  } else if(req.method==='POST') {
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
