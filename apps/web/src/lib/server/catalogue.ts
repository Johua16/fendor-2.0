import { randomUUID } from 'node:crypto';
import type { Database, Sql } from './database.ts';
import { fail, text } from './identity.ts';
import { digest } from './security.ts';

export function uuid(value: unknown): string {
  if(typeof value!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) fail(400,'INVALID_INPUT','Invalid ID.');
  return value.toLowerCase();
}
function integer(value: unknown, name:string, min=0, max=2147483647): number {
  if(typeof value!=='number' || !Number.isSafeInteger(value) || value<min || value>max) fail(400,'INVALID_INPUT',`Check ${name}.`);
  return value;
}
export const categories=['flowers','cakes','hampers','personalised-gifts','fashion','home','other'] as const;
function content(input:Record<string,unknown>) {
  const title=text(input.title,'title',2,160), description=text(input.description,'description',10,4000);
  const category=text(input.category,'category');
  if(!categories.includes(category as typeof categories[number])) fail(400,'INVALID_INPUT','Choose a supported category.');
  const imagePath=input.imagePath===null ? null : text(input.imagePath,'image path',1,300);
  // Only controlled, same-origin media. Never fetch arbitrary vendor URLs or render uploaded HTML/SVG.
  if(imagePath && !/^\/media\/catalogue\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(imagePath)) fail(400,'INVALID_INPUT','Use an approved catalogue media path.');
  return {title,description,category,imagePath,sku:text(input.sku,'SKU',1,80),priceKobo:integer(input.priceKobo,'price',1,Number.MAX_SAFE_INTEGER),stockQuantity:integer(input.stockQuantity,'stock')};
}
async function actor(tx:Sql,secret:string|undefined,role:'admin'|'vendor') {
  if(!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret)) fail(401,'UNAUTHENTICATED','Sign in to continue.');
  const user=(await tx.query<{id:string;verified:boolean;allowed:boolean}>(`SELECT u.id,u.email_verified_at IS NOT NULL AS verified,
    EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role=$3) AS allowed
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2`,[digest(secret),new Date(),role])).rows[0];
  if(!user) fail(401,'UNAUTHENTICATED','Sign in to continue.');
  if(!user.verified || !user.allowed) fail(403,'FORBIDDEN','Verified account with appropriate access required.');
  if(role==='vendor') await approvedVendor(tx,user.id);
  return user.id;
}
async function approvedVendor(tx:Sql,id:string) {
  // Hold approval stable until the write commits; suspension locks the same row.
  const application=(await tx.query<{status:string}>('SELECT status FROM vendor_applications WHERE user_id=$1 FOR SHARE',[id])).rows[0];
  if(application?.status!=='approved') fail(403,'VENDOR_NOT_APPROVED','Approved vendor access required.');
}
const publicGate=`p.status='approved' AND EXISTS(SELECT 1 FROM vendor_applications a WHERE a.user_id=p.vendor_user_id AND a.status='approved')
 AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=p.vendor_user_id AND r.role='vendor')`;
const columns=`p.id,p.vendor_user_id,p.title,p.description,p.category,p.image_path,p.status,p.version,p.review_note,
 v.id AS variant_id,v.sku,v.price_kobo,v.stock_quantity,v.reserved_quantity`;
