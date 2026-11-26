import { randomUUID } from 'node:crypto';
import type { Database, Sql } from './database.ts';
import { actor, uuid } from './catalogue.ts';
import { fail } from './identity.ts';
import {
  configuredProviders,
  createProviderCheckout,
  PaymentProviderError,
  verifyProviderPayment,
  type PaymentProvider,
  type VerifiedPayment,
  type VerifiedWebhook,
} from './payment-providers.ts';

type Attempt = {
  id: string; order_id: string; customer_id: string; provider: PaymentProvider; reference: string;
  provider_payment_id: string | null; amount_kobo: string; provider_amount: string; provider_currency: string;
  status: string; checkout_url: string | null; expires_at: Date | null;
};
type OrderRow = Record<string, unknown> & {
  id: string; customer_id: string; vendor_id: string; product_variant_id: string; quantity: number; state: string;
  version: number; stock_held: boolean; reservation_expires_at: Date | null; accepted_total_kobo: string | null;
  payment_verified: boolean; financial_hold: boolean; quote_id: string | null; accepted_quote_id: string | null;
  product_snapshot: { productVersion?: number };
};
type Eligibility = { vendor_status: string | null; product_status: string | null; product_version: number | null; delivery_active: boolean; remedy_open: boolean };
type WebhookRow = { id: string; provider: PaymentProvider; reference: string; provider_payment_id: string | null; status: string; attempts: number };

async function attemptBy(db: Database | Sql, provider: PaymentProvider, reference: string, externalId?: string) {
  return (await db.query<Attempt>(reference ? 'SELECT * FROM payment_attempts WHERE provider=$1 AND reference=$2' : 'SELECT * FROM payment_attempts WHERE provider=$1 AND provider_payment_id=$2', [provider, reference || externalId])).rows[0];
}
function expectedProviderAmount(attempt: Attempt) { return attempt.provider_amount || (attempt.provider === 'paystack' ? attempt.amount_kobo : ''); }
function expectedProviderCurrency(attempt: Attempt) { return attempt.provider_currency || (attempt.provider === 'paystack' ? 'NGN' : ''); }
function exactPayment(attempt: Attempt, verified: VerifiedPayment) {
  return verified.reference === attempt.reference && verified.providerAmount === expectedProviderAmount(attempt) && verified.providerCurrency === expectedProviderCurrency(attempt);
}
async function eligibility(tx: Sql, row: OrderRow): Promise<Eligibility> {
  return (await tx.query<Eligibility>(`SELECT va.status AS vendor_status,p.status AS product_status,p.version AS product_version,
    EXISTS(SELECT 1 FROM order_deliveries d JOIN delivery_zones z ON z.id=d.zone_id WHERE d.order_id=$2 AND z.active) AS delivery_active,
    EXISTS(SELECT 1 FROM order_remedies r WHERE r.order_id=$2 AND r.status IN ('requested','approved')) AS remedy_open
    FROM product_variants v JOIN products p ON p.id=v.product_id
    LEFT JOIN vendor_applications va ON va.user_id=v.vendor_user_id WHERE v.id=$1`, [row.product_variant_id, row.id])).rows[0]
    ?? { vendor_status: null, product_status: null, product_version: null, delivery_active: false, remedy_open: false };
}
function eligibleForConfirmation(row: OrderRow, current: Eligibility, attempt: Attempt) {
  const reservationActive = row.stock_held && row.reservation_expires_at && new Date(row.reservation_expires_at).getTime() > Date.now();
  const quoteUnchanged = row.state === 'awaiting_payment' && row.quote_id === row.accepted_quote_id && Number(row.accepted_total_kobo) === Number(attempt.amount_kobo);
  const productCurrent = current.product_status === 'approved' && current.product_version === Number(row.product_snapshot?.productVersion);
  return Boolean(reservationActive && quoteUnchanged && !row.financial_hold && current.vendor_status === 'approved' && productCurrent && current.delivery_active && !current.remedy_open);
}
function assertEligibleToStart(row: OrderRow, current: Eligibility) {
  if (row.financial_hold || current.remedy_open) fail(409, 'FINANCIAL_REVIEW', 'Fendora must resolve the current payment or order review before checkout.');
  if (current.vendor_status !== 'approved') fail(409, 'VENDOR_UNAVAILABLE', 'Fendora must review vendor availability before payment.');
  if (current.product_status !== 'approved' || current.product_version !== Number(row.product_snapshot?.productVersion)) fail(409, 'PRODUCT_CHANGED', 'The product changed and must be reviewed before payment.');
  if (!current.delivery_active) fail(409, 'DELIVERY_REQUIRED', 'Delivery coverage must be confirmed before payment.');
}
async function insertVerifiedReceipt(tx: Sql, attempt: Attempt, verified: VerifiedPayment, receivedKobo = Number(attempt.amount_kobo)) {
  const id = randomUUID();
  return (await tx.query<{ id: string }>(`INSERT INTO payment_records(id,order_id,bank_reference,received_kobo,status,receipt_note,provider,provider_payment_id,verified_at)
    VALUES($1,$2,$3,$4,'verified',$5,$6,$7,now())
    ON CONFLICT(provider,provider_payment_id) WHERE provider_payment_id IS NOT NULL DO NOTHING RETURNING id`,
  [id, attempt.order_id, `${attempt.provider.toUpperCase()}:${verified.providerPaymentId}`, receivedKobo, `Verified automatically with ${attempt.provider}.`, attempt.provider, verified.providerPaymentId])).rows[0];
}

