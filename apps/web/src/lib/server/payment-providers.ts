import { createHmac, timingSafeEqual } from 'node:crypto';

export type PaymentProvider = 'paystack' | 'flutterwave' | 'paypal';
export type CheckoutInput = { reference: string; amountKobo: number; email: string; name: string; orderId: string; origin: string };
export type CheckoutSession = { url: string; providerPaymentId: string | null; providerAmount: string; providerCurrency: string };
export type VerifiedPayment = { reference: string; providerPaymentId: string; providerAmount: string; providerCurrency: string; status: 'succeeded' | 'pending' | 'failed' };
type Json = Record<string, unknown>;

function required(name: string) { const value = process.env[name]?.trim(); if (!value) throw Error(`${name} is not configured.`); return value; }
function object(value: unknown): Json { return value && typeof value === 'object' ? value as Json : {}; }
function array(value: unknown): Json[] { return Array.isArray(value) ? value.map(object) : []; }
async function json(url: string, init: RequestInit = {}) { const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }); const payload = object(await response.json().catch(() => ({}))); if (!response.ok) throw Error(`Payment provider request failed (${response.status}).`); return payload; }
function equalSecret(left: string, right: string) { const a = Buffer.from(left), b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }

function sandboxPaymentsAllowed() {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_SANDBOX_PAYMENTS === 'true';
}

export function publicCheckoutEnabled() {
  return process.env.PUBLIC_CHECKOUT_ENABLED === 'true';
}

function productionCredential(provider: PaymentProvider) {
  if (provider === 'paystack') return process.env.PAYSTACK_SECRET_KEY?.trim().startsWith('sk_live_') === true;
  if (provider === 'flutterwave') {
    const key = process.env.FLUTTERWAVE_SECRET_KEY?.trim() ?? '';
    return key.startsWith('FLWSECK-') && !key.startsWith('FLWSECK_TEST-');
  }
  const origin = process.env.PAYPAL_API_ORIGIN?.trim() || 'https://api-m.sandbox.paypal.com';
  return origin === 'https://api-m.paypal.com';
}

function providerAllowed(provider: PaymentProvider) {
  return sandboxPaymentsAllowed() || productionCredential(provider);
}

function paystackWebhookValid(rawBody: string, headers: Headers) {
  const modern = headers.get('paystack-signature'), signingSecret = process.env.PAYSTACK_WEBHOOK_SECRET?.trim();
  if (modern && signingSecret) {
    const parts = modern.split(',').map(part => part.trim()), timestamp = parts.find(part => part.startsWith('t='))?.slice(2);
    const issuedAt = timestamp && /^\d+$/.test(timestamp) ? Number(timestamp) : NaN;
    if (Number.isFinite(issuedAt) && Math.abs(Date.now() / 1000 - issuedAt) <= 300) {
      const expected = createHmac('sha512', signingSecret).update(`${timestamp}.${rawBody}`).digest('hex');
      if (parts.filter(part => part.startsWith('v1=')).some(part => equalSecret(part.slice(3).split(':').at(-1) ?? '', expected))) return true;
    }
  }
  const legacy = headers.get('x-paystack-signature');
  if (!legacy) return false;
  const expected = createHmac('sha512', required('PAYSTACK_SECRET_KEY')).update(rawBody).digest('hex');
  return equalSecret(legacy, expected);
}

export function configuredProviders(): PaymentProvider[] {
  if (!publicCheckoutEnabled()) return [];
  const out: PaymentProvider[] = [];
  if (process.env.PAYSTACK_SECRET_KEY?.trim() && providerAllowed('paystack')) out.push('paystack');
  if (process.env.FLUTTERWAVE_SECRET_KEY?.trim() && process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH?.trim() && providerAllowed('flutterwave')) out.push('flutterwave');
  if (process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim() && process.env.PAYPAL_CURRENCY?.trim() && process.env.PAYPAL_NGN_PER_UNIT?.trim() && process.env.PAYPAL_WEBHOOK_ID?.trim() && providerAllowed('paypal')) out.push('paypal');
  return out;
}

async function paypalToken() { const id = required('PAYPAL_CLIENT_ID'), secret = required('PAYPAL_CLIENT_SECRET'); const base = process.env.PAYPAL_API_ORIGIN?.trim() || 'https://api-m.sandbox.paypal.com'; const result = await json(`${base}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' }); return { token: String(result.access_token), base }; }
function paypalMoney(kobo: number) { const providerCurrency = required('PAYPAL_CURRENCY').toUpperCase(); const rate = Number(required('PAYPAL_NGN_PER_UNIT')); if (!Number.isFinite(rate) || rate <= 0) throw Error('PAYPAL_NGN_PER_UNIT must be a positive approved rate.'); return { providerCurrency, providerAmount: (kobo / 100 / rate).toFixed(2) }; }

export async function createProviderCheckout(provider: PaymentProvider, input: CheckoutInput): Promise<CheckoutSession> {
  if (provider === 'paystack') { const secret = required('PAYSTACK_SECRET_KEY'); if(secret.startsWith('sk_live_')&&!input.origin.startsWith('https://')) throw Error('Live Paystack checkout requires a public HTTPS application origin.'); const body = await json('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: input.email, amount: input.amountKobo, currency: 'NGN', reference: input.reference, callback_url: `${input.origin}/api/payments/callback/paystack`, metadata: { orderId: input.orderId } }) }); const data = object(body.data); return { url: String(data.authorization_url), providerPaymentId: null, providerAmount: String(input.amountKobo), providerCurrency: 'NGN' }; }
  if (provider === 'flutterwave') { const providerAmount = (input.amountKobo / 100).toFixed(2); const body = await json('https://api.flutterwave.com/v3/payments', { method: 'POST', headers: { Authorization: `Bearer ${required('FLUTTERWAVE_SECRET_KEY')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ tx_ref: input.reference, amount: providerAmount, currency: 'NGN', redirect_url: `${input.origin}/api/payments/callback/flutterwave`, customer: { email: input.email, name: input.name }, meta: { orderId: input.orderId }, customizations: { title: 'Fendora', description: 'Verified Fendora order' } }) }); return { url: String(object(body.data).link), providerPaymentId: null, providerAmount, providerCurrency: 'NGN' }; }
  const { token, base } = await paypalToken(), money = paypalMoney(input.amountKobo); const body = await json(`${base}/v2/checkout/orders`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': input.reference }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: input.reference, custom_id: input.orderId, amount: { currency_code: money.providerCurrency, value: money.providerAmount } }], payment_source: { paypal: { experience_context: { return_url: `${input.origin}/api/payments/callback/paypal`, cancel_url: `${input.origin}/orders/${input.orderId}/checkout?payment=cancelled`, user_action: 'PAY_NOW' } } } }) }); const approve = array(body.links).find(link => link.rel === 'payer-action' || link.rel === 'approve')?.href; if (!approve) throw Error('PayPal approval URL was not returned.'); return { url: String(approve), providerPaymentId: String(body.id), ...money };
}

