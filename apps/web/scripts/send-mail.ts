import { database } from '../src/lib/server/database.ts';
import { config } from '../src/lib/server/config.ts';
import { deliverOne } from '../src/lib/server/mail.ts';
import { mailReplyContacts } from '../src/lib/server/mail-config.ts';
import {createEmailTransport,emailProviderConfigured} from '../src/lib/server/email-provider.ts';
const settings=config();
if(!emailProviderConfigured()) throw Error('Email delivery provider is not configured.');
const transport=createEmailTransport();
const db=database();
try {
  for(let i=0;i<50;i++) {
    const result=await deliverOne(db,settings.outboxKey,mail=>transport.send(mail),true,mailReplyContacts(),transport.policy);
    if(result==='empty') break;
    if(result==='failed') {process.exitCode=1; console.error('Email delivery failed. Check transport configuration.'); break;}
  }
} finally {transport.close(); await db.close();}
