import {database} from '../src/lib/server/database.ts';
import {config} from '../src/lib/server/config.ts';
import {runWorker} from '../src/lib/server/worker.ts';
import {mailReplyContacts} from '../src/lib/server/mail-config.ts';
import {createEmailTransport,emailProviderConfigured} from '../src/lib/server/email-provider.ts';
const settings=config(),db=database();
if(!emailProviderConfigured())throw Error('Email delivery provider is not configured.');
const transport=createEmailTransport();
let stop=false;process.on('SIGTERM',()=>{stop=true;});process.on('SIGINT',()=>{stop=true;});
try{do {try{const result=await runWorker(db,settings.outboxKey,settings.origin,m=>transport.send(m),20,true,mailReplyContacts(),transport.policy);console.log(JSON.stringify({event:'worker_cycle',...result}));}catch{console.error(JSON.stringify({event:'worker_cycle_failed'}));if(!process.argv.includes('--loop'))process.exitCode=1;}
 if(!process.argv.includes('--loop'))break;
 for(let i=0;i<30&&!stop;i++)await new Promise(resolve=>setTimeout(resolve,1000));
}while(!stop);}finally{transport.close();await db.close();}
