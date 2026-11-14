import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { database } from '@/lib/server/database';
import { config } from '@/lib/server/config';
import { onlinePayments } from '@/lib/server/online-payments';
import type { PaymentProvider } from '@/lib/server/payment-providers';
import { flushPendingCommunications } from '@/lib/server/communication-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const supported = new Set(['paystack', 'flutterwave', 'paypal']);

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = (await params).provider;
  if (!supported.has(provider)) return NextResponse.redirect(`${config().origin}/account?payment=invalid`);
  try { const result = await onlinePayments(database(), config().origin).callback(provider as PaymentProvider, new URL(request.url).searchParams); after(()=>flushPendingCommunications()); return NextResponse.redirect(`${config().origin}/orders/${result.orderId}/checkout?payment=${result.status}`); }
  catch { return NextResponse.redirect(`${config().origin}/account?payment=review`); }
}
