import { handleIdentity } from '@/lib/server/http-identity';
import { flushPendingCommunications } from '@/lib/server/communication-runtime';
import { after } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
type Context = { params: Promise<{ path: string[] }> };
export async function GET(req: Request, context: Context) { return handleIdentity(req, (await context.params).path); }
export async function POST(req: Request, context: Context) {
 const response=await handleIdentity(req,(await context.params).path);
 if(response.status<400)after(()=>flushPendingCommunications());
 return response;
}
