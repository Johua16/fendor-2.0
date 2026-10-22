import { readiness } from '@fendor/domain/health';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json(readiness(), { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