type Row=Record<string,unknown>&{id:string;vendor_user_id:string;title:string;description:string;category:string;image_path:string|null;status:string;version:number;review_note:string|null;variant_id:string;sku:string;price_kobo:string|number;stock_quantity:number;reserved_quantity:number};
type PublicProduct={id:string;title:string;description:string;category:string;imagePath:string|null;variantId:string;priceKobo:number;currency:string;availability:string};
type ManagedProduct=PublicProduct&{status:string;version:number;reviewNote:string|null;sku:string;stockQuantity:number;reservedQuantity:number};
function present(row:Row,internal:true):ManagedProduct;
function present(row:Row,internal?:false):PublicProduct;
function present(row:Row,internal:boolean):PublicProduct|ManagedProduct;
function present(row:Row,internal=false):PublicProduct|ManagedProduct {
  const product={id:row.id,title:row.title,description:row.description,category:row.category,imagePath:row.image_path,
    variantId:row.variant_id,priceKobo:Number(row.price_kobo),currency:'NGN',availability:'confirmation_required'};
  return internal ? {...product,status:row.status,version:row.version,reviewNote:row.review_note,sku:row.sku,stockQuantity:row.stock_quantity,reservedQuantity:row.reserved_quantity} : product;
}
async function get(tx:Sql,id:string):Promise<Row> {
  const row=(await tx.query<Row>(`SELECT ${columns} FROM products p JOIN product_variants v ON v.product_id=p.id WHERE p.id=$1`,[id])).rows[0];
  if(!row) fail(404,'NOT_FOUND','Product not found.');
  return row;
}
export function catalogue(db:Database) {
  async function audit(tx:Sql,id:string,by:string,from:string|null,to:string,version:number,note:string) {
    await tx.query('INSERT INTO product_events(id,product_id,actor_id,from_status,to_status,product_version,note) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,by,from,to,version,note]);
  }
  async function mutate(secret:string|undefined,id:string,input:Record<string,unknown>,action:'edit'|'submit'|'pause'|'review') {
    uuid(id); const version=integer(input.version,'version');
    const edited=action==='edit'?content(input):undefined;
    return db.transaction(async tx=>{
      const by=await actor(tx,secret,action==='review'?'admin':'vendor');
      if(action!=='review') await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[by]);
      // Lock vendor before product, consistently with vendor writes and suspension.
      if(action==='review') {
        const owner=(await tx.query<{vendor_user_id:string}>('SELECT vendor_user_id FROM products WHERE id=$1',[id])).rows[0];
        if(!owner) fail(404,'NOT_FOUND','Product not found.');
        if(owner.vendor_user_id===by) fail(403,'SELF_REVIEW','You cannot review your own product.');
        await approvedVendor(tx,owner.vendor_user_id);
      }
      await tx.query('SELECT id FROM products WHERE id=$1 FOR UPDATE',[id]);
      const old=await get(tx,id);
      if(action!=='review' && old.vendor_user_id!==by) fail(404,'NOT_FOUND','Product not found.');
      if(old.version!==version) fail(409,'STALE_VERSION','Product changed. Reload before saving.');
      let status=old.status, note='';
      if(edited) {
        if(old.reserved_quantity>0) fail(409,'ACTIVE_RESERVATIONS','Product has active reservations. Contact Fendor before editing.');
        status='draft'; note='Product edited; fresh review required';
        await tx.query('UPDATE products SET title=$2,description=$3,category=$4,image_path=$5 WHERE id=$1',[id,edited.title,edited.description,edited.category,edited.imagePath]);
        const conflict=(await tx.query('SELECT id FROM product_variants WHERE vendor_user_id=$1 AND sku=$2 AND product_id<>$3',[by,edited.sku,id])).rows.length;
        if(conflict) fail(409,'SKU_EXISTS','SKU already belongs to another product.');
        await tx.query('UPDATE product_variants SET sku=$2,price_kobo=$3,stock_quantity=$4 WHERE product_id=$1',[id,edited.sku,edited.priceKobo,edited.stockQuantity]);
      } else if(action==='submit') {
        if(!['draft','rejected','paused'].includes(old.status)) fail(409,'INVALID_STATE','Product cannot be submitted in its current state.');
        if(!old.image_path) fail(400,'IMAGE_REQUIRED','Add an approved product image before submitting.');
        status='under_review'; note='Submitted for Fendor review';
      } else if(action==='pause') {
        if(!['approved','under_review'].includes(old.status)) fail(409,'INVALID_STATE','Only live or pending products can be paused.');
        status='paused'; note='Vendor paused listing';
      } else {
        const decision=text(input.decision,'decision'); note=text(input.note,'review note',1,1000);
        if(!['approved','rejected','paused'].includes(decision)) fail(400,'INVALID_INPUT','Invalid decision.');
        if(decision==='paused'?old.status!=='approved':old.status!=='under_review') fail(409,'INVALID_STATE','Review does not match the current state.');
        status=decision;
      }
      await tx.query('UPDATE products SET status=$2,version=version+1,review_note=$3,updated_at=now() WHERE id=$1',[id,status,action==='review'?note:null]);
      await audit(tx,id,by,old.status,status,version+1,note);
      return present(await get(tx,id),true);
    });
  }
  return {
    async create(secret:string|undefined,input:Record<string,unknown>) {
      const data=content(input);
      return db.transaction(async tx=>{
        const by=await actor(tx,secret,'vendor');
        // Serialize creates/edits for a vendor's SKU uniqueness and predictable conflicts.
        await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[by]);
        if((await tx.query('SELECT id FROM product_variants WHERE vendor_user_id=$1 AND sku=$2',[by,data.sku])).rows.length) fail(409,'SKU_EXISTS','SKU already exists.');
        const id=randomUUID();
        await tx.query('INSERT INTO products(id,vendor_user_id,title,description,category,image_path) VALUES($1,$2,$3,$4,$5,$6)',[id,by,data.title,data.description,data.category,data.imagePath]);
        await tx.query('INSERT INTO product_variants(id,product_id,vendor_user_id,sku,price_kobo,stock_quantity) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),id,by,data.sku,data.priceKobo,data.stockQuantity]);
        await audit(tx,id,by,null,'draft',0,'Product created');
        return present(await get(tx,id),true);
      });
    },
    mutate,
    async detail(id:string,secret?:string,scope:'public'|'vendor'|'admin'='public') {
      uuid(id);
      return db.transaction(async tx=>{
        const by=scope==='public'?undefined:await actor(tx,secret,scope);
        const row=(await tx.query<Row>(`SELECT ${columns} FROM products p JOIN product_variants v ON v.product_id=p.id WHERE p.id=$1 ${scope==='public'?`AND ${publicGate}`:scope==='vendor'?'AND p.vendor_user_id=$2':''}` ,scope==='vendor'?[id,by]:[id])).rows[0];
        if(!row) fail(404,'NOT_FOUND','Product not found.');
        return present(row,scope!=='public');
      });
    },
    async list(query:URLSearchParams,secret?:string,scope:'public'|'vendor'|'admin'='public') {
      const allowed=['limit','after','category','q','status'];
      if([...query.keys()].some(k=>!allowed.includes(k)||query.getAll(k).length!==1)) fail(400,'INVALID_INPUT','Unsupported or repeated query parameter.');
      const raw=query.get('limit')??'20';
      if(!/^\d+$/.test(raw)) fail(400,'INVALID_INPUT','Invalid page size.');
      const limit=integer(Number(raw),'limit',1,50);
      const after=query.get('after'); if(after) uuid(after);
      const category=query.get('category'); if(category && !categories.includes(category as typeof categories[number])) fail(400,'INVALID_INPUT','Invalid category.');
      const search=query.get('q')??''; if(search.length>100) fail(400,'INVALID_INPUT','Search too long.');
      const status=query.get('status');
      if(status && (scope==='public'||!['draft','under_review','approved','paused','rejected'].includes(status))) fail(400,'INVALID_INPUT','Invalid status filter.');
      return db.transaction(async tx=>{
        const by=scope==='public'?null:await actor(tx,secret,scope);
        const rows=(await tx.query<Row>(`SELECT ${columns} FROM products p JOIN product_variants v ON v.product_id=p.id
          WHERE ($1::uuid IS NULL OR p.id>$1) AND ($2::text IS NULL OR p.category=$2)
          AND strpos(lower(p.title),lower($3))>0 AND ($4::text IS NULL OR p.status=$4)
          ${scope==='public'?`AND ${publicGate}`:scope==='vendor'?'AND p.vendor_user_id=$6':''}
          ORDER BY p.id LIMIT $5`,scope==='vendor'?[after,category,search,status,limit+1,by]:[after,category,search,status,limit+1])).rows;
        return {products:rows.slice(0,limit).map(r=>present(r,scope!=='public')),nextCursor:rows.length>limit?rows[limit-1].id:null};
      });
    }
  };
}
