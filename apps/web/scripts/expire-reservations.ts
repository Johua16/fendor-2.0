import { database } from '../src/lib/server/database.ts';
import { orders } from '../src/lib/server/orders.ts';
const db=database();
try {console.log(`Expired reservations released: ${await orders(db).expireBatch()}`);}
finally {await db.close();}
