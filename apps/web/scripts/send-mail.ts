import nodemailer from 'nodemailer';
import { database } from '../src/lib/server/database.ts';
import { config } from '../src/lib/server/config.ts';
import { deliverOne } from '../src/lib/server/mail.ts';
const settings=config();
if(!process.env.SMTP_URL || !process.env.MAIL_FROM) throw Error('SMTP_URL and MAIL_FROM required.');
const transport=nodemailer.createTransport(process.env.SMTP_URL,{from:process.env.MAIL_FROM});
const db=database();
try {
  for(let i=0;i<50;i++) {
    const result=await deliverOne(db,settings.outboxKey,mail=>transport.sendMail(mail));
    if(result==='empty') break;
    if(result==='failed') {process.exitCode=1; console.error('Email delivery failed. Check transport configuration.'); break;}
  }
} finally {transport.close(); await db.close();}
