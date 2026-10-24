'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { cancelOrderRequest, getOrderRequest, listOrderRequests, MarketplaceApiError, OrderRequest, saveOrderPersonalisation } from '../../lib/client/marketplace';
import { cartItemCount } from '../../lib/client/cart';
import { useCart } from '../../lib/client/use-cart';
import home from './home-page.module.css';
import styles from './customer-orders.module.css';

const statusCopy: Record<OrderRequest['state'], { label: string; detail: string }> = {
  draft: { label: 'Draft', detail: 'Finish this request when you are ready.' },
  checking_availability: { label: 'Checking availability', detail: 'The vendor is checking the exact product and quantity.' },
  reserved: { label: 'Available and reserved', detail: 'Fendor is preparing the complete quote.' },
  awaiting_payment: { label: 'Awaiting offline payment', detail: 'Follow the payment instructions supplied by Fendor.' },
  confirmed: { label: 'Order confirmed', detail: 'Payment has been verified and preparation can begin.' },
  preparing: { label: 'Being prepared', detail: 'The vendor is preparing the confirmed order.' },
  ready_for_dispatch: { label: 'Ready for dispatch', detail: 'Fendor is coordinating collection and delivery.' },
  out_for_delivery: { label: 'Out for delivery', detail: 'The order is on its way to the recipient.' },
  delivered: { label: 'Delivered', detail: 'The delivery was completed.' },
  unavailable: { label: 'Unavailable', detail: 'The vendor could not confirm this exact item.' },
  cancelled: { label: 'Cancelled', detail: 'This request has been cancelled.' },
  delivery_failed: { label: 'Delivery needs attention', detail: 'Fendor is reviewing the failed delivery attempt.' },
  returned: { label: 'Returned', detail: 'The returned item is being reviewed.' },
  refunded: { label: 'Refunded', detail: 'The recorded refund process has been completed.' },
};

