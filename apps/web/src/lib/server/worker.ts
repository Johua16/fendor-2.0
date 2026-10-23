import {randomUUID} from 'node:crypto';
import type {Database} from './database.ts';
import {orders} from './orders.ts';
import {produceNotifications} from './notifications.ts';
import {deliverOne} from './mail.ts';
export async function runWorker(db:Database,key:string,origin:string,send:(mail:{to:string;subject:string;text:string})=>Promise<unknown>) {
 const lease=randomUUID();
 const acquired=(await db.query("INSERT INTO worker_health(name,last_started,lease_until,lease_token) VALUES('operations',now(),now()+interval '5 minutes',$1) ON CONFLICT(name) DO UPDATE SET last_started=now(),lease_until=now()+interval '5 minutes',lease_token=$1 WHERE worker_health.lease_until IS NULL OR worker_health.lease_until<now() RETURNING name",[lease])).rows.length;
 if(!acquired)return {busy:true};
 let failures=0,sent=0;
 try {
  const expired=await orders(db).expireBatch();const notifications=await produceNotifications(db,key,origin);
  for(let i=0;i<20;i++) {const renewed=(await db.query("UPDATE worker_health SET lease_until=now()+interval '5 minutes' WHERE name='operations' AND lease_token=$1 RETURNING name",[lease])).rows.length;if(!renewed)throw Error('Worker lease lost');const outcome=await deliverOne(db,key,send);if(outcome==='empty')break;if(outcome==='failed')failures++;else sent++;}
  await db.query('DELETE FROM sessions WHERE expires_at<now()');await db.query('DELETE FROM identity_tokens WHERE expires_at<now()');await db.query('DELETE FROM auth_limits WHERE expires_at<now()');
  await db.query(`UPDATE worker_health SET ${failures?'last_failed':'last_succeeded'}=now(),lease_until=NULL WHERE name='operations' AND lease_token=$1`,[lease]);
  return {busy:false,expired,notifications,sent,failures};
 }catch(error){await db.query("UPDATE worker_health SET last_failed=now(),lease_until=NULL WHERE name='operations' AND lease_token=$1",[lease]);throw error;}
}
