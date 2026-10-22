import type { Database } from './database.ts';
import { catalogue } from './catalogue.ts';
import { body } from './http-input.ts';
import { fail } from './identity.ts';
const fields=['title','description','category','imagePath','sku','priceKobo','stockQuantity'];
export async function catalogueResponse(req:Request,path:string[],db:Database,secret:string|undefined,headers:Headers):Promise<Response|null> {
  const scope=path[0]==='products'?'public':path[1]==='products' && ['vendor','admin'].includes(path[0])?path[0] as 'vendor'|'admin':null;
  if(!scope) return null;
  const rest=path.slice(scope==='public'?1:2), service=catalogue(db);
  if(req.method==='GET') {
    if(rest.length===0) return Response.json(await service.list(new URL(req.url).searchParams,secret,scope),{headers});
    if(rest.length===1) return Response.json({product:await service.detail(rest[0],secret,scope)},{headers});
  } else if(req.method==='POST' && scope!=='public') {
    const create=scope==='vendor' && rest.length===0;
    const action=rest[1];
    const mutation=rest.length===2 && (scope==='admin'?action==='review':['edit','submit','pause'].includes(action));
    if(!create && !mutation) fail(404,'NOT_FOUND','Endpoint not found.');
    const input=await body(req);
    const allowed=create?fields:action==='edit'?['version',...fields]:action==='review'?['version','decision','note']:['version'];
    if(Object.keys(input).some(k=>!allowed.includes(k))) fail(400,'UNKNOWN_FIELD','Unexpected request fields.');
    const product=create?await service.create(secret,input):await service.mutate(secret,rest[0],input,action as 'edit'|'submit'|'pause'|'review');
    return Response.json({product},{status:create?201:200,headers});
  }
  fail(404,'NOT_FOUND','Endpoint not found.');
}
