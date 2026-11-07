'use client';

import Image from 'next/image';
import Link from 'next/link';
import {getCheckoutSummary} from '../../lib/client/marketplace';
import { FormEvent, useEffect, useState } from 'react';
import { cancelOrderRequest, getOrderRequest, listOrderRequests, MarketplaceApiError, OrderRequest } from '../../lib/client/marketplace';
import { cartItemCount } from '../../lib/client/cart';
import { useCart } from '../../lib/client/use-cart';
import { Icon } from '../ui/icon';
import home from './home-page.module.css';
import styles from './customer-orders.module.css';

const statusCopy: Record<OrderRequest['state'], { label: string; detail: string }> = {
  draft: { label: 'Draft', detail: 'Finish this request when you are ready.' },
  checking_availability: { label: 'Checking availability', detail: 'The vendor is checking the exact product and quantity.' },
  reserved: { label: 'Available and reserved', detail: 'Continue to checkout to choose packaging and calculate your total.' },
  awaiting_payment: { label: 'Ready for payment', detail: 'Review your total and pay securely at checkout.' },
  confirmed: { label: 'Order confirmed', detail: 'Payment has been verified and preparation can begin.' },
  preparing: { label: 'Being prepared', detail: 'The vendor is preparing the confirmed order.' },
  ready_for_dispatch: { label: 'Ready for dispatch', detail: 'Fendora is coordinating collection and delivery.' },
  out_for_delivery: { label: 'Out for delivery', detail: 'The order is on its way to the recipient.' },
  delivered: { label: 'Delivered', detail: 'The delivery was completed.' },
  unavailable: { label: 'Unavailable', detail: 'The vendor could not confirm this exact item.' },
  cancelled: { label: 'Cancelled', detail: 'This request has been cancelled.' },
  delivery_failed: { label: 'Delivery needs attention', detail: 'Fendora is reviewing the failed delivery attempt.' },
  returned: { label: 'Returned', detail: 'The returned item is being reviewed.' },
  refunded: { label: 'Refunded', detail: 'The recorded refund process has been completed.' },
};

