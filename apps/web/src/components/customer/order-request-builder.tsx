'use client';

import Link from 'next/link';
import { useState } from 'react';
import { currentUser } from '../../lib/client/auth';
import { createOrderRequest, MarketplaceApiError } from '../../lib/client/marketplace';
import { cartItemCount } from '../../lib/client/cart';
import { useCart } from '../../lib/client/use-cart';
import { CustomerHeader } from './customer-orders';
import home from './home-page.module.css';
import styles from './order-request-builder.module.css';

type Result = { id: string; name: string; ok: boolean; message: string };
const money = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
export function OrderRequestBuilder() {
  const { items, setItems, ready } = useCart(); const [sending, setSending] = useState(false); const [results, setResults] = useState<Result[]>([]);
  const live = items.filter((item) => item.variantId); const preview = items.filter((item) => !item.variantId);
  async function submit() {
    setSending(true); setResults([]);
    try { await currentUser(); } catch { window.location.href = '/login?next=/orders/new'; return; }
    const completed: string[] = []; const nextResults: Result[] = [];
    for (const item of live) {
      const keyName = `fendor-cart-request:${item.id}`; const requestId = window.localStorage.getItem(keyName) ?? window.crypto.randomUUID(); window.localStorage.setItem(keyName, requestId);
      try { const response = await createOrderRequest(item.variantId!, item.quantity, requestId); completed.push(item.id); window.localStorage.removeItem(keyName); nextResults.push({ id: response.order.id, name: item.name, ok: true, message: 'Availability request sent' }); }
      catch (error) { nextResults.push({ id: item.id, name: item.name, ok: false, message: error instanceof MarketplaceApiError ? error.message : 'Request could not be sent' }); }
    }
    setResults(nextResults); if (completed.length) setItems((current) => current.filter((item) => !completed.includes(item.id))); setSending(false);
  }
  const total = live.reduce((sum, item) => sum + item.priceKobo * item.quantity, 0);
  return <div className={home.page}><CustomerHeader /><main className={`${home.shell} ${styles.main}`}><nav className={styles.back}><Link href="/cart">← Back to cart</Link></nav><div className={styles.head}><p className={home.kicker}>AVAILABILITY REQUEST</p><h1>Send your products for confirmation</h1><p>Each vendor receives only the product and quantity. Fendor keeps your recipient, payment and delivery information private.</p></div>{!ready ? <div className={styles.empty}>Loading your cart…</div> : items.length === 0 && !results.length ? <div className={styles.empty}><h2>Your cart has no products to request</h2><Link href="/shop">Browse marketplace</Link></div> : <div className={styles.layout}><section className={styles.items}>{live.map((item) => <article key={item.id}><div><small>VERIFIED LISTING</small><h2>{item.name}</h2><p>{item.vendor}</p></div><span>{item.quantity} × {money(item.priceKobo)}</span></article>)}{preview.length > 0 && <div className={styles.preview}><b>{preview.length} preview {preview.length === 1 ? 'product cannot' : 'products cannot'} be requested yet</b><p>Remove preview products or replace them with live approved catalogue listings.</p></div>}{results.length > 0 && <div className={styles.results}><h2>Submission result</h2>{results.map((result) => <div className={result.ok ? styles.ok : styles.failed} key={`${result.id}-${result.name}`}><b>{result.name}</b><span>{result.message}</span>{result.ok && <Link href={`/orders/${result.id}`}>View request</Link>}</div>)}</div>}</section><aside className={styles.summary}><h2>Request summary</h2><dl><div><dt>Products</dt><dd>{cartItemCount(live)}</dd></div><div><dt>Current product total</dt><dd>{money(total)}</dd></div><div><dt>Packaging</dt><dd>Quoted later</dd></div><div><dt>Delivery</dt><dd>Quoted later</dd></div></dl><div className={styles.note}><b>No payment now</b><p>Vendors confirm exact stock first. Fendor then checks packaging, delivery and sends the complete quote.</p></div><button disabled={sending || live.length === 0} onClick={submit}>{sending ? 'Sending requests…' : `Send ${live.length} availability ${live.length === 1 ? 'request' : 'requests'}`}</button><small>Products are sent separately so one unavailable vendor does not block the others.</small></aside></div>}</main></div>;
}
