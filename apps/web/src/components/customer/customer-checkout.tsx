'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { acceptOrderQuote, CheckoutSummary, getCheckoutSummary, MarketplaceApiError, startOnlinePayment } from '../../lib/client/marketplace';
import { CustomerHeader } from './customer-orders';
import { Icon } from '../ui/icon';
import {paymentDisplayStatus} from '../../lib/client/payment-status';
import {listPackagingOptions,PackagingOption,calculateOrderTotal,getOrderRequest} from '../../lib/client/marketplace';
import home from './home-page.module.css';
import styles from './customer-checkout.module.css';

function money(kobo: number) { return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`; }

export function CustomerCheckoutPage({ id }: { id: string }) {
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [error, setError] = useState<MarketplaceApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [packaging,setPackaging]=useState<PackagingOption[]>([]);
  const [packagingId,setPackagingId]=useState('');
  useEffect(()=>{getOrderRequest(id).then(({order})=>setPackagingId(order.giftDetails.packagingId??'')).catch(()=>{});},[id]);
  useEffect(()=>{listPackagingOptions().then(data=>setPackaging(data.options)).catch(()=>setNotice('Packaging options could not load. Refresh to try again.'));},[]);
  useEffect(()=>{const controller=new AbortController();const refresh=()=>{if(document.visibilityState==='visible')getCheckoutSummary(id,controller.signal).then(setSummary).catch(()=>{});};const timer=setInterval(refresh,10000);window.addEventListener('focus',refresh);return()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);};},[id]);
  async function calculate(){if(!summary)return;setAccepting(true);setNotice('');try{await calculateOrderTotal(id,summary.version,packagingId);setReload(value=>value+1);}catch(e){setNotice(e instanceof Error?e.message:'Could not calculate total.');}finally{setAccepting(false);}}

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    getCheckoutSummary(id, controller.signal).then(setSummary).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error('Fendora could not load this quote.'));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, reload]);
  useEffect(() => { const value = new URLSearchParams(window.location.search).get('payment'); if (value) setPaymentResult(value); }, []);

  async function accept() {
    if (!summary?.quote) return;
    setAccepting(true); setNotice('');
    try {
      await acceptOrderQuote(summary.orderId, summary.version, summary.quote.id, summary.quote.details.totalKobo);
      setNotice('Quote accepted. You can now choose a secure checkout provider.');
      setReload((value) => value + 1);
    } catch (reason) {
      setNotice(reason instanceof MarketplaceApiError && ['STALE_VERSION', 'QUOTE_CHANGED'].includes(reason.code) ? 'The quote changed. Please review the latest version before accepting it.' : reason instanceof Error ? reason.message : 'Fendora could not accept this quote.');
    } finally { setAccepting(false); }
  }
  async function pay(provider:'paystack'|'flutterwave'|'paypal') {setPaying(provider);setNotice('');try{const result=await startOnlinePayment(id,provider);if(result.confirmed){setReload(value=>value+1);return;}if(!result.url)throw new Error('The payment provider did not return a secure checkout link.');window.location.assign(result.url);}catch(reason){setNotice(reason instanceof Error?reason.message:'Fendora could not open secure checkout.');setPaying(null);}}

  const signedOut = error instanceof MarketplaceApiError && error.status === 401;
  const accepted = summary?.quote && summary.acceptedQuoteId === summary.quote.id;
  const result = summary ? paymentDisplayStatus(summary.orderConfirmed,summary.financialHold===true,summary.latestPayment?.status,paymentResult) : '';
  return <div className={home.page}><CustomerHeader />{notice && <button className={home.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}<main className={`${home.shell} ${styles.main}`}>
    <nav className={styles.back}><Link href={`/orders/${id}`}>← Back to request</Link></nav>
    {loading ? <section className={styles.state}><i /><h1>Loading your Fendora quote</h1></section> : error ? <section className={styles.state} role="alert"><span><Icon name={signedOut?'user':'alert-triangle'} size={30}/></span><h1>{signedOut ? 'Sign in to review this quote' : 'We couldn’t load this quote'}</h1><p>{signedOut ? 'Quote and payment information is private to your account.' : error.message}</p>{signedOut ? <Link href={`/login?next=${encodeURIComponent(`/orders/${id}/checkout`)}`}>Sign in</Link> : <button onClick={() => setReload((value) => value + 1)}>Try again</button>}</section> : summary ? <>
      {result&&<section className={styles.paymentResult} data-result={result} aria-live="polite"><span><Icon name={result==='succeeded'?'check-circle':result==='review'||result==='failed'?'alert-triangle':'clock'} size={24}/></span><div><b>{result==='succeeded'?'Payment verified':result==='pending'||result==='initializing'?'Payment is still processing':result==='cancelled'?'Checkout was cancelled':result==='review'?'Payment received — Fendora review required':'Payment was not completed'}</b><p>{result==='succeeded'?'Your order is confirmed and can move into preparation.':result==='pending'||result==='initializing'?'We are waiting for the provider’s final confirmation. Do not pay again while this check is in progress.':result==='cancelled'?'No confirmed payment was recorded. You can choose a payment method when ready.':result==='review'?'Your money is recorded, but stock or order details need an administrator’s review before fulfilment.':'Fendora did not confirm a successful charge. You can safely try another available method.'}</p></div>{(result==='pending'||result==='initializing')&&<button onClick={()=>setReload(value=>value+1)}>Check again</button>}</section>}
      <div className={styles.head}><div><p className={home.kicker}>CHECKOUT</p><h1>Review the complete order amount</h1><p>Check the product, packaging, delivery and fulfilment plan before accepting. A new quote always requires fresh approval.</p></div><span data-confirmed={summary.orderConfirmed}>{summary.orderConfirmed ? 'Payment verified' : summary.financialHold ? 'Fendora review' : accepted ? 'Quote accepted' : summary.quote ? 'Ready for review' : 'Complete your checkout'}</span></div>
      {!summary.orderConfirmed && !accepted && <section className={styles.quote}><h2>Packaging and delivery</h2><p><Link href={`/orders/${id}/delivery`}>Enter or update recipient delivery details</Link></p><label>Choose packaging <select value={packagingId} onChange={e=>setPackagingId(e.target.value)}><option value="">Choose an option</option>{packaging.map(p=><option key={p.id} value={p.id}>{p.name} — {money(Number(p.priceKobo))}</option>)}</select></label><p>Delivery uses the fixed price for your selected area.</p><button disabled={accepting||!packagingId||!summary.reservationActive} onClick={calculate}>{accepting?'Calculating…':'Calculate my total'}</button></section>}
      {!summary.quote ? <section className={styles.waiting}><span><Icon name="clock" size={30}/></span><div><h2>Complete your details to see your total</h2><p>Once stock is confirmed, save the recipient address, choose packaging and calculate your total.</p></div></section> : <div className={styles.grid}>
        <section className={styles.quote}><div className={styles.quoteTitle}><div><small>QUOTE REFERENCE</small><b>{summary.quote.id.slice(0, 8).toUpperCase()}</b></div><span>{summary.quote.details.currency}</span></div><dl><div><dt>Product subtotal</dt><dd>{money(summary.quote.details.productSubtotalKobo)}</dd></div><div><dt>Packaging</dt><dd>{money(summary.quote.details.packagingKobo)}</dd></div><div><dt>Delivery</dt><dd>{money(summary.quote.details.deliveryKobo)}</dd></div><div className={styles.total}><dt>Total</dt><dd>{money(summary.quote.details.totalKobo)}</dd></div></dl><div className={styles.plan}><small>YOUR PACKAGING & DELIVERY</small><p>{summary.quote.details.fulfilmentPlan}</p></div>{!accepted && !summary.orderConfirmed && <button disabled={accepting || !summary.reservationActive} onClick={accept}>{accepting ? 'Accepting…' : summary.reservationActive ? 'Accept this quote' : 'Availability needs reconfirmation'}</button>}<p className={styles.consent}>By accepting, you approve this exact quote and total. Acceptance does not mean payment has been received.</p></section>
        <aside className={styles.payment}><h2>{summary.reviewMode ? 'Private review checkout' : 'Secure online checkout'}</h2>{summary.reviewMode ? <div className={styles.review}><b>TEST MODE · No money will move</b><p>{summary.orderConfirmed ? 'A Fendora administrator simulated payment confirmation so the remaining fulfilment flow can be reviewed.' : accepted ? 'Your quote is accepted. A Fendora administrator can now simulate payment confirmation.' : 'Accept the quote to continue the review flow. Do not make a payment.'}</p></div> : summary.orderConfirmed ? <div className={styles.verified}><b>✓ Payment verified</b><p>Fendora verified the payment directly with the provider. The order can move into preparation.</p>{summary.receipt&&<dl><dt>Receipt</dt><dd>#{summary.receipt.id.slice(0,8).toUpperCase()}</dd><dt>Amount</dt><dd>{money(Number(summary.receipt.received_kobo))}</dd><dt>Method</dt><dd>{summary.receipt.provider??'Fendora review'}</dd></dl>}<button onClick={()=>window.print()}>Print or save receipt</button></div> : summary.fundsRecorded ? <div className={styles.review}><b>Payment under review</b><p>Fendora recorded a transaction, but the order remains unconfirmed until the provider verifies the exact total.</p></div> : accepted && summary.paymentProviders?.length ? <div className={styles.providers}><b>Choose how to pay</b><p>You will continue to the provider’s secure checkout. Fendora confirms the order only after server verification.</p>{summary.paymentProviders.map(provider=><button key={provider} disabled={!!paying} onClick={()=>pay(provider)}>{paying===provider?'Opening secure checkout…':`Pay with ${provider==='paypal'?'PayPal':provider[0].toUpperCase()+provider.slice(1)}`}</button>)}</div> : accepted ? <div className={styles.review}><b>Online payments are being connected</b><p>Checkout will open when Fendora adds verified provider credentials. Do not pay a vendor directly.</p></div> : <div className={styles.muted}><b>Payment is not open yet</b><p>Review and accept the current quote first.</p></div>}{!summary.reviewMode && <div className={styles.safety}><b>Payment protection rule</b><p>A redirect or screenshot is not confirmation. Only Fendora’s server verification confirms the order.</p></div>}</aside>
      </div>}
    </> : null}
  </main></div>;
}
