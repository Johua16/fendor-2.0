import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { testDatabase } from './database.ts';
import { migrate } from '../src/lib/server/migrations.ts';
import { orders } from '../src/lib/server/orders.ts';
import { digest,token } from '../src/lib/server/security.ts';
export async function fixture() {
  const db=await testDatabase();await migrate(db,resolve('../../server/db'));
  async function user(role:string) {
    const id=randomUUID(),secret=token();
    await db.query("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES($1,$2,'fixture',now())",[id,`${id}@example.com`]);
    await db.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)',[id,role]);
    await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')",[digest(secret),id]);
    if(role==='vendor') await db.query("INSERT INTO vendor_applications(id,user_id,business_name,status) VALUES($1,$2,'Gifts','approved')",[randomUUID(),id]);
    return {id,secret};
  }
  const customer=await user('customer'),other=await user('customer'),vendor=await user('vendor'),outsider=await user('vendor'),admin=await user('admin');
  const productId=randomUUID(),variantId=randomUUID();
  await db.query("INSERT INTO products(id,vendor_user_id,title,status) VALUES($1,$2,'Hamper','approved')",[productId,vendor.id]);
  await db.query("INSERT INTO product_variants(id,product_id,vendor_user_id,sku,price_kobo,stock_quantity) VALUES($1,$2,$3,'ONE',10000,1)",[variantId,productId,vendor.id]);
  let clock=Date.now();const api=orders(db,{reservationMinutes:30,now:()=>clock});
  const input=()=>({clientRequestId:randomUUID(),productVariantId:variantId,quantity:1});
  return {db,api,customer,other,vendor,outsider,admin,productId,variantId,input,advance:()=>{clock+=31*60000;}};
}
