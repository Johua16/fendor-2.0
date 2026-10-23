import { randomUUID } from 'node:crypto';
import type { Database, Sql } from './database.ts';
import { actor, uuid } from './catalogue.ts';
import { fail, text } from './identity.ts';
import { transition, DomainError, type Order, type OrderState } from '../../../../../server/src/order.ts';
type Scope='customer'|'vendor'|'admin';
type Stored=Record<string,unknown>&{id:string;customer_id:string;vendor_id:string;product_variant_id:string;quantity:number;state:OrderState;version:number;stock_held:boolean;reservation_expires_at:Date|null;product_snapshot:Record<string,unknown>;gift_details:Record<string,unknown>;payment_verified:boolean};
function number(value:unknown,name:string,min=0,max=2147483647):number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max) fail(400,'INVALID_INPUT',`Check ${name}.`);
  return value;
}
function gifts(value:unknown) {
  if(!value||typeof value!=='object'||Array.isArray(value)) fail(400,'INVALID_INPUT','Gift details must be an object.');
  const fields:Record<string,number>={recipientName:100,occasion:100,relationship:100,giftMessage:1000,packagingPreference:200};
  const result:Record<string,string>={};
  for(const [key,item] of Object.entries(value)) {
    if(!Object.hasOwn(fields,key)) fail(400,'UNKNOWN_FIELD','Unsupported gift detail.');
    result[key]=text(item,key,0,fields[key]);
  }
  return result;
}
export function orders(db:Database,options:{now?:()=>number;reservationMinutes?:number}={}) {
  const now=options.now??Date.now;
  function present(row:Stored,scope:Scope) {
    const base={id:row.id,productVariantId:row.product_variant_id,quantity:row.quantity,state:row.state,version:row.version,product:row.product_snapshot,
      reservationExpiresAt:row.reservation_expires_at, reservationExpired:row.stock_held && !!row.reservation_expires_at && new Date(row.reservation_expires_at).getTime()<=now(),orderConfirmed:row.payment_verified};
    // Vendors only need the item/quantity to answer availability; personalisation stays with Fendor.
    return scope==='vendor'?base:{...base,giftDetails:row.gift_details};
  }
  async function event(tx:Sql,row:Stored,by:string|null,to:string,type:string) {
    await tx.query('INSERT INTO order_events(id,order_id,actor_id,from_state,to_state,order_version,event_type) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),row.id,by,row.state,to,row.version+1,type]);
  }
  async function owned(tx:Sql,id:string,by:string,scope:Scope,lock=false):Promise<Stored> {
    const row=(await tx.query<Stored>(`SELECT * FROM order_requests WHERE id=$1 ${lock?'FOR UPDATE':''}`,[id])).rows[0];
    if(!row || (scope==='customer'&&row.customer_id!==by)||(scope==='vendor'&&row.vendor_id!==by)) fail(404,'NOT_FOUND','Order request not found.');
    return row;
  }
  async function expireVariant(variantId:string) {
    return db.transaction(async tx=>{
      await tx.query('SELECT id FROM product_variants WHERE id=$1 FOR UPDATE',[variantId]);
      const expired=(await tx.query<Stored>('SELECT * FROM order_requests WHERE product_variant_id=$1 AND stock_held AND reservation_expires_at<=$2 ORDER BY id FOR UPDATE',[variantId,new Date(now())])).rows;
      for(const row of expired) {
        await tx.query('UPDATE product_variants SET reserved_quantity=reserved_quantity-$2 WHERE id=$1',[variantId,row.quantity]);
        await tx.query("UPDATE order_requests SET stock_held=false,state='checking_availability',reservation_expires_at=NULL,total_kobo=NULL,accepted_total_kobo=NULL,version=version+1 WHERE id=$1",[row.id]);
        await event(tx,row,null,'checking_availability','reservation_expired');
      }
      return expired.length;
    });
  }
  return {
    async expireBatch() {
      const rows=(await db.query<{product_variant_id:string}>('SELECT DISTINCT product_variant_id FROM order_requests WHERE stock_held AND reservation_expires_at<=$1 LIMIT 100',[new Date(now())])).rows;
      let count=0; for(const row of rows) count+=await expireVariant(row.product_variant_id);return count;
    },
    async create(secret:string|undefined,input:Record<string,unknown>) {
      const variant=uuid(input.productVariantId),key=uuid(input.clientRequestId),quantity=number(input.quantity,'quantity',1,1000);
      return db.transaction(async tx=>{
        const by=await actor(tx,secret,'customer');
        await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[by]);
        const old=(await tx.query<Stored>('SELECT * FROM order_requests WHERE customer_id=$1 AND client_request_id=$2',[by,key])).rows[0];
        if(old) {if(old.product_variant_id!==variant||old.quantity!==quantity) fail(409,'IDEMPOTENCY_CONFLICT','This request ID was already used for different items.');return present(old,'customer');}
        const product=(await tx.query<Record<string,unknown>&{vendor_user_id:string;title:string;price_kobo:string;sku:string;image_path:string;status:string}>(`SELECT p.vendor_user_id,p.title,p.status,p.version,p.image_path,v.sku,v.price_kobo FROM product_variants v JOIN products p ON p.id=v.product_id
          WHERE v.id=$1 AND p.status='approved' AND EXISTS(SELECT 1 FROM vendor_applications a WHERE a.user_id=p.vendor_user_id AND a.status='approved')
          AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=p.vendor_user_id AND r.role='vendor') FOR SHARE OF p,v`,[variant])).rows[0];
        if(!product) fail(404,'NOT_FOUND','Product is not available to request.');
        const id=randomUUID();
        const snapshot={title:product.title,imagePath:product.image_path,unitPriceKobo:Number(product.price_kobo),currency:'NGN',productVersion:product.version};
        await tx.query("INSERT INTO order_requests(id,customer_id,vendor_id,product_variant_id,quantity,state,client_request_id,product_snapshot) VALUES($1,$2,$3,$4,$5,'checking_availability',$6,$7)",[id,by,product.vendor_user_id,variant,quantity,key,JSON.stringify(snapshot)]);
        await tx.query("INSERT INTO order_events(id,order_id,actor_id,from_state,to_state,order_version,event_type) VALUES($1,$2,$3,'draft','checking_availability',0,'request_created')",[randomUUID(),id,by]);
        return present(await owned(tx,id,by,'customer'),'customer');
      });
    },
    async detail(secret:string|undefined,id:string,scope:Scope) {
      uuid(id);return db.transaction(async tx=>present(await owned(tx,id,await actor(tx,secret,scope),scope),scope));
    },
    async list(secret:string|undefined,scope:Scope,query:URLSearchParams) {
      if([...query.keys()].some(k=>!['after','limit'].includes(k)||query.getAll(k).length!==1)) fail(400,'INVALID_INPUT','Invalid query.');
      const after=query.get('after');if(after) uuid(after);
      const raw=query.get('limit')??'20';if(!/^\d+$/.test(raw)) fail(400,'INVALID_INPUT','Invalid limit.');
      const limit=number(Number(raw),'limit',1,50);
      return db.transaction(async tx=>{
        const by=await actor(tx,secret,scope);
        const rows=(await tx.query<Stored>(`SELECT * FROM order_requests WHERE ($1::uuid IS NULL OR id>$1) ${scope==='admin'?'':`AND ${scope==='customer'?'customer_id':'vendor_id'}=$3`} ORDER BY id LIMIT $2`,scope==='admin'?[after,limit+1]:[after,limit+1,by])).rows;
        return {orders:rows.slice(0,limit).map(row=>present(row,scope)),nextCursor:rows.length>limit?rows[limit-1].id:null};
      });
    },
    async change(secret:string|undefined,id:string,input:Record<string,unknown>,action:'personalise'|'cancel'|'reserve'|'decline') {
      uuid(id);const version=number(input.version,'version'),scope=action==='reserve'||action==='decline'?'vendor':'customer';
      const details=action==='personalise'?gifts(input.giftDetails):undefined;
      // Authorise before performing lazy expiry; unauthorised requests cannot trigger changes.
      const initial=await db.transaction(async tx=>owned(tx,id,await actor(tx,secret,scope),scope));
      await expireVariant(initial.product_variant_id);
      return db.transaction(async tx=>{
        const by=await actor(tx,secret,scope);
        if(action==='reserve') {
          const product=(await tx.query<{status:string;version:number}>('SELECT p.status,p.version FROM products p JOIN product_variants v ON v.product_id=p.id WHERE v.id=$1 FOR SHARE OF p',[initial.product_variant_id])).rows[0];
          if(product && product.version!==initial.product_snapshot.productVersion) fail(409,'PRODUCT_CHANGED','Product changed. Ask the customer to create a new request.');
          if(product?.status!=='approved') fail(409,'PRODUCT_UNAVAILABLE','Fendor must approve this listing before reserving it.');
        }
        const stock=(await tx.query<{stock_quantity:number;reserved_quantity:number}>('SELECT stock_quantity,reserved_quantity FROM product_variants WHERE id=$1 FOR UPDATE',[initial.product_variant_id])).rows[0];
        const row=await owned(tx,id,by,scope,true);
        if(row.version!==version) fail(409,'STALE_VERSION','Request changed. Reload before continuing.');
        if(details) {
          if(!['checking_availability','reserved'].includes(row.state)) fail(409,'INVALID_STATE','Personalisation cannot be changed now.');
          await tx.query('UPDATE order_requests SET gift_details=$2,version=version+1,total_kobo=NULL,accepted_total_kobo=NULL WHERE id=$1',[id,JSON.stringify(details)]);
          await event(tx,row,by,row.state,'personalisation_saved');
        } else {
          if(action==='reserve' && row.state!=='checking_availability') fail(409,'INVALID_STATE','Availability can only be confirmed for pending requests.');
          const minutes=options.reservationMinutes;
          if(action==='reserve' && (!Number.isInteger(minutes)||!minutes||minutes<1||minutes>1440)) fail(503,'RESERVATION_POLICY_REQUIRED','Fendor must configure its reservation duration.');
          const expiresAt=now()+(minutes??0)*60000;
          const domain:Order={id:row.id,customerId:row.customer_id,vendorId:row.vendor_id,productVariantId:row.product_variant_id,quantity:row.quantity,state:row.state,version:row.version,paymentVerified:row.payment_verified};
          let next:Order;
          try {next=transition(domain,{id:by,role:scope},action==='reserve'?{type:'reserve',expiresAt}:{type:action as 'cancel'|'decline'},now());}
          catch(error) {if(error instanceof DomainError) fail(409,error.code,error.message);throw error;}
          if(action==='reserve') {
            if(stock.stock_quantity-stock.reserved_quantity<row.quantity) fail(409,'INSUFFICIENT_STOCK','Not enough unreserved stock for this request.');
            await tx.query('UPDATE product_variants SET reserved_quantity=reserved_quantity+$2 WHERE id=$1',[row.product_variant_id,row.quantity]);
          } else if(row.stock_held) await tx.query('UPDATE product_variants SET reserved_quantity=reserved_quantity-$2 WHERE id=$1',[row.product_variant_id,row.quantity]);
          await tx.query('UPDATE order_requests SET state=$2,version=version+1,stock_held=$3,reservation_expires_at=$4,total_kobo=NULL,accepted_total_kobo=NULL WHERE id=$1',[id,next.state,action==='reserve',action==='reserve'?new Date(expiresAt):null]);
          await event(tx,row,by,next.state,action);
        }
        return present(await owned(tx,id,by,scope),scope);
      });
    }
  };
}
