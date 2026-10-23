import type {Database} from './database.ts';
import {body} from './http-input.ts';
import {fields} from './operations-common.ts';
import {identity,fail} from './identity.ts';
import {actor,uuid} from './catalogue.ts';
import {uploads} from './uploads.ts';
import {fulfilment} from './fulfilment.ts';
import {remedies} from './remedies.ts';
import {support} from './support.ts';
import {vendorProfile} from './vendor-profile.ts';
import {unseal} from './security.ts';
export async function operationsResponse(req:Request,path:string[],db:Database,secret:string|undefined,headers:Headers,settings:{outboxKey:string;origin:string}):Promise<Response|null> {
 const key=path.join('/'),admin=path[0]==='admin',files=uploads(db,settings.outboxKey,settings.origin),ship=fulfilment(db,settings.outboxKey),help=support(db,settings.outboxKey,settings.origin);
 const result=(value:unknown,status=200)=>Response.json(value,{status,headers});
 const query=new URL(req.url).searchParams;
 if(req.method==='GET') {
  if(path[0]==='media'&&path.length===2){const bytes=await files.read(secret,path[1]);return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'",'Content-Disposition':'inline'}});}
  if(key==='delivery-zones')return result({zones:await ship.zones()});
  if(key==='vendor/profile')return result(await vendorProfile(db,settings.outboxKey,settings.origin).read(secret));
  if(path[0]==='admin'&&path[1]==='vendor-profiles'&&path.length===3){await actor(db,secret,'admin');const row=(await db.query<{private_details:string}>('SELECT * FROM vendor_profiles WHERE user_id=$1',[uuid(path[2])])).rows[0];if(!row)fail(404,'NOT_FOUND','Profile not found.');const {private_details,...rest}=row;return result({...rest,...unseal(private_details,settings.outboxKey) as Record<string,unknown>});}
  if(key==='notifications'){const u=await identity(db,settings).me(secret);const after=query.get('after');if(after)uuid(after);const rows=(await db.query('SELECT id,title,message,read_at,created_at FROM notifications WHERE user_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT 51',[u.id,after])).rows;return result({notifications:rows.slice(0,50),nextCursor:rows.length>50?rows[49].id:null});}
  if(key==='admin/uploads'){await actor(db,secret,'admin');const after=query.get('after');if(after)uuid(after);return result({uploads:(await db.query("SELECT id,owner_id,purpose,status,created_at FROM uploads WHERE status='pending' AND ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 100",[after])).rows});}
  if(key==='admin/operations'){await actor(db,secret,'admin');return result({orders:(await db.query('SELECT state,count(*)::int AS count FROM order_requests GROUP BY state')).rows,
   overdue:(await db.query("SELECT id,version,availability_deadline FROM order_requests WHERE state='checking_availability' AND availability_deadline<now() ORDER BY availability_deadline LIMIT 100")).rows,
   finance:(await db.query('SELECT id,state,version FROM order_requests WHERE financial_hold ORDER BY id LIMIT 100')).rows,
   remedies:(await db.query("SELECT id,order_id,status,kind FROM order_remedies WHERE status IN ('requested','approved') ORDER BY created_at LIMIT 100")).rows,
   workers:(await db.query('SELECT name,last_started,last_succeeded,last_failed,lease_until FROM worker_health')).rows,
   mail:(await db.query('SELECT count(*)::int AS pending,count(*) FILTER(WHERE attempts>=5)::int AS failed FROM email_outbox WHERE sent_at IS NULL')).rows[0]});}
  if(key==='admin/audit'){await actor(db,secret,'admin');const after=query.get('after');if(after)uuid(after);return result({events:(await db.query('SELECT * FROM operation_audit WHERE ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 100',[after])).rows});}
  if(key==='admin/mail-failures'){await actor(db,secret,'admin');return result({failures:(await db.query('SELECT id,attempts,created_at,next_attempt_at FROM email_outbox WHERE sent_at IS NULL AND attempts>=5 ORDER BY created_at LIMIT 100')).rows});}
  if(path[0]==='support' || (admin&&path[1]==='support')){const rest=path.slice(admin?2:1);if(!rest.length)return result(await help.list(secret,admin,query.get('after')??undefined));if(rest.length===1)return result(await help.read(secret,rest[0],admin,query.get('after')??undefined));}
 }
 const scoped=path[0]==='orders'?'customer':path[1]==='orders'&&['vendor','admin'].includes(path[0])?path[0] as 'vendor'|'admin':null;
 if(scoped){const rest=path.slice(scoped==='customer'?1:2);if(rest.length===2) {
  if(req.method==='GET'&&rest[1]==='delivery')return result(await ship.read(secret,rest[0],scoped));
  if(req.method==='GET'&&rest[1]==='history'){await (await import('./orders.ts')).orders(db).detail(secret,rest[0],scoped);return result({events:(await db.query(`SELECT id,from_state,to_state,event_type,order_version,created_at ${scoped==='admin'?',review_note':''} FROM order_events WHERE order_id=$1 ORDER BY order_version LIMIT 500`,[rest[0]])).rows});}
  if(req.method==='GET'&&rest[1]==='remedy'&&scoped!=='vendor'){await (await import('./orders.ts')).orders(db).detail(secret,rest[0],scoped);return result((await db.query('SELECT id,kind,status,reason,refund_limit_kobo,review_note,restock_quantity FROM order_remedies WHERE order_id=$1',[rest[0]])).rows[0]??null);}
  if(req.method==='POST') {
   if(rest[1]==='delivery'&&scoped==='customer'){const input=await body(req);fields(input,['version','zoneId','recipientName','phone','address','instructions','deliveryDate']);return result(await ship.delivery(secret,rest[0],input));}
   const actions:Record<string,string[]>= {prepare:['version','note'],ready:['version','note'],dispatch:['version','note','assignedTo','trackingReference'],'delivery-failed':['version','note'],delivered:['version','note','proofId','proofChecked'],returned:['version','note','proofId','proofChecked']};
   if(actions[rest[1]]&&scoped!=='customer'){const input=await body(req);fields(input,actions[rest[1]]);return result(await ship.advance(secret,rest[0],input,rest[1],scoped));}
   const remedyActions:Record<string,string[]>={'request-remedy':['version','note','kind'],'review-remedy':['version','note','decision'],'close-remedy':['version','note','restockQuantity','stockChecked'],'correct-receipt':['version','note','paymentId','requestId','correctedKobo','bankChecked'],reconcile:['version','note','bankChecked']};
   if(remedyActions[rest[1]]){if(scoped!==(rest[1]==='request-remedy'?'customer':'admin'))fail(403,'FORBIDDEN','Wrong operation scope.');const input=await body(req);fields(input,remedyActions[rest[1]]);return result(await remedies(db).change(secret,rest[0],input,rest[1]));}
  }
 }}
 if(req.method==='POST') {
  if(key==='uploads') {
   await identity(db,settings).me(secret);
   const reader=req.body?.getReader();if(!reader)fail(400,'INVALID_IMAGE','Image required.');let size=0;const chunks:Uint8Array[]=[];
   while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>5*1024*1024){await reader.cancel();fail(413,'UPLOAD_TOO_LARGE','Maximum 5 MB.');}chunks.push(part.value);}
   return result(await files.create(secret,query.get('purpose')??'',Buffer.concat(chunks)),201);
  }
  if(admin&&path[1]==='uploads'&&path.length===4&&path[3]==='review'){const input=await body(req);fields(input,['status','note']);return result(await files.review(secret,path[2],input));}
  if(key==='vendor/profile'){const input=await body(req);fields(input,['version','phone','backupPhone','pickupAddress','documentId','windowStart','windowEnd']);return result(await vendorProfile(db,settings.outboxKey,settings.origin).save(secret,input));}
  if(key==='admin/delivery-zones'){const input=await body(req);fields(input,['id','name','state','city','active','version']);return result(await ship.zone(secret,input));}
  if(path[0]==='notifications'&&path.length===3&&path[2]==='read'){const u=await identity(db,settings).me(secret);const input=await body(req);fields(input,[]);const row=(await db.query('UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id',[uuid(path[1]),u.id])).rows[0];if(!row)fail(404,'NOT_FOUND','Notification not found.');return result(row);}
  if(admin&&path[1]==='mail-failures'&&path.length===4&&path[3]==='retry'){await actor(db,secret,'admin');fields(await body(req),[]);await db.query('UPDATE email_outbox SET attempts=0,next_attempt_at=now() WHERE id=$1 AND sent_at IS NULL',[uuid(path[2])]);return result({message:'Queued for retry.'});}
  if(key==='support'){const input=await body(req);fields(input,['requestId','subject','message','orderId']);return result(await help.create(secret,input),201);}
  if((path[0]==='support'&&path.length===2)||(admin&&path[1]==='support'&&path.length===3)){const input=await body(req);fields(input,admin?['version','message','internal','status','assignedTo']:['version','message']);return result(await help.update(secret,path[admin?2:1],input,admin));}
 }
 return null;
}
