import nodemailer from 'nodemailer';
import type {OutgoingMail} from './mail.ts';

export type EmailProviderName='brevo'|'smtp';
export type EmailSendResult={provider:EmailProviderName;messageId?:string;status:'accepted'};
export type EmailDeliveryPolicy={provider:EmailProviderName;dailyLimit:number;dailyReserve:number};
export type EmailTransport={send(mail:OutgoingMail):Promise<EmailSendResult>;close():void;policy:EmailDeliveryPolicy};

export class EmailProviderError extends Error {
 readonly code:string;
 constructor(code:string,message='Email provider request failed.'){super(message);this.name='EmailProviderError';this.code=code;}
}

type EmailEnvironment=Partial<Record<'EMAIL_PROVIDER'|'BREVO_API_KEY'|'EMAIL_FROM_ADDRESS'|'EMAIL_FROM_NAME'|'EMAIL_DAILY_LIMIT'|'EMAIL_DAILY_RESERVE'|'SMTP_URL'|'MAIL_FROM',string>>;

function integer(value:string|undefined,fallback:number,name:string){
 const parsed=value===undefined||value.trim()===''?fallback:Number(value);
 if(!Number.isSafeInteger(parsed)||parsed<0)throw new Error(`${name} must be a non-negative integer.`);
 return parsed;
}
function mailbox(value:string|undefined,name:string){
 const address=value?.trim();
 if(!address||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address))throw new Error(`${name} must be a single email address.`);
 return address;
}
function providerName(value:string|undefined):EmailProviderName{
 const provider=(value?.trim().toLowerCase()||'smtp');
 if(provider!=='brevo'&&provider!=='smtp')throw new Error('EMAIL_PROVIDER must be brevo or smtp.');
 return provider;
}

export function emailProviderConfigured(env:EmailEnvironment=process.env as EmailEnvironment){
 const provider=providerName(env.EMAIL_PROVIDER);
 return provider==='brevo'?Boolean(env.BREVO_API_KEY&&env.EMAIL_FROM_ADDRESS):Boolean(env.SMTP_URL&&env.MAIL_FROM);
}

export function createEmailTransport(env:EmailEnvironment=process.env as EmailEnvironment,request:typeof fetch=fetch):EmailTransport{
 const provider=providerName(env.EMAIL_PROVIDER);
 const dailyLimit=integer(env.EMAIL_DAILY_LIMIT,provider==='brevo'?300:0,'EMAIL_DAILY_LIMIT');
 const dailyReserve=integer(env.EMAIL_DAILY_RESERVE,provider==='brevo'?30:0,'EMAIL_DAILY_RESERVE');
 if(dailyLimit>0&&dailyReserve>=dailyLimit)throw new Error('EMAIL_DAILY_RESERVE must be lower than EMAIL_DAILY_LIMIT.');
 const policy={provider,dailyLimit,dailyReserve};
 if(provider==='brevo'){
  const apiKey=env.BREVO_API_KEY?.trim();if(!apiKey)throw new Error('BREVO_API_KEY is required for Brevo.');
  const address=mailbox(env.EMAIL_FROM_ADDRESS,'EMAIL_FROM_ADDRESS'),name=env.EMAIL_FROM_NAME?.trim()||'Fendora';
  return {policy,close(){},async send(mail){
   let response:Response;
   try{response=await request('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{accept:'application/json','api-key':apiKey,'content-type':'application/json'},body:JSON.stringify({sender:{name,email:address},to:[{email:mail.to}],subject:mail.subject,textContent:mail.text,htmlContent:mail.html,replyTo:mail.replyTo?{email:mail.replyTo}:undefined}),signal:AbortSignal.timeout(10000)});}
   catch{throw new EmailProviderError('BREVO_NETWORK_ERROR');}
   if(!response.ok)throw new EmailProviderError(response.status===429?'BREVO_RATE_LIMITED':`BREVO_HTTP_${response.status}`);
   const value=await response.json().catch(()=>({})) as {messageId?:unknown};
   if(typeof value.messageId!=='string'||!value.messageId)throw new EmailProviderError('BREVO_INVALID_RESPONSE');
   return {provider:'brevo',messageId:value.messageId,status:'accepted'};
  }};
 }
 const smtpUrl=env.SMTP_URL?.trim(),from=env.MAIL_FROM?.trim();if(!smtpUrl||!from)throw new Error('SMTP_URL and MAIL_FROM are required for SMTP.');
 const url=new URL(smtpUrl);url.searchParams.set('connectionTimeout','10000');url.searchParams.set('socketTimeout','15000');
 const transport=nodemailer.createTransport(url.toString(),{from});
 return {policy,close(){transport.close();},async send(mail){try{const result=await transport.sendMail(mail);return {provider:'smtp',messageId:result.messageId||undefined,status:'accepted'};}catch{throw new EmailProviderError('SMTP_DELIVERY_FAILED');}}};
}
