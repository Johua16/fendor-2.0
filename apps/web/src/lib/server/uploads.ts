import {randomUUID} from 'node:crypto';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import type {Database} from './database.ts';
import {ApiError,identity,fail,text} from './identity.ts';
import {actor,uuid} from './catalogue.ts';
import {seal,unseal} from './security.ts';
import {audit} from './operations-common.ts';
import {notify,notifyAdmins} from './notifications.ts';

type CloudflareImageInfo = {format?: unknown; fileSize?: unknown; width?: unknown; height?: unknown};
type CloudflareImagesBinding = {
 info(stream: ReadableStream<Uint8Array>): Promise<CloudflareImageInfo>;
 input(stream: ReadableStream<Uint8Array>): {
  transform(options: {width: number; height: number; fit: 'scale-down'}): {
   output(options: {format: 'image/webp'; quality: number; anim: false}): {response(): Promise<Response>};
  };
 };
};
const MAX_INPUT_BYTES=5*1024*1024;
const MAX_INPUT_PIXELS=20_000_000;
const MAX_INPUT_DIMENSION=10_000;
function stream(bytes: Buffer) {
 const body=new Response(new Uint8Array(bytes)).body;
 if(!body) throw Error('Image stream unavailable.');
 return body;
}
function supportedFormat(value: unknown) {
 const format=String(value??'').toLowerCase().replace(/^image\//,'');
 return ['jpeg','jpg','png','webp'].includes(format);
}
function integer(value: unknown) { return typeof value==='number'&&Number.isSafeInteger(value)&&value>0 ? value : 0; }
function cloudflareImages(): CloudflareImagesBinding|undefined {
 if(process.env.DATABASE_PROVIDER!=='cloudflare_hyperdrive') return undefined;
 try {
  const images=(getCloudflareContext().env as {IMAGES?: unknown}).IMAGES;
  if(images&&typeof (images as {info?:unknown}).info==='function'&&typeof (images as {input?:unknown}).input==='function') return images as CloudflareImagesBinding;
 } catch { /* A Worker request context is required below. */ }
 fail(503,'IMAGE_PROCESSING_UNAVAILABLE','Image processing is temporarily unavailable. Please try again shortly.');
}

/**
 * The Worker path validates the decoded image with Images.info(), then stores
 * only a freshly encoded still WebP. This deliberately discards EXIF, ICC,
 * animation frames, embedded payloads and the untrusted original bytes.
 */
export async function sanitiseCloudflareImage(bytes: Buffer, images: CloudflareImagesBinding): Promise<Buffer> {
 const info=await images.info(stream(bytes));
 const width=integer(info.width),height=integer(info.height);
 if(!supportedFormat(info.format)||!width||!height||width>MAX_INPUT_DIMENSION||height>MAX_INPUT_DIMENSION||width*height>MAX_INPUT_PIXELS) throw Error('format');
 if(typeof info.fileSize==='number'&&(!Number.isSafeInteger(info.fileSize)||info.fileSize<1||info.fileSize>MAX_INPUT_BYTES)) throw Error('size');
 const response=await images.input(stream(bytes)).transform({width:2400,height:2400,fit:'scale-down'}).output({format:'image/webp',quality:85,anim:false}).response();
 if(!response.ok||!response.headers.get('content-type')?.toLowerCase().startsWith('image/webp')) throw Error('transform');
 const clean=Buffer.from(await response.arrayBuffer());
 if(!clean.length||clean.length>MAX_INPUT_BYTES) throw Error('output');
 return clean;
}

async function sanitiseImage(bytes: Buffer): Promise<Buffer> {
 const images=cloudflareImages();
 if(images) return sanitiseCloudflareImage(bytes,images);
 // `sharp` is native Node code. Loading it while the catch-all API route is
 // initialised makes unrelated Cloudflare Worker requests (such as the public
 // catalogue) fail before their handler can run. Load it only for an upload,
 // where it is actually needed to strip untrusted image metadata.
 const { default: sharp } = await import('sharp');
 const decoder=sharp(bytes,{limitInputPixels:20000000,animated:false,failOn:'warning'});
 const meta=await decoder.metadata();
 const width=meta.width??0,height=meta.height??0;
 if(!['jpeg','png','webp'].includes(meta.format??'')||(meta.pages??1)>1||width>MAX_INPUT_DIMENSION||height>MAX_INPUT_DIMENSION||width*height>MAX_INPUT_PIXELS) throw Error('format');
 return decoder.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
}
export function uploads(db:Database,key:string,origin:string) {
 async function user(secret?:string) {const u=await identity(db,{origin,outboxKey:key}).me(secret);if(!u.verified) fail(403,'EMAIL_UNVERIFIED','Verify your email.');return u;}
 return {
  async create(secret:string|undefined,purpose:string,bytes:Buffer) {
   const u=await user(secret);
   if(!['product','document','proof'].includes(purpose)) fail(400,'INVALID_INPUT','Invalid purpose.');
   // Product media is accepted only from an approved vendor. Check before
   // decoding so ordinary customers cannot consume image-processing capacity.
   if(purpose==='product') await actor(db,secret,'vendor');
   if(purpose==='proof'&&!u.roles.includes('admin')) fail(403,'FORBIDDEN','Operator required.');
   if(!bytes.length||bytes.length>MAX_INPUT_BYTES) fail(413,'UPLOAD_TOO_LARGE','Maximum image size is 5 MB.');
   // Decode only raster formats, then re-encode: strips metadata, embedded payloads, animation and filenames.
   let clean:Buffer;
   try {clean=await sanitiseImage(bytes);}
   catch(error) {if(error instanceof ApiError) throw error;fail(400,'INVALID_IMAGE','Upload a valid JPEG, PNG or WebP image within the supported dimensions.');}
   if(clean.length>MAX_INPUT_BYTES) fail(413,'UPLOAD_TOO_LARGE','Decoded image too large.');
   return db.transaction(async tx=>{
    // Recheck under the transaction so an intervening vendor suspension cannot
    // leave a new product asset behind.
    if(purpose==='product') await actor(tx,secret,'vendor');
    await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[u.id]);
    const total=(await tx.query<{total:string}>('SELECT COALESCE(sum(bytes),0)::text AS total FROM uploads WHERE owner_id=$1',[u.id])).rows[0];
    if(Number(total.total)+clean.length>100*1024*1024) fail(409,'UPLOAD_QUOTA','Account upload quota reached.');
    const id=randomUUID(),status=purpose==='proof'?'approved':'pending';
    await tx.query('INSERT INTO uploads(id,owner_id,purpose,payload,bytes,status) VALUES($1,$2,$3,$4,$5,$6)',[id,u.id,purpose,seal(clean.toString('base64'),key),clean.length,status]);
    if(purpose==='proof') await audit(tx,u.id,id,'proof_uploaded','Delivery or return evidence uploaded by the assigned operator.');
    else await notifyAdmins(tx,`upload-review:${id}`,'Secure upload awaiting review',`${purpose==='product'?'A product image':'A vendor verification document'} has been uploaded and needs review.`,key,origin,'/admin/operations');
    return {id,purpose,status,imagePath:`/api/media/${id}`};
   });
  },
  async review(secret:string|undefined,id:string,input:Record<string,unknown>) {
   uuid(id);const note=text(input.note,'review note',5,1000);if(!['approved','rejected'].includes(String(input.status))) fail(400,'INVALID_INPUT','Invalid review status.');
   return db.transaction(async tx=>{const by=await actor(tx,secret,'admin');const row=(await tx.query<{owner_id:string;purpose:string}>('SELECT owner_id,purpose FROM uploads WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row) fail(404,'NOT_FOUND','Upload not found.');
    if(row.owner_id===by) fail(403,'SELF_REVIEW','Another operator must review the image.');
    await tx.query('UPDATE uploads SET status=$2 WHERE id=$1',[id,input.status]);await audit(tx,by,id,'upload_review',note);
    await notify(tx,row.owner_id,`upload-review:${id}:${input.status}`,'Fendora upload review update',`Your ${row.purpose==='product'?'product image':'verification document'} was ${String(input.status)}. Open Fendora to continue.`,key,origin,true,row.purpose==='product'?'/vendor/products':'/vendor/settings');
    return {id,status:input.status};});
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
