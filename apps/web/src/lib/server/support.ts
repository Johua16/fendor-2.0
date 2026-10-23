import {randomUUID} from 'node:crypto';
import type {Database} from './database.ts';
import {actor,uuid} from './catalogue.ts';
import {text,fail} from './identity.ts';
import {integer,audit} from './operations-common.ts';
import {notify} from './notifications.ts';
export function support(db:Database,key:string,origin:string) {
 return {
  async create(secret:string|undefined,input:Record<string,unknown>) {
   const requestId=uuid(input.requestId),subject=text(input.subject,'subject',5,160),message=text(input.message,'message',5,4000),orderId=input.orderId?uuid(input.orderId):null;
   return db.transaction(async tx=>{const by=await actor(tx,secret,'customer');await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[by]);
    if(orderId&&!(await tx.query('SELECT id FROM order_requests WHERE id=$1 AND customer_id=$2',[orderId,by])).rows.length)fail(404,'NOT_FOUND','Order not found.');
    const old=(await tx.query<{id:string;subject:string;order_id:string|null}>('SELECT id,subject,order_id FROM support_cases WHERE customer_id=$1 AND request_id=$2',[by,requestId])).rows[0];
    if(old){const original=(await tx.query<{body:string}>('SELECT body FROM support_messages WHERE case_id=$1 ORDER BY created_at,id LIMIT 1',[old.id])).rows[0];if(old.subject!==subject||old.order_id!==orderId||original.body!==message)fail(409,'IDEMPOTENCY_CONFLICT','Request key already used.');return {id:old.id};}
    const id=randomUUID();await tx.query('INSERT INTO support_cases(id,customer_id,order_id,request_id,subject) VALUES($1,$2,$3,$4,$5)',[id,by,orderId,requestId,subject]);
    await tx.query('INSERT INTO support_messages(id,case_id,author_id,body) VALUES($1,$2,$3,$4)',[randomUUID(),id,by,message]);
    for(const admin of (await tx.query<{user_id:string}>("SELECT user_id FROM user_roles WHERE role='admin'")).rows)await notify(tx,admin.user_id,`case:${id}`,'New Fendor support case',`Case ${id} needs review.`,key,origin);
    return {id,version:0};});
  },
  async list(secret:string|undefined,admin:boolean,after?:string) {if(after)uuid(after);return db.transaction(async tx=>{const by=await actor(tx,secret,admin?'admin':'customer');const rows=(await tx.query(`SELECT id,order_id,status,subject,version,assigned_to FROM support_cases WHERE ($1::uuid IS NULL OR id>$1) ${admin?'':'AND customer_id=$2'} ORDER BY id LIMIT 51`,admin?[after??null]:[after??null,by])).rows;return {cases:rows.slice(0,50),nextCursor:rows.length>50?rows[49].id:null};});},
  async read(secret:string|undefined,id:string,admin:boolean,after?:string) {uuid(id);if(after)uuid(after);return db.transaction(async tx=>{const by=await actor(tx,secret,admin?'admin':'customer');const row=(await tx.query<{id:string;customer_id:string;order_id:string|null;status:string;subject:string;version:number;assigned_to:string|null}>('SELECT id,customer_id,order_id,status,subject,version,assigned_to FROM support_cases WHERE id=$1',[id])).rows[0];if(!row||(!admin&&row.customer_id!==by))fail(404,'NOT_FOUND','Case not found.');
   const messages=(await tx.query(`SELECT id,body,internal,created_at,CASE WHEN author_id=$2 THEN 'you' ELSE 'Fendor' END AS author FROM support_messages WHERE case_id=$1 ${admin?'':'AND NOT internal'} AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT 101`,[id,by,after??null])).rows;const {customer_id:_,...visible}=row;return {...visible,messages:messages.slice(0,100),nextCursor:messages.length>100?messages[99].id:null};});},
  async update(secret:string|undefined,id:string,input:Record<string,unknown>,admin:boolean) {
   uuid(id);return db.transaction(async tx=>{const by=await actor(tx,secret,admin?'admin':'customer');const row=(await tx.query<{customer_id:string;version:number;status:string}>('SELECT customer_id,version,status FROM support_cases WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row||(!admin&&row.customer_id!==by))fail(404,'NOT_FOUND','Case not found.');
    if(row.version!==integer(input.version))fail(409,'STALE_VERSION','Reload case.');
    const message=text(input.message,'message',1,4000),internal=admin&&input.internal===true;
    const status=admin?text(input.status,'status'):'open';if(!['open','waiting_customer','resolved'].includes(status))fail(400,'INVALID_INPUT','Invalid case status.');
    let assigned:string|null=null;if(admin&&input.assignedTo){assigned=uuid(input.assignedTo);if(!(await tx.query("SELECT user_id FROM user_roles WHERE user_id=$1 AND role='admin'",[assigned])).rows.length)fail(400,'INVALID_ASSIGNEE','Fendor operator required.');}
    await tx.query('INSERT INTO support_messages(id,case_id,author_id,body,internal) VALUES($1,$2,$3,$4,$5)',[randomUUID(),id,by,message,internal]);
    await tx.query('UPDATE support_cases SET status=$2,version=version+1,assigned_to=CASE WHEN $3 THEN $4::uuid ELSE assigned_to END WHERE id=$1',[id,status,admin,assigned]);
    if(admin&&!internal)await notify(tx,row.customer_id,`case:${id}:${row.version+1}`,'Fendor support reply',`Case ${id} has a reply. Open Fendor to read it.`,key,origin);
    if(!admin)for(const a of (await tx.query<{user_id:string}>("SELECT user_id FROM user_roles WHERE role='admin'")).rows)await notify(tx,a.user_id,`case:${id}:${row.version+1}`,'Customer support reply',`Case ${id} has a new message.`,key,origin);
    await audit(tx,by,id,'support_updated',status);return {id,status,version:row.version+1};});
  }
 };
}
