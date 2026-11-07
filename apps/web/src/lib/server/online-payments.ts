import { randomUUID } from 'node:crypto';
import type { Database, Sql } from './database.ts';
import { actor, uuid } from './catalogue.ts';
import { fail } from './identity.ts';
import { configuredProviders, createProviderCheckout, verifyProviderPayment, type PaymentProvider, type VerifiedPayment } from './payment-providers.ts';

type Attempt = { id: string; order_id: string; customer_id: string; provider: PaymentProvider; reference: string; provider_payment_id: string | null; amount_kobo: string; provider_amount: string; provider_currency: string; status: string; checkout_url: string | null };
type OrderRow = Record<string, unknown> & { id: string; customer_id: string; product_variant_id: string; quantity: number; state: string; version: number; stock_held: boolean; reservation_expires_at: Date | null; accepted_total_kobo: string | null; payment_verified: boolean; financial_hold: boolean; quote_id: string | null; accepted_quote_id: string | null };

async function attemptBy(db: Database | Sql, provider: PaymentProvider, reference: string, externalId?: string) { return (await db.query<Attempt>(reference ? 'SELECT * FROM payment_attempts WHERE provider=$1 AND reference=$2' : 'SELECT * FROM payment_attempts WHERE provider=$1 AND provider_payment_id=$2', [provider, reference || externalId])).rows[0]; }
function exactPayment(attempt: Attempt, verified: VerifiedPayment) { return verified.reference === attempt.reference && verified.providerAmount === attempt.provider_amount && verified.providerCurrency === attempt.provider_currency; }