function money(kobo: number) { return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`; }

export function CustomerHeader() {
  const { items } = useCart();
  const count = cartItemCount(items);
  return <header className={home.header}>
    <div className={home.utility}><div className={home.shell}><span className={home.betaBadge}>PUBLIC BETA</span><span>Help & Support</span><span>Sell on Fendora</span></div></div>
    <div className={`${home.shell} ${home.mainHeader}`}>
      <Link href="/" className={home.logo} aria-label="Fendora home"><Image src="/icons/home/logo.svg" width={40} height={40} alt="" priority /><span><b>Fendora</b><small>MARKETPLACE</small></span></Link>
      <form className={home.search} action="/shop"><input name="q" placeholder="Search products, brands or vendors" aria-label="Search products" /><button aria-label="Submit search"><Icon name="search" size={19}/></button></form>
      <nav className={home.actions} aria-label="Account actions"><Link href="/account" aria-label="My Account"><Icon name="user" size={21}/><span>My Account</span></Link><Link href="/support"><Icon name="circle-help" size={21}/><span>Help</span></Link><Link href="/cart" className={home.cart}><Icon name="shopping-cart" size={23}/><span>Cart</span>{count > 0 && <b>{count}</b>}</Link></nav>
    </div>
  </header>;
}

function AccessState({ error, retry }: { error: MarketplaceApiError | Error; retry: () => void }) {
  const signedOut = error instanceof MarketplaceApiError && error.status === 401;
  return <section className={styles.state} role="alert"><span><Icon name={signedOut?'user':'alert-triangle'} size={30}/></span><h1>{signedOut ? 'Sign in to view your requests' : 'We couldn’t load your requests'}</h1><p>{signedOut ? 'Your order requests and gift details are private to your Fendora account.' : error.message}</p>{signedOut ? <Link href="/login?next=/orders">Sign in</Link> : <button onClick={retry}>Try again</button>}</section>;
}

export function CustomerOrdersPage() {
  const [orders, setOrders] = useState<OrderRequest[]>([]);
  const [error, setError] = useState<MarketplaceApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    listOrderRequests(controller.signal).then(({ orders: result }) => setOrders(result)).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error('Fendora could not load your requests.'));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  return <div className={home.page}><CustomerHeader /><main className={`${home.shell} ${styles.main}`}>
    <div className={styles.heading}><div><p className={home.kicker}>YOUR FENDORA ACTIVITY</p><h1>Order requests</h1><p>Follow availability, quotes, preparation and delivery without contacting vendors directly.</p></div><Link href="/shop">Browse marketplace</Link></div>
    {loading ? <section className={styles.state} aria-live="polite"><i /><h1>Loading your requests</h1></section> : error ? <AccessState error={error} retry={() => setReload((value) => value + 1)} /> : orders.length === 0 ? <section className={styles.state}><span><Icon name="receipt" size={32}/></span><h1>No order requests yet</h1><p>When you request an item, its availability and fulfilment progress will appear here.</p><Link href="/shop">Find a product</Link></section> : <div className={styles.orderList}>{orders.map((order) => {
      const status = order.reservationExpired ? { label: 'Availability needs reconfirmation', detail: 'The previous stock hold expired. Fendora has asked the vendor to check again.' } : statusCopy[order.state];
      return <article className={styles.order} key={order.id}>
        <div className={styles.productVisual}>{order.product.imagePath ? <Image src={order.product.imagePath} fill sizes="120px" alt={order.product.title} /> : <span>F</span>}</div>
        <div className={styles.orderBody}><div className={styles.orderTop}><small>REQUEST {order.id.slice(0, 8).toUpperCase()}</small><span data-state={order.state}>{status.label}</span></div><h2>{order.product.title}</h2><p>{status.detail}</p><div className={styles.facts}><span>Quantity <b>{order.quantity}</b></span><span>Product total <b>{money(order.product.unitPriceKobo * order.quantity)}</b></span>{order.giftDetails.recipientName && <span>Recipient <b>{order.giftDetails.recipientName}</b></span>}</div></div>
        <Link className={styles.view} href={`/orders/${order.id}`}>View request <span>→</span></Link>
      </article>;
    })}</div>}
  </main><footer className={home.footer} id="support"><div className={`${home.shell} ${home.copyright}`}>© 2026 Fendora Marketplace. Fendora coordinates every customer and vendor update.</div></footer></div>;
}

export function CustomerOrderDetailPage({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderRequest | null>(null);
  const [error, setError] = useState<MarketplaceApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [checkoutTotal,setCheckoutTotal]=useState<{packagingKobo:number;deliveryKobo:number}|null>(null);
  useEffect(()=>{const controller=new AbortController();const refresh=()=>{if(document.visibilityState!=='visible')return;getOrderRequest(id,controller.signal).then(({order})=>setOrder(order)).catch(()=>{});getCheckoutSummary(id,controller.signal).then(s=>setCheckoutTotal(s.quote?.details??null)).catch(()=>{});};refresh();const timer=setInterval(refresh,10000);window.addEventListener('focus',refresh);return()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);};},[id]);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    getOrderRequest(id, controller.signal).then(({ order: result }) => { setOrder(result); }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error('Fendora could not load this request.'));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, reload]);

  async function cancel() {
    if (!order) return; setSaving(true); setNotice('');
    try { const result = await cancelOrderRequest(order.id, order.version); setOrder(result.order); setNotice('This request has been cancelled.'); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Fendora could not cancel this request.'); }
    finally { setSaving(false); }
  }

  const cancellable = order && ['draft', 'checking_availability', 'reserved', 'awaiting_payment', 'unavailable'].includes(order.state) && !order.orderConfirmed;
  const status = order ? (order.reservationExpired ? { label: 'Availability needs reconfirmation', detail: 'The stock hold expired, so Fendora is asking the vendor to check again.' } : statusCopy[order.state]) : null;
  const base=`/orders/${id}`;
  const next=order?.financialHold||(order?.fundsRecorded&&!order.orderConfirmed)?{title:'Fendora is reviewing your payment',detail:'We will update you after the review.',href:'/support',action:'Contact support'}:order?.reservationExpired?{title:'Checking availability again',detail:'The stock hold expired and the vendor needs to confirm again.',href:'/support',action:'Get help'}:order?.orderConfirmed?{title:'Your order is confirmed',detail:'Follow your order as it is prepared and delivered.',href:`${base}/delivery`,action:'Track your order'}:order?.state==='reserved'||order?.state==='awaiting_payment'?{title:order.state==='reserved'?'Your product is available':'Ready for payment',detail:'Save your gift and recipient details, then review your total.',href:`${base}/checkout`,action:'Continue to checkout'}:order?.state==='checking_availability'?{title:'Tell us about your gift',detail:'Save gift and recipient details while the vendor checks availability.',href:`${base}/delivery`,action:'Add gift and recipient details'}:{title:'Need help with this request?',detail:'Fendora can help with your next step.',href:'/support',action:'Contact support'};

  return <div className={home.page}><CustomerHeader /><main className={`${home.shell} ${styles.main}`}>
    <nav className={styles.breadcrumb}><Link href="/orders">← All requests</Link></nav>
    {loading ? <section className={styles.state} aria-live="polite"><i /><h1>Loading this request</h1></section> : error ? <AccessState error={error} retry={() => setReload((value) => value + 1)} /> : order && status ? <>
      {notice && <button className={home.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}
      <section className={styles.detailHead}><div><p className={home.kicker}>REQUEST {order.id.slice(0, 8).toUpperCase()}</p><h1>{order.product.title}</h1><p>{status.detail}</p></div><div className={styles.statusLarge} data-state={order.state}><small>CURRENT STATUS</small><b>{status.label}</b></div></section>
      <section className={styles.panel} aria-label="Your next step"><h2>{next.title}</h2><p>{next.detail}</p><Link href={next.href}>{next.action} →</Link></section>
      <div className={styles.detailGrid}><div className={styles.detailMain}>
        <section className={styles.panel}><h2>Request progress</h2><ol className={styles.timeline}><li className={styles.done}><b>Request received</b><span>Fendora recorded your chosen product and quantity.</span></li><li className={order.state === 'checking_availability' ? styles.current : styles.done}><b>Vendor availability</b><span>The vendor checks the exact item without receiving your private details.</span></li><li className={order.orderConfirmed ? styles.done : order.state==='reserved'||order.state==='awaiting_payment' ? styles.current : ''}><b>Checkout and payment</b><span>Choose packaging, save delivery details and approve the total.</span></li><li className={order.state==='delivered' ? styles.done : order.orderConfirmed ? styles.current : ''}><b>Preparation and delivery</b><span>Preparation starts only after Fendora verifies payment.</span></li></ol></section>
      </div><aside className={styles.summary}><div className={styles.summaryVisual}>{order.product.imagePath ? <Image src={order.product.imagePath} fill sizes="320px" alt={order.product.title} /> : <span>Fendora verified product</span>}</div><h2>Request summary</h2><dl><div><dt>Quantity</dt><dd>{order.quantity}</dd></div><div><dt>Product subtotal</dt><dd>{money(order.product.unitPriceKobo * order.quantity)}</dd></div><div><dt>Packaging</dt><dd>{checkoutTotal?money(checkoutTotal.packagingKobo):'Choose at checkout'}</dd></div><div><dt>Delivery</dt><dd>{checkoutTotal?money(checkoutTotal.deliveryKobo):'Select delivery area'}</dd></div></dl><p>No payment is requested until availability and the complete quote are confirmed.</p><Link className={styles.deliveryLink} href={`/orders/${order.id}/delivery`}>{order.orderConfirmed ? 'Track delivery' : 'Add gift and recipient details'}</Link>{(order.quoteId || order.state==='reserved') && <Link className={styles.checkout} href={`/orders/${order.id}/checkout`}>{order.orderConfirmed ? 'View payment status' : order.acceptedQuoteId ? 'Continue to payment' : 'Continue to checkout'}</Link>}{order.orderConfirmed && <Link className={styles.remedyLink} href={`/orders/${order.id}/remedy`}>Request cancellation or return</Link>}{cancellable && <button disabled={saving} className={styles.cancel} onClick={cancel}>Cancel request</button>}</aside></div>
    </> : null}
  </main></div>;
}
