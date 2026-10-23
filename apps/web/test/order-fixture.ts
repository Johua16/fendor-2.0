import {seal} from '../src/lib/server/security.ts';
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
    if(role==='vendor'){const document=randomUUID();await db.query("INSERT INTO uploads(id,owner_id,purpose,payload,bytes,status) VALUES($1,$2,'document',$3,1,'approved')",[document,id,seal('fixture','ab'.repeat(32))]);await db.query("INSERT INTO vendor_profiles(user_id,private_details,document_id,window_start,window_end) VALUES($1,$2,$3,now()-interval '1 hour',now()+interval '1 day')",[id,seal({phone:'+2348012345678',backupPhone:'+2348098765432',pickupAddress:'Abuja pickup point'},'ab'.repeat(32)),document]);}
    return {id,secret};
  }
  const customer=await user('customer'),other=await user('customer'),vendor=await user('vendor'),outsider=await user('vendor'),admin=await user('admin');
  const productId=randomUUID(),variantId=randomUUID();
  await db.query("INSERT INTO products(id,vendor_user_id,title,status) VALUES($1,$2,'Hamper','approved')",[productId,vendor.id]);
  await db.query("INSERT INTO product_variants(id,product_id,vendor_user_id,sku,price_kobo,stock_quantity) VALUES($1,$2,$3,'ONE',10000,1)",[variantId,productId,vendor.id]);
  let clock=Date.now();const api=orders(db,{reservationMinutes:30,responseMinutes:30,now:()=>clock});
  const input=()=>({clientRequestId:randomUUID(),productVariantId:variantId,quantity:1});
  async function seedDelivery(id:string) {const zone=randomUUID();await db.query("INSERT INTO delivery_zones(id,name,state,city) VALUES($1,'Central','FCT','Abuja')",[zone]);await db.query("INSERT INTO order_deliveries(order_id,zone_id,private_details,delivery_date) VALUES($1,$2,$3,current_date+1)",[id,zone,seal({recipientName:'Recipient',phone:'+2348012345678',address:'Private address, Abuja'},'ab'.repeat(32))]);}
  return {seedDelivery,db,api,customer,other,vendor,outsider,admin,productId,variantId,input,advance:()=>{clock+=31*60000;}};
}
