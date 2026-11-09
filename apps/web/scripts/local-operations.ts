import {database} from '../src/lib/server/database.ts';
import {config} from '../src/lib/server/config.ts';
import {runWorker} from '../src/lib/server/worker.ts';
if(!['localhost','127.0.0.1','::1'].includes(new URL(process.env.DATABASE_URL!).hostname))throw Error('Local database required.');
const db=database(),settings=config();
let stop=false;process.on('SIGINT',()=>{stop=true;});process.on('SIGTERM',()=>{stop=true;});
try{while(!stop){try{console.log(JSON.stringify(await runWorker(db,settings.outboxKey,settings.origin,async()=>{throw Error('Local notification worker does not send email.');},0)));}catch{console.error('Local operations cycle failed');}for(let i=0;i<15&&!stop;i++)await new Promise(resolve=>setTimeout(resolve,1000));}}finally{await db.close();}
