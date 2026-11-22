import {database} from '@/lib/server/database';
import {brevoWebhookAuthorised,recordBrevoDeliveryEvent} from '@/lib/server/brevo-webhook';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function authorised(request:Request){
 return brevoWebhookAuthorised(process.env.BREVO_WEBHOOK_SECRET,request.headers.get('x-fendora-webhook-secret')??undefined);
}
export async function POST(request:Request){
 if(!authorised(request))return Response.json({error:{code:'UNAUTHORISED',message:'Webhook access denied.'}},{status:401});
 let input:Record<string,unknown>;try{input=await request.json() as Record<string,unknown>;}catch{return Response.json({error:{code:'INVALID_EVENT',message:'Invalid event.'}},{status:400});}
 const recorded=await recordBrevoDeliveryEvent(database(),input);
 if(recorded)console.info(JSON.stringify({event:'brevo_delivery_status_recorded'}));
 return Response.json({accepted:true},{status:202});
}