export async function verifyProviderPayment(provider: PaymentProvider, reference: string, externalId?: string, capture = true): Promise<VerifiedPayment> {
  if (provider === 'paystack') { const body = await json(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${required('PAYSTACK_SECRET_KEY')}` } }); const data = object(body.data), state = String(data.status); return { reference: String(data.reference), providerPaymentId: String(data.id), providerAmount: String(data.amount), providerCurrency: String(data.currency).toUpperCase(), status: state === 'success' ? 'succeeded' : state === 'pending' || state === 'ongoing' ? 'pending' : 'failed' }; }
  if (provider === 'flutterwave') { if (!externalId) throw Error('Flutterwave transaction ID is required.'); const body = await json(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(externalId)}/verify`, { headers: { Authorization: `Bearer ${required('FLUTTERWAVE_SECRET_KEY')}` } }); const data = object(body.data), state = String(data.status); return { reference: String(data.tx_ref), providerPaymentId: String(data.id), providerAmount: Number(data.amount).toFixed(2), providerCurrency: String(data.currency).toUpperCase(), status: state === 'successful' ? 'succeeded' : state === 'pending' ? 'pending' : 'failed' }; }
  const { token, base } = await paypalToken(); if (!externalId) throw Error('PayPal order ID is required.'); const url = `${base}/v2/checkout/orders/${encodeURIComponent(externalId)}${capture ? '/capture' : ''}`; const body = await json(url, capture ? { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `${reference}-capture` } } : { headers: { Authorization: `Bearer ${token}` } }); const unit = array(body.purchase_units)[0] ?? {}, payments = object(unit.payments), captureData = array(payments.captures)[0] ?? {}, amount = object(captureData.amount), state = String(captureData.status || body.status); return { reference: String(unit.reference_id), providerPaymentId: String(captureData.id || body.id), providerAmount: Number(amount.value).toFixed(2), providerCurrency: String(amount.currency_code).toUpperCase(), status: state === 'COMPLETED' ? 'succeeded' : state === 'PENDING' || state === 'APPROVED' ? 'pending' : 'failed' };
}

export async function verifyWebhook(provider: PaymentProvider, rawBody: string, headers: Headers) {
  if (provider === 'paystack') { if (!paystackWebhookValid(rawBody,headers)) throw Error('Invalid Paystack webhook signature.'); const event = object(JSON.parse(rawBody)), data = object(event.data); return String(event.event) === 'charge.success' ? { reference: String(data.reference), externalId: String(data.id), capture: false } : null; }
  if (provider === 'flutterwave') { const secret = required('FLUTTERWAVE_WEBHOOK_SECRET_HASH'), modern = headers.get('flutterwave-signature'), expected = createHmac('sha256', secret).update(rawBody).digest('base64'), legacy = headers.get('verif-hash'); if (!(modern ? equalSecret(modern, expected) : equalSecret(legacy ?? '', secret))) throw Error('Invalid Flutterwave webhook signature.'); const event = object(JSON.parse(rawBody)), data = object(event.data); return ['charge.completed', 'charge.successful'].includes(String(event.event)) && ['successful', 'succeeded'].includes(String(data.status).toLowerCase()) ? { reference: String(data.tx_ref), externalId: String(data.id), capture: false } : null; }
  const webhookId = required('PAYPAL_WEBHOOK_ID'), event = object(JSON.parse(rawBody)), { token, base } = await paypalToken(); const verification = await json(`${base}/v1/notifications/verify-webhook-signature`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_algo: headers.get('paypal-auth-algo'), cert_url: headers.get('paypal-cert-url'), transmission_id: headers.get('paypal-transmission-id'), transmission_sig: headers.get('paypal-transmission-sig'), transmission_time: headers.get('paypal-transmission-time'), webhook_id: webhookId, webhook_event: event }) }); if (verification.verification_status !== 'SUCCESS') throw Error('Invalid PayPal webhook signature.'); if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return null; const resource = object(event.resource), supplementary = object(resource.supplementary_data), related = object(supplementary.related_ids); return { reference: '', externalId: String(related.order_id), capture: false };
}
