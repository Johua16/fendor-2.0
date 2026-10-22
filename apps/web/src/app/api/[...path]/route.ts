import { handleIdentity } from '@/lib/server/http-identity';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
export async function GET(req: Request, context: Context) { return handleIdentity(req, (await context.params).path); }
export async function POST(req: Request, context: Context) { return handleIdentity(req, (await context.params).path); }
