import { database } from '@/lib/server/database';
import { config } from '@/lib/server/config';
import { onlinePayments } from '@/lib/server/online-payments';
import { verifyWebhook, type PaymentProvider } from '@/lib/server/payment-providers';
import { flushPendingCommunications } from '@/lib/server/communication-runtime';
import { after } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const supported = new Set(['paystack', 'flutterwave', 'paypal']);

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = (await params).provider;
  if (!supported.has(provider)) return Response.json({ error: 'Unsupported provider.' }, { status: 404 });
  let event;
  try { event = await verifyWebhook(provider as PaymentProvider, await request.text(), request.headers); }
  catch { return Response.json({ error: 'Webhook could not be verified.' }, { status: 401 }); }
  if (!event) return Response.json({ received: true });
  try {
    const service = onlinePayments(database(), config().origin), eventId = await service.acceptWebhook(provider as PaymentProvider, event);
    if (!eventId) return Response.json({ error: 'Webhook could not be stored.' }, { status: 503 });
    after(async()=>{try { await service.processWebhook(eventId); await flushPendingCommunications(); } catch { console.error(JSON.stringify({event:'payment_webhook_processing_failed',provider,eventId})); }});
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: 'Webhook could not be stored.' }, { status: 503 });
  }
}
