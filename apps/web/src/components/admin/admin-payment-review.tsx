import { Icon } from '../ui/icon';
import styles from './admin-payment-review.module.css';

type Attempt = { provider: string; reference: string; provider_payment_id: string | null; provider_amount: string; provider_currency: string; status: string; failure_reason: string | null; expires_at?:string|null;last_checked_at?:string|null; created_at: string; updated_at: string };
type Receipt = { provider?: string | null };
type Refund = {id:string;bank_reference:string;amount_kobo:string;created_at:string};

export function AdminPaymentReview({ summary }: { summary: Record<string, unknown> | null }) {
  const attempts = Array.isArray(summary?.paymentAttempts) ? summary.paymentAttempts as Attempt[] : [];
  const receipts = Array.isArray(summary?.payments) ? summary.payments as Receipt[] : [];
  const refunds = Array.isArray(summary?.refunds) ? summary.refunds as Refund[] : [];
  const hold = summary?.financialHold === true;
  if (!attempts.length && !receipts.some(item => item.provider)) return null;
  return <section className={styles.wrap}>
    <div className={styles.title}><span><Icon name="wallet" size={19}/></span><div><h3>Online payment evidence</h3><p>Provider callbacks and webhooks are checked against the stored quote.</p></div></div>
    {hold&&<div className={styles.hold}><Icon name="alert-triangle" size={18}/><div><b>Financial review required</b><p>Money was verified, but Fendora could not safely confirm stock or the unchanged order. Do not fulfil until this hold is reconciled.</p></div></div>}
    <div className={styles.list}>{attempts.map(item=><article key={`${item.provider}-${item.reference}`}><header><b>{item.provider==='paypal'?'PayPal':item.provider[0]?.toUpperCase()+item.provider.slice(1)}</b><em data-status={item.status}>{item.status}</em></header><dl><dt>Reference</dt><dd>{item.reference}</dd><dt>Provider amount</dt><dd>{item.provider_amount||'—'} {item.provider_currency}</dd><dt>Provider ID</dt><dd>{item.provider_payment_id||'Waiting'}</dd><dt>Last checked</dt><dd>{item.last_checked_at?new Date(item.last_checked_at).toLocaleString():'Not checked yet'}</dd><dt>Attempt expires</dt><dd>{item.expires_at?new Date(item.expires_at).toLocaleString():'Completed'}</dd><dt>Last update</dt><dd>{new Date(item.updated_at).toLocaleString()}</dd></dl>{item.failure_reason&&<p className={styles.failure}>{item.failure_reason}</p>}</article>)}</div>
    {refunds.length>0&&<div className={styles.list}><h4>Recorded refunds</h4>{refunds.map(item=><article key={item.id}><header><b>Refund</b><em data-status="succeeded">recorded</em></header><dl><dt>Reference</dt><dd>{item.bank_reference}</dd><dt>Amount</dt><dd>₦{(Number(item.amount_kobo)/100).toLocaleString('en-NG')}</dd><dt>Recorded</dt><dd>{new Date(item.created_at).toLocaleString()}</dd></dl></article>)}</div>}
  </section>;
}
