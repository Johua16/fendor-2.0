import { health } from '@fendor/domain/health';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json(health(), { headers: { 'Cache-Control': 'no-store' } });
}
