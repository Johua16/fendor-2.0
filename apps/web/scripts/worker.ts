import nodemailer from 'nodemailer';
import {database} from '../src/lib/server/database.ts';
import {config} from '../src/lib/server/config.ts';
import {runWorker} from '../src/lib/server/worker.ts';
const settings=config(),db=database();
if(!process.env.SMTP_URL||!process.env.MAIL_FROM)throw Error('SMTP_URL and MAIL_FROM required.');
const smtpUrl=new URL(process.env.SMTP_URL);smtpUrl.searchParams.set('connectionTimeout','10000');smtpUrl.searchParams.set('socketTimeout','15000');
const transport=nodemailer.createTransport(smtpUrl.toString(),{from:process.env.MAIL_FROM});
let stop=false;process.on('SIGTERM',()=>{stop=true;});process.on('SIGINT',()=>{stop=true;});
try{do {try{const result=await runWorker(db,settings.outboxKey,settings.origin,m=>transport.sendMail(m));console.log(JSON.stringify({event:'worker_cycle',...result}));}catch{console.error(JSON.stringify({event:'worker_cycle_failed'}));if(!process.argv.includes('--loop'))process.exitCode=1;}
 if(!process.argv.includes('--loop'))break;
 for(let i=0;i<30&&!stop;i++)await new Promise(resolve=>setTimeout(resolve,1000));
}while(!stop);}finally{transport.close();await db.close();}
