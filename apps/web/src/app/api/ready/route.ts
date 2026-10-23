import { database } from '@/lib/server/database';
import { checkDatabase } from '@/lib/server/migrations';
import { config } from '@/lib/server/config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    config(); await checkDatabase(database());
    const minutes=Number(process.env.RESERVATION_MINUTES);
    if(!Number.isInteger(minutes)||minutes<1||minutes>1440) throw Error('Reservation policy required');
    return Response.json({ status: 'ready', scope: 'identity-catalogue-and-order-requests', emailDelivery: 'outbox-worker-required' }, { headers });
  } catch {
    return Response.json({ status: 'not_ready', reason: 'Database, migrations, identity configuration or reservation policy unavailable.' }, { status: 503, headers });
  }
}
