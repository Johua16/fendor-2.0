import { Icon } from '../ui/icon';
import styles from './admin-payment-review.module.css';

type Attempt = { provider: string; reference: string; provider_payment_id: string | null; provider_amount: string; provider_currency: string; status: string; failure_reason: string | null; created_at: string; updated_at: string };
type Receipt = { provider?: string | null };

export function AdminPaymentReview({ summary }: { summary: Record<string, unknown> | null }) {
  const attempts = Array.isArray(summary?.paymentAttempts) ? summary.paymentAttempts as Attempt[] : [];
  const receipts = Array.isArray(summary?.payments) ? summary.payments as Receipt[] : [];
  const hold = summary?.financialHold === true;
  if (!attempts.length && !receipts.some(item => item.provider)) return null;
  return <section className={styles.wrap}>
    <div className={styles.title}><span><Icon name="wallet" size={19}/></span><div><h3>Online payment evidence</h3><p>Provider callbacks and webhooks are checked against the stored quote.</p></div></div>
    {hold&&<div className={styles.hold}><Icon name="alert-triangle" size={18}/><div><b>Financial review required</b><p>Money was verified, but Fendora could not safely confirm stock or the unchanged order. Do not fulfil until this hold is reconciled.</p></div></div>}
    <div className={styles.list}>{attempts.map(item=><article key={`${item.provider}-${item.reference}`}><header><b>{item.provider==='paypal'?'PayPal':item.provider[0]?.toUpperCase()+item.provider.slice(1)}</b><em data-status={item.status}>{item.status}</em></header><dl><dt>Reference</dt><dd>{item.reference}</dd><dt>Provider amount</dt><dd>{item.provider_amount||'—'} {item.provider_currency}</dd><dt>Provider ID</dt><dd>{item.provider_payment_id||'Waiting'}</dd><dt>Last update</dt><dd>{new Date(item.updated_at).toLocaleString()}</dd></dl>{item.failure_reason&&<p className={styles.failure}>{item.failure_reason}</p>}</article>)}</div>
  </section>;
}
