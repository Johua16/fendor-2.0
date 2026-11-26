import { database } from '@/lib/server/database';
import { checkDatabase } from '@/lib/server/migrations';
import { config } from '@/lib/server/config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function diagnostic(error: unknown) {
  if (!(error instanceof Error)) return { name: 'UnknownError', code: '' };
  const code = 'code' in error ? String((error as Error & { code?: unknown }).code ?? '') : '';
  return { name: error.name, code };
}
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    config(); await checkDatabase(database());
    const minutes=Number(process.env.RESERVATION_MINUTES);
    if(!Number.isInteger(minutes)||minutes<1||minutes>1440) throw Error('Reservation policy required');
    const responseMinutes=Number(process.env.VENDOR_RESPONSE_MINUTES);
    if(!Number.isInteger(responseMinutes)||responseMinutes<1||responseMinutes>1440) throw Error('Vendor response policy required');
    return Response.json({ status: 'ready', scope: 'fendor-mvp-backend', emailDelivery: 'operations-worker-required' }, { headers });
  } catch (error) {
    console.error('Readiness check failed.', diagnostic(error));
    return Response.json({ status: 'not_ready', reason: 'Database, migrations, identity configuration or order timing policies unavailable.' }, { status: 503, headers });
  }
}
