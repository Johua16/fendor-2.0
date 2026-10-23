import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import type {Database} from './database.ts';
import {identity,fail,text} from './identity.ts';
import {actor,uuid} from './catalogue.ts';
import {seal,unseal} from './security.ts';
import {audit} from './operations-common.ts';
export function uploads(db:Database,key:string,origin:string) {
 async function user(secret?:string) {const u=await identity(db,{origin,outboxKey:key}).me(secret);if(!u.verified) fail(403,'EMAIL_UNVERIFIED','Verify your email.');return u;}
 return {
  async create(secret:string|undefined,purpose:string,bytes:Buffer) {
   const u=await user(secret);
   if(!['product','document','proof'].includes(purpose)) fail(400,'INVALID_INPUT','Invalid purpose.');
   if(purpose==='proof'&&!u.roles.includes('admin')) fail(403,'FORBIDDEN','Operator required.');
   if(!bytes.length||bytes.length>5*1024*1024) fail(413,'UPLOAD_TOO_LARGE','Maximum image size is 5 MB.');
   // Decode only raster formats, then re-encode: strips metadata, embedded payloads, animation and filenames.
   let clean:Buffer;
   try {const decoder=sharp(bytes,{limitInputPixels:20000000,animated:false,failOn:'warning'});const meta=await decoder.metadata();if(!['jpeg','png','webp'].includes(meta.format??'')||(meta.pages??1)>1) throw Error('format');clean=await decoder.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();}
   catch {fail(400,'INVALID_IMAGE','Upload a valid non-animated JPEG, PNG or WebP image.');}
   if(clean.length>5*1024*1024) fail(413,'UPLOAD_TOO_LARGE','Decoded image too large.');
   return db.transaction(async tx=>{
    await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[u.id]);
    const total=(await tx.query<{total:string}>('SELECT COALESCE(sum(bytes),0)::text AS total FROM uploads WHERE owner_id=$1',[u.id])).rows[0];
    if(Number(total.total)+clean.length>100*1024*1024) fail(409,'UPLOAD_QUOTA','Account upload quota reached.');
    const id=randomUUID();await tx.query('INSERT INTO uploads(id,owner_id,purpose,payload,bytes) VALUES($1,$2,$3,$4,$5)',[id,u.id,purpose,seal(clean.toString('base64'),key),clean.length]);
    return {id,purpose,status:'pending',imagePath:`/api/media/${id}`};
   });
  },
  async review(secret:string|undefined,id:string,input:Record<string,unknown>) {
   uuid(id);const note=text(input.note,'review note',5,1000);if(!['approved','rejected'].includes(String(input.status))) fail(400,'INVALID_INPUT','Invalid review status.');
   return db.transaction(async tx=>{const by=await actor(tx,secret,'admin');const row=(await tx.query<{owner_id:string}>('SELECT owner_id FROM uploads WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row) fail(404,'NOT_FOUND','Upload not found.');
    if(row.owner_id===by) fail(403,'SELF_REVIEW','Another operator must review the image.');
    await tx.query('UPDATE uploads SET status=$2 WHERE id=$1',[id,input.status]);await audit(tx,by,id,'upload_review',note);return {id,status:input.status};});
  },
  async read(secret:string|undefined,id:string) {
   uuid(id);const row=(await db.query<{owner_id:string;purpose:string;payload:string;status:string}>('SELECT owner_id,purpose,payload,status FROM uploads WHERE id=$1',[id])).rows[0];if(!row) fail(404,'NOT_FOUND','Image not found.');
   const live=row.purpose==='product'&&row.status==='approved'&&(await db.query("SELECT p.id FROM products p JOIN vendor_applications a ON a.user_id=p.vendor_user_id WHERE p.image_path=$1 AND p.status='approved' AND a.status='approved'",[`/api/media/${id}`])).rows.length>0;
   if(!live){const u=await user(secret);const customerProof=row.purpose==='proof'&&(await db.query('SELECT d.order_id FROM order_deliveries d JOIN order_requests o ON o.id=d.order_id WHERE d.proof_id=$1 AND o.customer_id=$2',[id,u.id])).rows.length>0;
    if(!u.roles.includes('admin')&&u.id!==row.owner_id&&!customerProof) fail(404,'NOT_FOUND','Image not found.');}
   return Buffer.from(unseal(row.payload,key) as string,'base64');
  }
 };
}
