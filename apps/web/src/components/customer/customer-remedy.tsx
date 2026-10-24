'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { CustomerServiceError, getOrderRemedy, OrderRemedy, requestOrderRemedy } from '../../lib/client/customer-service';
import { getOrderRequest, MarketplaceApiError, OrderRequest } from '../../lib/client/marketplace';
import { CustomerHeader } from './customer-orders';
import home from './home-page.module.css';
import styles from './customer-remedy.module.css';

const statusText = {
  requested: { title: 'Fendor review pending', copy: 'The operations team is reviewing the order, fulfilment stage, funds and requested outcome.' },
  approved: { title: 'Request approved', copy: 'Fendor is coordinating the required return, refund and stock checks. Approval does not mean money has already been sent.' },
  rejected: { title: 'Request not approved', copy: 'Review Fendor’s note below. You may contact support if material information was missed.' },
  closed: { title: 'Remedy completed', copy: 'Fendor has completed the recorded review, funds and physical-stock steps for this request.' },
} as const;
const money = (kobo: string | number) => `₦${Math.round(Number(kobo) / 100).toLocaleString('en-NG')}`;

export function CustomerRemedyPage({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderRequest | null>(null);
  const [remedy, setRemedy] = useState<OrderRemedy | null>(null);
  const [kind, setKind] = useState<'cancellation' | 'return'>('cancellation');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    Promise.all([getOrderRequest(id, controller.signal), getOrderRemedy(id, controller.signal)]).then(([orderResult, remedyResult]) => {
      setOrder(orderResult.order); setRemedy(remedyResult);
      if (['out_for_delivery', 'delivery_failed', 'delivered', 'returned'].includes(orderResult.order.state)) setKind('return');
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause : new Error('Fendor could not load this request.')); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, reload]);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!order) return; setSubmitting(true); setNotice('');
    try { await requestOrderRemedy(order.id, order.version, kind, reason); setReason(''); setNotice('Your request has been sent to Fendor for review.'); setReload((value) => value + 1); }
    catch (cause) { setNotice(cause instanceof CustomerServiceError && cause.code === 'RETURN_REQUIRED' ? 'This order has already been dispatched. Please request a return instead.' : cause instanceof CustomerServiceError && cause.code === 'STALE_VERSION' ? 'This order changed. Reload before sending the request again.' : cause instanceof Error ? cause.message : 'Fendor could not send this request.'); }
    finally { setSubmitting(false); }
  }

  const signedOut = (error instanceof MarketplaceApiError || error instanceof CustomerServiceError) && error.status === 401;
  const canCancel = !!order && ['confirmed', 'preparing', 'ready_for_dispatch'].includes(order.state);
  const canRequest = !!order?.orderConfirmed && !['refunded', 'cancelled'].includes(order.state) && (!remedy || remedy.status === 'rejected');
  return <div className={home.page}><CustomerHeader />{notice && <button className={home.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}<main className={`${home.shell} ${styles.main}`}><nav className={styles.back}><Link href={`/orders/${id}`}>← Back to request</Link></nav>
    {loading ? <section className={styles.state}><i /><h1>Loading remedy information</h1></section> : error ? <section className={styles.state} role="alert"><span>!</span><h1>{signedOut ? 'Sign in to continue' : 'We couldn’t load this review'}</h1><p>{signedOut ? 'Cancellation and return requests are private to your account.' : error.message}</p>{signedOut ? <Link href={`/login?next=${encodeURIComponent(`/orders/${id}/remedy`)}`}>Sign in</Link> : <button onClick={() => setReload((value) => value + 1)}>Try again</button>}</section> : order ? <>
      <div className={styles.head}><div><p className={home.kicker}>ORDER HELP</p><h1>Cancellation and return review</h1><p>{order.product.title} · Request {order.id.slice(0, 8).toUpperCase()}</p></div><Link href={`/support?order=${order.id}`}>Contact Fendor support</Link></div>
      <div className={styles.grid}>{remedy && remedy.status !== 'rejected' ? <section className={styles.existing}><span data-status={remedy.status}>{remedy.kind === 'return' ? 'RETURN' : 'CANCELLATION'}</span><h2>{statusText[remedy.status].title}</h2><p>{statusText[remedy.status].copy}</p><dl><div><dt>Your reason</dt><dd>{remedy.reason}</dd></div>{Number(remedy.refund_limit_kobo) > 0 && <div><dt>Maximum approved refund review</dt><dd>{money(remedy.refund_limit_kobo)}</dd></div>}{remedy.review_note && <div><dt>Fendor review note</dt><dd>{remedy.review_note}</dd></div>}{remedy.restock_quantity !== null && <div><dt>Quantity recorded back into stock</dt><dd>{remedy.restock_quantity}</dd></div>}</dl><div className={styles.process}><b>What happens next?</b><p>Fendor coordinates the vendor, physical item and verified bank records. Refunds are recorded only after the transfer is completed and checked.</p></div></section> : <form className={styles.form} onSubmit={submit}><h2>Ask Fendor to review this order</h2><p>Submitting starts a human review. It does not automatically cancel the order, approve a return or promise a refund.</p>{remedy?.status === 'rejected' && <div className={styles.rejected}><b>Previous request was not approved</b><span>{remedy.review_note ?? 'Contact Fendor if you have new information.'}</span></div>}<fieldset><legend>What do you need?</legend><label className={!canCancel ? styles.disabled : ''}><input type="radio" name="kind" value="cancellation" disabled={!canCancel} checked={kind === 'cancellation'} onChange={() => setKind('cancellation')} /><span><b>Cancel before dispatch</b><small>Available only while the paid order is still with the vendor or awaiting collection.</small></span></label><label><input type="radio" name="kind" value="return" checked={kind === 'return'} onChange={() => setKind('return')} /><span><b>Return or post-dispatch review</b><small>Use this once the goods have entered delivery or have been delivered.</small></span></label></fieldset><label className={styles.reason}>Why are you requesting this review?<textarea required minLength={10} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain what happened and the outcome you are requesting." /></label><button disabled={submitting || !canRequest}>{submitting ? 'Sending request…' : canRequest ? 'Send for Fendor review' : 'Review unavailable for this order'}</button></form>}
        <aside className={styles.rules}><h2>How Fendor protects this process</h2><ol><li><b>1</b><span>Fendor checks the payment and fulfilment record.</span></li><li><b>2</b><span>Dispatched items require a return review and physical evidence.</span></li><li><b>3</b><span>Approved refunds are recorded only after bank confirmation.</span></li><li><b>4</b><span>Stock is restored only after the returned item is inspected.</span></li></ol><p>Vendors cannot privately approve a refund or ask you to settle outside Fendor.</p></aside>
      </div>
    </> : null}
  </main></div>;
}
