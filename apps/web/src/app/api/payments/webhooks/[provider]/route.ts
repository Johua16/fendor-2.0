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
  try { const rawBody = await request.text(); const event = await verifyWebhook(provider as PaymentProvider, rawBody, request.headers); if (event) {await onlinePayments(database(), config().origin).complete(provider as PaymentProvider, event.reference, event.externalId, event.capture);after(()=>flushPendingCommunications());} return Response.json({ received: true }); }
  catch { return Response.json({ error: 'Webhook could not be verified.' }, { status: 401 }); }
}
