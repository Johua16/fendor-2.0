import {database} from '../src/lib/server/database.ts';
import {randomUUID} from 'node:crypto';
if(!['localhost','127.0.0.1','::1'].includes(new URL(process.env.DATABASE_URL!).hostname))throw Error('Local test database required.');
const data:[string,number][]=[['Wuse',4500],['Maitama',5000],['Jabi',4000],['Utako',4000],['Kado',3500],['Wuye',4500],['Life Camp',2500],['Lugbe',6500]];
const db=database();try{for(const [name,naira] of data){const label=`${name} (provisional Kubwa test estimate)`;await db.query('INSERT INTO delivery_zones(id,name,state,city,fee_kobo) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS(SELECT 1 FROM delivery_zones WHERE name=$2 AND state=$3 AND city=$4)',[randomUUID(),label,'FCT','Abuja',naira*100]);}console.log(`Prepared ${data.length} provisional destination areas for local testing.`);}finally{await db.close();}