export function onlinePayments(db: Database, origin: string) {
  async function complete(provider: PaymentProvider, reference: string, externalId?: string, capture = true) {
    let attempt = await attemptBy(db, provider, reference, externalId);
    if (!attempt && provider === 'paypal' && externalId) attempt = await attemptBy(db, provider, '', externalId);
    if (!attempt) fail(404, 'NOT_FOUND', 'Payment attempt not found.');
    if (attempt.status === 'succeeded') {
      const order = (await db.query<{ payment_verified: boolean; financial_hold: boolean }>('SELECT payment_verified,financial_hold FROM order_requests WHERE id=$1', [attempt.order_id])).rows[0];
      return { orderId: attempt.order_id, status: order?.payment_verified && !order.financial_hold ? 'succeeded' : 'review' };
    }
    const verified = await verifyProviderPayment(provider, attempt.reference, externalId ?? attempt.provider_payment_id ?? undefined, capture);
    if (verified.reference !== attempt.reference) {
      await db.query("UPDATE payment_attempts SET status='failed',failure_reason='Provider reference mismatch.',last_checked_at=now(),updated_at=now() WHERE id=$1", [attempt.id]);
      fail(409, 'PAYMENT_MISMATCH', 'Provider payment reference does not match this order.');
    }
    if (verified.status !== 'succeeded') {
      await db.query('UPDATE payment_attempts SET status=$2,provider_payment_id=$3,last_checked_at=now(),updated_at=now() WHERE id=$1', [attempt.id, verified.status, verified.providerPaymentId]);
      return { orderId: attempt.order_id, status: verified.status };
    }
    if (!exactPayment(attempt, verified)) {
      return db.transaction(async tx => {
        const lockedAttempt=(await tx.query<Attempt>('SELECT * FROM payment_attempts WHERE id=$1 FOR UPDATE',[attempt.id])).rows[0];
        const initial=(await tx.query<OrderRow>('SELECT * FROM order_requests WHERE id=$1',[attempt.order_id])).rows[0];
        await tx.query('SELECT id FROM product_variants WHERE id=$1 FOR UPDATE',[initial.product_variant_id]);
        const row=(await tx.query<OrderRow>('SELECT * FROM order_requests WHERE id=$1 FOR UPDATE',[attempt.order_id])).rows[0];
        if(lockedAttempt.status==='succeeded')return {orderId:row.id,status:'review'};
        const actual=verified.providerCurrency==='NGN'&&/^\d+$/.test(verified.providerAmount)?Number(verified.providerAmount):NaN;
        if(Number.isSafeInteger(actual)&&actual>0)await insertVerifiedReceipt(tx,lockedAttempt,verified,actual);
        await tx.query("UPDATE payment_attempts SET status='succeeded',provider_payment_id=$2,provider_amount=$3,provider_currency=$4,failure_reason='Successful provider charge did not match the accepted order amount or currency.',last_checked_at=now(),updated_at=now() WHERE id=$1",[lockedAttempt.id,verified.providerPaymentId,verified.providerAmount,verified.providerCurrency]);
        await tx.query('UPDATE order_requests SET financial_hold=true,version=version+1 WHERE id=$1',[row.id]);
        await tx.query("INSERT INTO order_events(id,order_id,actor_id,from_state,to_state,order_version,event_type,review_note) VALUES($1,$2,NULL,$3,$3,$4,'online_payment_mismatch_received',$5)",[randomUUID(),row.id,row.state,row.version+1,`Provider reported ${verified.providerAmount} ${verified.providerCurrency}; accepted amount was ${lockedAttempt.amount_kobo} NGN kobo. Do not fulfil until reconciled.`]);
        return {orderId:row.id,status:'review'};
      });
    }
    return db.transaction(async tx => {
      const lockedAttempt = (await tx.query<Attempt>('SELECT * FROM payment_attempts WHERE id=$1 FOR UPDATE', [attempt.id])).rows[0];
      const initial = (await tx.query<OrderRow>('SELECT * FROM order_requests WHERE id=$1', [attempt.order_id])).rows[0];
      await tx.query('SELECT id FROM product_variants WHERE id=$1 FOR UPDATE', [initial.product_variant_id]);
      const row = (await tx.query<OrderRow>('SELECT * FROM order_requests WHERE id=$1 FOR UPDATE', [attempt.order_id])).rows[0];
      if (lockedAttempt.status === 'succeeded') return { orderId: row.id, status: row.payment_verified && !row.financial_hold ? 'succeeded' : 'review' };
      const receipt = await insertVerifiedReceipt(tx, lockedAttempt, verified);
      await tx.query("UPDATE payment_attempts SET status='succeeded',provider_payment_id=$2,last_checked_at=now(),updated_at=now() WHERE id=$1", [lockedAttempt.id, verified.providerPaymentId]);
      if (!receipt) return { orderId: row.id, status: row.payment_verified && !row.financial_hold ? 'succeeded' : 'review' };
      if (row.payment_verified) {
        await tx.query('UPDATE order_requests SET financial_hold=true,version=version+1 WHERE id=$1', [row.id]);
        await tx.query("INSERT INTO order_events(id,order_id,actor_id,from_state,to_state,order_version,event_type,review_note) VALUES($1,$2,NULL,$3,$3,$4,'duplicate_online_payment_received',$5)", [randomUUID(), row.id, row.state, row.version + 1, 'A distinct successful provider charge was received after this order had already been paid. Do not fulfil again; reconcile or refund the excess.']);
        return { orderId: row.id, status: 'review' };
      }
      const current = await eligibility(tx, row);
      const safe = eligibleForConfirmation(row, current, lockedAttempt);
      const allocated = safe ? (await tx.query('UPDATE product_variants SET stock_quantity=stock_quantity-$2,reserved_quantity=reserved_quantity-$2 WHERE id=$1 AND reserved_quantity>=$2 AND stock_quantity>=$2 RETURNING id', [row.product_variant_id, row.quantity])).rows.length > 0 : false;
      if (!allocated) {
        await tx.query('UPDATE order_requests SET financial_hold=true,version=version+1 WHERE id=$1', [row.id]);
        await tx.query("INSERT INTO order_events(id,order_id,actor_id,from_state,to_state,order_version,event_type,review_note) VALUES($1,$2,NULL,$3,$3,$4,'online_payment_review_required',$5)", [randomUUID(), row.id, row.state, row.version + 1, 'Payment succeeded after stock, vendor, product, delivery, remedy, financial hold or quote eligibility changed. Fendora review required.']);
        return { orderId: row.id, status: 'review' };
      }
      await tx.query("UPDATE order_requests SET payment_verified=true,state='confirmed',stock_held=false,reservation_expires_at=NULL,version=version+1 WHERE id=$1", [row.id]);
      await tx.query("INSERT INTO order_events(id,order_id,actor_id,from_state,to_state,order_version,event_type) VALUES($1,$2,NULL,$3,'confirmed',$4,'online_payment_verified')", [randomUUID(), row.id, row.state, row.version + 1]);
      return { orderId: row.id, status: 'succeeded' };
    });
  }

  async function start(secret: string | undefined, orderId: string, provider: PaymentProvider, reconciled = false): Promise<{ confirmed: boolean; url: string | null }> {
    uuid(orderId);
    if (!(['paystack', 'flutterwave', 'paypal'] as string[]).includes(provider)) fail(400, 'INVALID_PROVIDER', 'Choose a supported payment provider.');
    const prepared = await db.transaction(async tx => {
      const customer = await actor(tx, secret, 'customer');
      if (!configuredProviders(customer).includes(provider)) fail(503, 'PROVIDER_UNAVAILABLE', `${provider} checkout is not available for this account.`);
      const row = (await tx.query<OrderRow & { email: string; full_name: string }>('SELECT o.*,u.email,u.full_name FROM order_requests o JOIN users u ON u.id=o.customer_id WHERE o.id=$1 FOR UPDATE OF o', [orderId])).rows[0];
      if (!row || row.customer_id !== customer) fail(404, 'NOT_FOUND', 'Order not found.');
      if (row.payment_verified) return { kind: 'confirmed' as const };
      if (row.state !== 'awaiting_payment' || !row.accepted_total_kobo || row.quote_id !== row.accepted_quote_id) fail(409, 'QUOTE_REQUIRED', 'Accept the current quote before paying.');
      if (!row.stock_held || !row.reservation_expires_at || new Date(row.reservation_expires_at).getTime() <= Date.now()) fail(409, 'RESERVATION_EXPIRED', 'Reconfirm availability before payment.');
      assertEligibleToStart(row, await eligibility(tx, row));
      const existing = (await tx.query<Attempt>("SELECT * FROM payment_attempts WHERE order_id=$1 AND provider=$2 AND status IN ('initializing','pending') ORDER BY created_at DESC LIMIT 1", [orderId, provider])).rows[0];
      if (existing) {
        const expired = !existing.expires_at || new Date(existing.expires_at).getTime() <= Date.now();
        if (expired) return { kind: 'reconcile' as const, attempt: existing };
        if (existing.checkout_url) return { kind: 'existing' as const, url: existing.checkout_url };
        fail(409, 'PAYMENT_INITIALIZING', 'Secure checkout is still being prepared. Wait a moment before trying again.');
      }
      const id = randomUUID(), reference = `FENDOR-${orderId.slice(0, 8).toUpperCase()}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const providerAmount = provider === 'paystack' ? String(row.accepted_total_kobo) : '';
      const providerCurrency = provider === 'paystack' ? 'NGN' : '';
      await tx.query("INSERT INTO payment_attempts(id,order_id,customer_id,provider,reference,amount_kobo,provider_amount,provider_currency,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '30 minutes')", [id, orderId, customer, provider, reference, Number(row.accepted_total_kobo), providerAmount, providerCurrency]);
      return { kind: 'new' as const, id, reference, email: row.email, name: row.full_name, amountKobo: Number(row.accepted_total_kobo) };
    });
    if (prepared.kind === 'confirmed') return { confirmed: true, url: null };
    if (prepared.kind === 'existing') return { confirmed: false, url: prepared.url };
    if (prepared.kind === 'reconcile') {
      if (reconciled) fail(409, 'PAYMENT_REVIEW', 'The previous payment attempt still needs Fendora review.');
      try {
        const outcome = await complete(provider, prepared.attempt.reference, prepared.attempt.provider_payment_id ?? undefined, false);
        if (outcome.status === 'succeeded' || outcome.status === 'review') return { confirmed: true, url: null };
        if (outcome.status === 'pending') {
          await db.query("UPDATE payment_attempts SET expires_at=now()+interval '15 minutes',last_checked_at=now(),updated_at=now() WHERE id=$1 AND status='pending'", [prepared.attempt.id]);
          if (prepared.attempt.checkout_url) return { confirmed: false, url: prepared.attempt.checkout_url };
          fail(409, 'PAYMENT_PENDING', 'Paystack still reports this payment as pending. Do not pay again yet.');
        }
      } catch (error) {
        if (!(error instanceof PaymentProviderError && error.status === 404)) throw error;
        await db.query("UPDATE payment_attempts SET status='failed',failure_reason='Provider did not recognise the expired attempt.',last_checked_at=now(),updated_at=now() WHERE id=$1 AND status IN ('initializing','pending')", [prepared.attempt.id]);
      }
      return start(secret, orderId, provider, true);
    }
    try {
      const session = await createProviderCheckout(provider, { reference: prepared.reference, amountKobo: prepared.amountKobo, email: prepared.email, name: prepared.name, orderId, origin });
      await db.query("UPDATE payment_attempts SET status='pending',checkout_url=$2,provider_payment_id=$3,provider_amount=$4,provider_currency=$5,expires_at=now()+interval '30 minutes',updated_at=now() WHERE id=$1", [prepared.id, session.url, session.providerPaymentId, session.providerAmount, session.providerCurrency]);
      return { confirmed: false, url: session.url };
    } catch (error) {
      await db.query("UPDATE payment_attempts SET status='failed',failure_reason=$2,last_checked_at=now(),updated_at=now() WHERE id=$1", [prepared.id, error instanceof Error ? error.message.slice(0, 500) : 'Provider initialization failed']);
      throw error;
    }
  }

  async function acceptWebhook(provider: PaymentProvider, event: VerifiedWebhook) {
    if (!event.reference && !event.externalId) fail(400, 'INVALID_WEBHOOK', 'Payment webhook has no transaction identifier.');
    const key = `${event.eventType}:${event.externalId || event.reference}`, id = randomUUID();
    const inserted = (await db.query<{ id: string }>(`INSERT INTO payment_webhook_events(id,provider,event_key,event_type,reference,provider_payment_id)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(provider,event_key) DO NOTHING RETURNING id`, [id, provider, key, event.eventType, event.reference, event.externalId || null])).rows[0];
    if (inserted) return inserted.id;
    return (await db.query<{ id: string }>('SELECT id FROM payment_webhook_events WHERE provider=$1 AND event_key=$2', [provider, key])).rows[0]?.id;
  }

  async function processWebhook(id: string) {
    uuid(id);
    const claimed = (await db.query<WebhookRow>(`UPDATE payment_webhook_events SET status='processing',attempts=attempts+1,next_attempt_at=now()+interval '5 minutes',last_error=NULL
      WHERE id=$1 AND ((status IN ('pending','failed') AND next_attempt_at<=now()) OR (status='processing' AND next_attempt_at<=now()))
      RETURNING id,provider,reference,provider_payment_id,status,attempts`, [id])).rows[0];
    if (!claimed) return { processed: false };
    try {
      const outcome = await complete(claimed.provider, claimed.reference, claimed.provider_payment_id ?? undefined, false);
      if (outcome.status !== 'succeeded' && outcome.status !== 'review') {
        throw new Error(`Provider verification has not confirmed the signed ${claimed.provider} webhook yet.`);
      }
      await db.query("UPDATE payment_webhook_events SET status='processed',processed_at=now(),next_attempt_at='infinity'::timestamptz,last_error=NULL WHERE id=$1", [id]);
      return { processed: true };
    } catch (error) {
      await db.query("UPDATE payment_webhook_events SET status='failed',last_error=$2,next_attempt_at=now()+(LEAST(attempts,12)*interval '5 minutes') WHERE id=$1", [id, error instanceof Error ? error.message.slice(0, 500) : 'Payment webhook processing failed.']);
      throw error;
    }
  }

  return {
    async providers(secret: string | undefined) { const customer = await actor(db, secret, 'customer'); return configuredProviders(customer); },
    complete, start, acceptWebhook, processWebhook,
    async callback(provider: PaymentProvider, params: URLSearchParams) {
      const reference = params.get('reference') || params.get('tx_ref') || '';
      const externalId = params.get('transaction_id') || params.get('token') || undefined;
      const attempt = await attemptBy(db, provider, reference, externalId);
      if (!attempt) fail(404, 'NOT_FOUND', 'Payment attempt not found.');
      return complete(provider, attempt.reference, externalId, true);
    },
  };
}

export async function processPendingPaymentWebhooks(db: Database, origin: string, limit = 20) {
  const service = onlinePayments(db, origin);
  const rows = (await db.query<{ id: string }>(`SELECT id FROM payment_webhook_events
    WHERE status IN ('pending','failed','processing') AND next_attempt_at<=now()
    ORDER BY received_at,id LIMIT $1`, [limit])).rows;
  let processed = 0, failures = 0;
  for (const row of rows) {
    try { if ((await service.processWebhook(row.id)).processed) processed++; }
    catch { failures++; }
  }
  return { checked: rows.length, processed, failures };
}
