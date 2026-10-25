'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { acceptOrderQuote, CheckoutSummary, getCheckoutSummary, MarketplaceApiError } from '../../lib/client/marketplace';
import { CustomerHeader } from './customer-orders';
import { Icon } from '../ui/icon';
import home from './home-page.module.css';
import styles from './customer-checkout.module.css';

function money(kobo: number) { return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`; }

export function CustomerCheckoutPage({ id }: { id: string }) {
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [error, setError] = useState<MarketplaceApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    getCheckoutSummary(id, controller.signal).then(setSummary).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error('Fendor could not load this quote.'));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, reload]);

  async function accept() {
    if (!summary?.quote) return;
    setAccepting(true); setNotice('');
    try {
      await acceptOrderQuote(summary.orderId, summary.version, summary.quote.id, summary.quote.details.totalKobo);
      setNotice('Quote accepted. Fendor will now provide the verified offline-payment instructions.');
      setReload((value) => value + 1);
    } catch (reason) {
      setNotice(reason instanceof MarketplaceApiError && ['STALE_VERSION', 'QUOTE_CHANGED'].includes(reason.code) ? 'The quote changed. Please review the latest version before accepting it.' : reason instanceof Error ? reason.message : 'Fendor could not accept this quote.');
    } finally { setAccepting(false); }
  }

  const signedOut = error instanceof MarketplaceApiError && error.status === 401;
  const accepted = summary?.quote && summary.acceptedQuoteId === summary.quote.id;
  return <div className={home.page}><CustomerHeader />{notice && <button className={home.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}<main className={`${home.shell} ${styles.main}`}>
    <nav className={styles.back}><Link href={`/orders/${id}`}>← Back to request</Link></nav>
    {loading ? <section className={styles.state}><i /><h1>Loading your Fendor quote</h1></section> : error ? <section className={styles.state} role="alert"><span><Icon name={signedOut?'user':'alert-triangle'} size={30}/></span><h1>{signedOut ? 'Sign in to review this quote' : 'We couldn’t load this quote'}</h1><p>{signedOut ? 'Quote and payment information is private to your account.' : error.message}</p>{signedOut ? <Link href={`/login?next=${encodeURIComponent(`/orders/${id}/checkout`)}`}>Sign in</Link> : <button onClick={() => setReload((value) => value + 1)}>Try again</button>}</section> : summary ? <>
      <div className={styles.head}><div><p className={home.kicker}>FENDOR QUOTE</p><h1>Review the complete order amount</h1><p>Check the product, packaging, delivery and fulfilment plan before accepting. A new quote always requires fresh approval.</p></div><span data-confirmed={summary.orderConfirmed}>{summary.orderConfirmed ? 'Payment verified' : accepted ? 'Quote accepted' : summary.quote ? 'Ready for review' : 'Quote being prepared'}</span></div>
      {!summary.quote ? <section className={styles.waiting}><span><Icon name="clock" size={30}/></span><div><h2>Fendor is preparing your quote</h2><p>The product may be available, but payment should wait until packaging, delivery coverage and timing are checked.</p></div></section> : <div className={styles.grid}>
        <section className={styles.quote}><div className={styles.quoteTitle}><div><small>QUOTE REFERENCE</small><b>{summary.quote.id.slice(0, 8).toUpperCase()}</b></div><span>{summary.quote.details.currency}</span></div><dl><div><dt>Product subtotal</dt><dd>{money(summary.quote.details.productSubtotalKobo)}</dd></div><div><dt>Packaging</dt><dd>{money(summary.quote.details.packagingKobo)}</dd></div><div><dt>Delivery</dt><dd>{money(summary.quote.details.deliveryKobo)}</dd></div><div className={styles.total}><dt>Total</dt><dd>{money(summary.quote.details.totalKobo)}</dd></div></dl><div className={styles.plan}><small>FULFILMENT PLAN CHECKED BY FENDOR</small><p>{summary.quote.details.fulfilmentPlan}</p></div>{!accepted && !summary.orderConfirmed && <button disabled={accepting || !summary.reservationActive} onClick={accept}>{accepting ? 'Accepting…' : summary.reservationActive ? 'Accept this quote' : 'Availability needs reconfirmation'}</button>}<p className={styles.consent}>By accepting, you approve this exact quote and total. Acceptance does not mean payment has been received.</p></section>
        <aside className={styles.payment}><h2>{summary.reviewMode ? 'Private review checkout' : 'Offline payment status'}</h2>{summary.reviewMode ? <div className={styles.review}><b>TEST MODE · No money will move</b><p>{summary.orderConfirmed ? 'A Fendor administrator simulated payment confirmation so the remaining fulfilment flow can be reviewed.' : accepted ? 'Your quote is accepted. A Fendor administrator can now simulate payment confirmation.' : 'Accept the quote to continue the review flow. Do not make a bank transfer.'}</p></div> : summary.orderConfirmed ? <div className={styles.verified}><b>✓ Payment verified</b><p>Fendor confirmed the funds in its bank records. The order can move into preparation.</p></div> : summary.fundsRecorded ? <div className={styles.review}><b>Funds under review</b><p>Fendor recorded a transaction, but the order remains unconfirmed until the bank record and total are verified.</p><strong>Recorded net amount: {money(Number(summary.netReceivedKobo))}</strong></div> : accepted ? summary.paymentInstructions ? <div className={styles.instructions}><b>Verified Fendor payment account</b><p><strong>{summary.paymentInstructions.bankName}</strong><br />{summary.paymentInstructions.accountName}<br /><strong>{summary.paymentInstructions.accountNumber}</strong></p><ol><li>Transfer the exact accepted total.</li><li>Use the request reference shown on this page.</li><li>Wait for Fendor to verify the transaction in its bank records.</li></ol><em>Never pay a vendor directly or use bank details sent outside Fendor.</em></div> : <div className={styles.review}><b>Payment instructions are being prepared</b><p>Do not transfer funds yet. Fendor support will notify you when the verified account is available.</p></div> : <div className={styles.muted}><b>Payment is not open yet</b><p>Review and accept the current quote first.</p></div>}{!summary.reviewMode && <div className={styles.safety}><b>Payment protection rule</b><p>A transfer alert, screenshot or receipt submission is not confirmation. Only Fendor’s bank verification confirms the order.</p></div>}</aside>
      </div>}
    </> : null}
  </main></div>;
}