function money(kobo: number) { return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`; }

function CustomerHeader() {
  const { items } = useCart();
  const count = cartItemCount(items);
  return <header className={home.header}>
    <div className={home.utility}><div className={home.shell}><span>Help & Support</span><span>Sell on Fendor</span></div></div>
    <div className={`${home.shell} ${home.mainHeader}`}>
      <Link href="/" className={home.logo} aria-label="Fendor home"><Image src="/icons/home/logo.svg" width={40} height={40} alt="" priority /><span><b>Fendor</b><small>MARKETPLACE</small></span></Link>
      <form className={home.search} action="/shop"><input name="q" placeholder="Search products, brands or vendors" aria-label="Search products" /><button aria-label="Submit search"><Image src="/icons/home/search.svg" width={19} height={19} alt="" /></button></form>
      <nav className={home.actions} aria-label="Account actions"><Link href="/orders"><Image src="/icons/home/account.svg" width={21} height={21} alt="" /><span>Orders</span></Link><Link href="#support"><Image src="/icons/home/help.svg" width={21} height={21} alt="" /><span>Help</span></Link><Link href="/cart" className={home.cart}><Image src="/icons/home/cart.svg" width={23} height={23} alt="" /><span>Cart</span>{count > 0 && <b>{count}</b>}</Link></nav>
    </div>
  </header>;
}

function AccessState({ error, retry }: { error: MarketplaceApiError | Error; retry: () => void }) {
  const signedOut = error instanceof MarketplaceApiError && error.status === 401;
  return <section className={styles.state} role="alert"><span>{signedOut ? '○' : '!'}</span><h1>{signedOut ? 'Sign in to view your requests' : 'We couldn’t load your requests'}</h1><p>{signedOut ? 'Your order requests and gift details are private to your Fendor account.' : error.message}</p>{signedOut ? <Link href="/login?next=/orders">Sign in</Link> : <button onClick={retry}>Try again</button>}</section>;
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
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error('Fendor could not load your requests.'));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  return <div className={home.page}><CustomerHeader /><main className={`${home.shell} ${styles.main}`}>
    <div className={styles.heading}><div><p className={home.kicker}>YOUR FENDOR ACTIVITY</p><h1>Order requests</h1><p>Follow availability, quotes, preparation and delivery without contacting vendors directly.</p></div><Link href="/shop">Browse marketplace</Link></div>
    {loading ? <section className={styles.state} aria-live="polite"><i /><h1>Loading your requests</h1></section> : error ? <AccessState error={error} retry={() => setReload((value) => value + 1)} /> : orders.length === 0 ? <section className={styles.state}><span>⌑</span><h1>No order requests yet</h1><p>When you request an item, its availability and fulfilment progress will appear here.</p><Link href="/shop">Find a product</Link></section> : <div className={styles.orderList}>{orders.map((order) => {
      const status = order.reservationExpired ? { label: 'Availability needs reconfirmation', detail: 'The previous stock hold expired. Fendor has asked the vendor to check again.' } : statusCopy[order.state];
      return <article className={styles.order} key={order.id}>
        <div className={styles.productVisual}>{order.product.imagePath ? <Image src={order.product.imagePath} fill sizes="120px" alt={order.product.title} /> : <span>F</span>}</div>
        <div className={styles.orderBody}><div className={styles.orderTop}><small>REQUEST {order.id.slice(0, 8).toUpperCase()}</small><span data-state={order.state}>{status.label}</span></div><h2>{order.product.title}</h2><p>{status.detail}</p><div className={styles.facts}><span>Quantity <b>{order.quantity}</b></span><span>Product total <b>{money(order.product.unitPriceKobo * order.quantity)}</b></span>{order.giftDetails.recipientName && <span>Recipient <b>{order.giftDetails.recipientName}</b></span>}</div></div>
        <Link className={styles.view} href={`/orders/${order.id}`}>View request <span>→</span></Link>
      </article>;
    })}</div>}
  </main><footer className={home.footer} id="support"><div className={`${home.shell} ${home.copyright}`}>© 2026 Fendor Marketplace. Fendor coordinates every customer and vendor update.</div></footer></div>;
}

export function CustomerOrderDetailPage({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderRequest | null>(null);
  const [error, setError] = useState<MarketplaceApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [gift, setGift] = useState<OrderRequest['giftDetails']>({});

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    getOrderRequest(id, controller.signal).then(({ order: result }) => { setOrder(result); setGift(result.giftDetails ?? {}); }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error('Fendor could not load this request.'));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, reload]);

  async function save(event: FormEvent) {
    event.preventDefault(); if (!order) return; setSaving(true); setNotice('');
    try { const result = await saveOrderPersonalisation(order.id, order.version, gift); setOrder(result.order); setGift(result.order.giftDetails); setNotice('Gift details saved.'); }
    catch (reason) { setNotice(reason instanceof MarketplaceApiError && reason.code === 'STALE_VERSION' ? 'This request changed. Reload it before saving again.' : reason instanceof Error ? reason.message : 'Fendor could not save these details.'); }
    finally { setSaving(false); }
  }

  async function cancel() {
    if (!order) return; setSaving(true); setNotice('');
    try { const result = await cancelOrderRequest(order.id, order.version); setOrder(result.order); setNotice('This request has been cancelled.'); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Fendor could not cancel this request.'); }
    finally { setSaving(false); }
  }

  const editable = order && ['checking_availability', 'reserved'].includes(order.state);
  const cancellable = order && ['draft', 'checking_availability', 'reserved', 'awaiting_payment', 'unavailable'].includes(order.state) && !order.orderConfirmed;
  const status = order ? (order.reservationExpired ? { label: 'Availability needs reconfirmation', detail: 'The stock hold expired, so Fendor is asking the vendor to check again.' } : statusCopy[order.state]) : null;

  return <div className={home.page}><CustomerHeader /><main className={`${home.shell} ${styles.main}`}>
    <nav className={styles.breadcrumb}><Link href="/orders">← All requests</Link></nav>
    {loading ? <section className={styles.state} aria-live="polite"><i /><h1>Loading this request</h1></section> : error ? <AccessState error={error} retry={() => setReload((value) => value + 1)} /> : order && status ? <>
      {notice && <button className={home.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}
      <section className={styles.detailHead}><div><p className={home.kicker}>REQUEST {order.id.slice(0, 8).toUpperCase()}</p><h1>{order.product.title}</h1><p>{status.detail}</p></div><div className={styles.statusLarge} data-state={order.state}><small>CURRENT STATUS</small><b>{status.label}</b></div></section>
      <div className={styles.detailGrid}><div className={styles.detailMain}>
        <section className={styles.panel}><h2>Request progress</h2><ol className={styles.timeline}><li className={styles.done}><b>Request received</b><span>Fendor recorded your chosen product and quantity.</span></li><li className={order.state === 'checking_availability' ? styles.current : styles.done}><b>Vendor availability</b><span>The vendor checks the exact item without receiving your private details.</span></li><li className={['reserved','awaiting_payment','confirmed','preparing','ready_for_dispatch','out_for_delivery','delivered'].includes(order.state) ? styles.done : ''}><b>Fendor quote and confirmation</b><span>Packaging and delivery are added before you approve the full amount.</span></li><li className={order.orderConfirmed ? styles.done : ''}><b>Preparation and delivery</b><span>Preparation starts only after Fendor verifies payment.</span></li></ol></section>
        <form className={styles.panel} onSubmit={save}><div className={styles.panelHead}><div><h2>Gift details</h2><p>You can prepare these details while availability is pending.</p></div>{editable && <button disabled={saving}>{saving ? 'Saving…' : 'Save details'}</button>}</div><div className={styles.formGrid}><label>Recipient name<input disabled={!editable} maxLength={100} value={gift.recipientName ?? ''} onChange={(event) => setGift({ ...gift, recipientName: event.target.value })} /></label><label>Occasion<input disabled={!editable} maxLength={100} value={gift.occasion ?? ''} onChange={(event) => setGift({ ...gift, occasion: event.target.value })} /></label><label>Relationship<input disabled={!editable} maxLength={100} value={gift.relationship ?? ''} onChange={(event) => setGift({ ...gift, relationship: event.target.value })} /></label><label>Packaging preference<input disabled={!editable} maxLength={200} value={gift.packagingPreference ?? ''} onChange={(event) => setGift({ ...gift, packagingPreference: event.target.value })} /></label><label className={styles.full}>Gift message<textarea disabled={!editable} maxLength={1000} value={gift.giftMessage ?? ''} onChange={(event) => setGift({ ...gift, giftMessage: event.target.value })} /></label></div>{!editable && <p className={styles.locked}>Gift details can no longer be changed at this stage.</p>}</form>
      </div><aside className={styles.summary}><div className={styles.summaryVisual}>{order.product.imagePath ? <Image src={order.product.imagePath} fill sizes="320px" alt={order.product.title} /> : <span>Fendor verified product</span>}</div><h2>Request summary</h2><dl><div><dt>Quantity</dt><dd>{order.quantity}</dd></div><div><dt>Product subtotal</dt><dd>{money(order.product.unitPriceKobo * order.quantity)}</dd></div><div><dt>Packaging</dt><dd>Quoted later</dd></div><div><dt>Delivery</dt><dd>Quoted later</dd></div></dl><p>No payment is requested until availability and the complete quote are confirmed.</p>{cancellable && <button disabled={saving} className={styles.cancel} onClick={cancel}>Cancel request</button>}</aside></div>
    </> : null}
  </main></div>;
}