export function onlinePayments(db: Database, origin: string) {
  async function complete(provider: PaymentProvider, reference: string, externalId?: string, capture = true) {
    let attempt = await attemptBy(db, provider, reference, externalId);
    if (!attempt && provider === 'paypal' && externalId) attempt = await attemptBy(db, provider, '', externalId);
    if (!attempt) fail(404, 'NOT_FOUND', 'Payment attempt not found.');
    if (attempt.status === 'succeeded') { const order = (await db.query<{ payment_verified: boolean; financial_hold: boolean }>('SELECT payment_verified,financial_hold FROM order_requests WHERE id=$1', [attempt.order_id])).rows[0]; return { orderId: attempt.order_id, status: order?.payment_verified ? 'succeeded' : 'review' }; }
    const verified = await verifyProviderPayment(provider, attempt.reference, externalId ?? attempt.provider_payment_id ?? undefined, capture);
    if (!exactPayment(attempt, verified)) { await db.query("UPDATE payment_attempts SET status='failed',failure_reason='Provider reference, amount or currency mismatch.',updated_at=now() WHERE id=$1", [attempt.id]); fail(409, 'PAYMENT_MISMATCH', 'Provider payment details do not match this order.'); }
    if (verified.status !== 'succeeded') { await db.query('UPDATE payment_attempts SET status=$2,provider_payment_id=$3,updated_at=now() WHERE id=$1', [attempt.id, verified.status, verified.providerPaymentId]); return { orderId: attempt.order_id, status: verified.status }; }
    return db.transaction(async tx => {
      const lockedAttempt = (await tx.query<Attempt>('SELECT * FROM payment_attempts WHERE id=$1 FOR UPDATE', [attempt.id])).rows[0];
      const initial = (await tx.query<OrderRow>('SELECT * FROM order_requests WHERE id=$1', [attempt.order_id])).rows[0];
      await tx.query('SELECT id FROM product_variants WHERE id=$1 FOR UPDATE', [initial.product_variant_id]);
      const row = (await tx.query<OrderRow>('SELECT * FROM order_requests WHERE id=$1 FOR UPDATE', [attempt.order_id])).rows[0];
      if (lockedAttempt.status === 'succeeded' || row.payment_verified) { await tx.query("UPDATE payment_attempts SET status='succeeded',provider_payment_id=$2,updated_at=now() WHERE id=$1", [attempt.id, verified.providerPaymentId]); return { orderId: row.id, status: row.payment_verified ? 'succeeded' : 'review' }; }
      const active = row.stock_held && row.reservation_expires_at && new Date(row.reservation_expires_at).getTime() > Date.now();
      const unchanged = row.state === 'awaiting_payment' && row.quote_id === row.accepted_quote_id && Number(row.accepted_total_kobo) === Number(attempt.amount_kobo);
      const allocated = active && unchanged ? (await tx.query('UPDATE product_variants SET stock_quantity=stock_quantity-$2,reserved_quantity=reserved_quantity-$2 WHERE id=$1 AND reserved_quantity>=$2 AND stock_quantity>=$2 RETURNING id', [row.product_variant_id, row.quantity])).rows.length > 0 : false;
      const paymentId = randomUUID();
      await tx.query("INSERT INTO payment_records(id,order_id,bank_reference,received_kobo,status,receipt_note,provider,provider_payment_id,verified_at) VALUES($1,$2,$3,$4,'verified',$5,$6,$7,now()) ON CONFLICT(provider,provider_payment_id) WHERE provider_payment_id IS NOT NULL DO NOTHING", [paymentId, row.id, `${provider.toUpperCase()}:${verified.providerPaymentId}`, Number(attempt.amount_kobo), `Verified automatically with ${provider}.`, provider, verified.providerPaymentId]);
      await tx.query("UPDATE payment_attempts SET status='succeeded',provider_payment_id=$2,updated_at=now() WHERE id=$1", [attempt.id, verified.providerPaymentId]);
      if (!allocated) { await tx.query('UPDATE order_requests SET financial_hold=true,version=version+1 WHERE id=$1', [row.id]); await tx.query("INSERT INTO order_events(id,order_id,actor_id,from_state,to_state,order_version,event_type,review_note) VALUES($1,$2,NULL,$3,$3,$4,'online_payment_review_required',$5)", [randomUUID(), row.id, row.state, row.version + 1, 'Payment succeeded after stock, reservation or quote changed. Fendor review required.']); return { orderId: row.id, status: 'review' }; }
      await tx.query("UPDATE order_requests SET payment_verified=true,state='confirmed',stock_held=false,reservation_expires_at=NULL,version=version+1 WHERE id=$1", [row.id]);
      await tx.query("INSERT INTO order_events(id,order_id,actor_id,from_state,to_state,order_version,event_type) VALUES($1,$2,NULL,$3,'confirmed',$4,'online_payment_verified')", [randomUUID(), row.id, row.state, row.version + 1]);
      return { orderId: row.id, status: 'succeeded' };
    });
  }

  return {
    providers: configuredProviders,
    complete,
    async callback(provider: PaymentProvider, params: URLSearchParams) { const reference = params.get('reference') || params.get('tx_ref') || ''; const externalId = params.get('transaction_id') || params.get('token') || undefined; const attempt = await attemptBy(db, provider, reference, externalId); if (!attempt) fail(404, 'NOT_FOUND', 'Payment attempt not found.'); if (params.get('status') === 'cancelled') { await db.query("UPDATE payment_attempts SET status='cancelled',updated_at=now() WHERE id=$1", [attempt.id]); return { orderId: attempt.order_id, status: 'cancelled' }; } return complete(provider, attempt.reference, externalId, true); },
    async start(secret: string | undefined, orderId: string, provider: PaymentProvider) {
      uuid(orderId); if (!(['paystack', 'flutterwave', 'paypal'] as string[]).includes(provider)) fail(400, 'INVALID_PROVIDER', 'Choose a supported payment provider.'); if (!configuredProviders().includes(provider)) fail(503, 'PROVIDER_UNAVAILABLE', `${provider} checkout is not configured yet.`);
      const prepared = await db.transaction(async tx => {
        const customer = await actor(tx, secret, 'customer'); const row = (await tx.query<OrderRow & { email: string; full_name: string }>('SELECT o.*,u.email,u.full_name FROM order_requests o JOIN users u ON u.id=o.customer_id WHERE o.id=$1 FOR UPDATE OF o', [orderId])).rows[0];
        if (!row || row.customer_id !== customer) fail(404, 'NOT_FOUND', 'Order not found.'); if (row.payment_verified) return { confirmed: true as const }; if (row.financial_hold) fail(409, 'FINANCIAL_REVIEW', 'Fendor is reviewing a previous payment on this order.'); if (row.state !== 'awaiting_payment' || !row.accepted_total_kobo || row.quote_id !== row.accepted_quote_id) fail(409, 'QUOTE_REQUIRED', 'Accept the current quote before paying.'); if (!row.stock_held || !row.reservation_expires_at || new Date(row.reservation_expires_at).getTime() <= Date.now()) fail(409, 'RESERVATION_EXPIRED', 'Reconfirm availability before payment.');
        const existing = (await tx.query<Attempt>("SELECT * FROM payment_attempts WHERE order_id=$1 AND provider=$2 AND status IN ('initializing','pending') ORDER BY created_at DESC LIMIT 1", [orderId, provider])).rows[0]; if (existing?.checkout_url) return { confirmed: false as const, existingUrl: existing.checkout_url };
        const id = randomUUID(), reference = `FENDOR-${orderId.slice(0, 8).toUpperCase()}-${Date.now()}`; await tx.query('INSERT INTO payment_attempts(id,order_id,customer_id,provider,reference,amount_kobo) VALUES($1,$2,$3,$4,$5,$6)', [id, orderId, customer, provider, reference, Number(row.accepted_total_kobo)]); return { confirmed: false as const, id, reference, email: row.email, name: row.full_name, amountKobo: Number(row.accepted_total_kobo) };
      });
      if (prepared.confirmed) return { confirmed: true, url: null }; if ('existingUrl' in prepared) return { confirmed: false, url: prepared.existingUrl };
      try { const session = await createProviderCheckout(provider, { reference: prepared.reference, amountKobo: prepared.amountKobo, email: prepared.email, name: prepared.name, orderId, origin }); await db.query("UPDATE payment_attempts SET status='pending',checkout_url=$2,provider_payment_id=$3,provider_amount=$4,provider_currency=$5,updated_at=now() WHERE id=$1", [prepared.id, session.url, session.providerPaymentId, session.providerAmount, session.providerCurrency]); return { confirmed: false, url: session.url }; } catch (error) { await db.query("UPDATE payment_attempts SET status='failed',failure_reason=$2,updated_at=now() WHERE id=$1", [prepared.id, error instanceof Error ? error.message : 'Provider initialization failed']); throw error; }
    }
  };
}
