import { database } from '@/lib/server/database';
import { checkDatabase } from '@/lib/server/migrations';
import { config } from '@/lib/server/config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    config(); await checkDatabase(database());
    return Response.json({ status: 'ready', scope: 'identity-vendor-approval-and-catalogue', emailDelivery: 'outbox-worker-required' }, { headers });
  } catch {
    return Response.json({ status: 'not_ready', reason: 'Database, migrations or identity configuration unavailable.' }, { status: 503, headers });
  }
}
