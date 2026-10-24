'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { createSupportCase, CustomerNotification, CustomerServiceError, getSupportCase, listNotifications, listSupportCases, markNotificationRead, replyToSupportCase, SupportCase, SupportCaseSummary } from '../../lib/client/customer-service';
import { listOrderRequests, OrderRequest } from '../../lib/client/marketplace';
import { CustomerHeader } from './customer-orders';
import home from './home-page.module.css';
import styles from './customer-care.module.css';

const caseStatus = { open: 'Fendor is reviewing', waiting_customer: 'Your reply is needed', resolved: 'Resolved' } as const;
const time = (value: string) => new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

function AccessError({ error, retry, next }: { error: Error; retry: () => void; next: string }) {
  const signedOut = error instanceof CustomerServiceError && error.status === 401;
  return <section className={styles.state} role="alert"><span>!</span><h1>{signedOut ? 'Sign in to contact Fendor' : 'We couldn’t load customer care'}</h1><p>{signedOut ? 'Support messages and notifications are private to your account.' : error.message}</p>{signedOut ? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link> : <button onClick={retry}>Try again</button>}</section>;
}

export function CustomerCarePage() {
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [cases, setCases] = useState<SupportCaseSummary[]>([]);
  const [orders, setOrders] = useState<OrderRequest[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    Promise.all([listNotifications(controller.signal), listSupportCases(controller.signal), listOrderRequests(controller.signal)])
      .then(([notificationResult, caseResult, orderResult]) => { setNotifications(notificationResult.notifications); setCases(caseResult.cases); setOrders(orderResult.orders); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error('Fendor could not load customer care.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  async function read(item: CustomerNotification) {
    if (item.read_at) return;
    try { await markNotificationRead(item.id); setNotifications((current) => current.map((note) => note.id === item.id ? { ...note, read_at: new Date().toISOString() } : note)); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Fendor could not mark this update as read.'); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSending(true); setNotice('');
    const keyName = 'fendor-support-request';
    const requestId = window.sessionStorage.getItem(keyName) ?? window.crypto.randomUUID();
    window.sessionStorage.setItem(keyName, requestId);
    try {
      const created = await createSupportCase({ requestId, subject, message, ...(orderId ? { orderId } : {}) });
      window.sessionStorage.removeItem(keyName); window.location.href = `/support/${created.id}`;
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Fendor could not open this support case.'); setSending(false); }
  }

  return <div className={home.page}><CustomerHeader />{notice && <button className={home.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}<main className={`${home.shell} ${styles.main}`}>
    <div className={styles.head}><div><p className={home.kicker}>CUSTOMER CARE</p><h1>Updates and support</h1><p>Keep every order update and conversation with Fendor in one protected place.</p></div><Link href="/orders">View order requests</Link></div>
    {loading ? <section className={styles.state}><i /><h1>Loading customer care</h1></section> : error ? <AccessError error={error} retry={() => setReload((value) => value + 1)} next="/support" /> : <div className={styles.layout}>
      <div className={styles.left}><section className={styles.panel}><div className={styles.panelHead}><div><h2>Notifications</h2><p>Availability, quote, payment and fulfilment updates from Fendor.</p></div><span>{notifications.filter((item) => !item.read_at).length} unread</span></div>{notifications.length ? <div className={styles.notifications}>{notifications.map((item) => <button className={item.read_at ? styles.read : ''} onClick={() => read(item)} key={item.id}><i /><div><b>{item.title}</b><p>{item.message}</p><time>{time(item.created_at)}</time></div></button>)}</div> : <div className={styles.empty}>You have no notifications yet.</div>}</section>
      <section className={styles.panel}><div className={styles.panelHead}><div><h2>Your support cases</h2><p>Continue previous conversations with the Fendor team.</p></div></div>{cases.length ? <div className={styles.cases}>{cases.map((item) => <Link href={`/support/${item.id}`} key={item.id}><div><small>CASE {item.id.slice(0, 8).toUpperCase()}</small><b>{item.subject}</b>{item.order_id && <span>Connected to an order request</span>}</div><em data-status={item.status}>{caseStatus[item.status]}</em></Link>)}</div> : <div className={styles.empty}>No support cases opened.</div>}</section></div>
      <form className={styles.newCase} onSubmit={submit}><p className={home.kicker}>CONTACT FENDOR</p><h2>How can we help?</h2><p>Fendor coordinates with the vendor for you. Do not share payment details or passwords in this message.</p><label>Related order <small>Optional</small><select value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">General support</option>{orders.map((order) => <option value={order.id} key={order.id}>{order.product.title} · {order.id.slice(0, 8)}</option>)}</select></label><label>Subject<input required minLength={5} maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What do you need help with?" /></label><label>Message<textarea required minLength={5} maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Explain the issue and what you need Fendor to do." /></label><button disabled={sending}>{sending ? 'Opening case…' : 'Open support case'}</button><small>Your message goes to Fendor, not directly to the vendor.</small></form>
    </div>}
  </main></div>;
}

export function SupportConversationPage({ id }: { id: string }) {
  const [supportCase, setSupportCase] = useState<SupportCase | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(null); getSupportCase(id, controller.signal).then(setSupportCase).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error('Fendor could not load this case.')); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [id, reload]);
  async function reply(event: FormEvent) { event.preventDefault(); if (!supportCase) return; setSending(true); setNotice(''); try { await replyToSupportCase(id, supportCase.version, message); setMessage(''); setReload((value) => value + 1); } catch (reason) { setNotice(reason instanceof CustomerServiceError && reason.code === 'STALE_VERSION' ? 'This conversation changed. Reload and send your reply again.' : reason instanceof Error ? reason.message : 'Fendor could not send this reply.'); } finally { setSending(false); } }
  return <div className={home.page}><CustomerHeader />{notice && <button className={home.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}<main className={`${home.shell} ${styles.main}`}><nav className={styles.back}><Link href="/support">← Customer care</Link></nav>{loading ? <section className={styles.state}><i /><h1>Loading conversation</h1></section> : error ? <AccessError error={error} retry={() => setReload((value) => value + 1)} next={`/support/${id}`} /> : supportCase ? <div className={styles.conversation}><header><div><p className={home.kicker}>CASE {supportCase.id.slice(0, 8).toUpperCase()}</p><h1>{supportCase.subject}</h1>{supportCase.order_id && <Link href={`/orders/${supportCase.order_id}`}>View related order</Link>}</div><span data-status={supportCase.status}>{caseStatus[supportCase.status]}</span></header><div className={styles.messages}>{supportCase.messages.map((item) => <article className={item.author === 'you' ? styles.mine : styles.fendor} key={item.id}><b>{item.author === 'you' ? 'You' : 'Fendor support'}</b><p>{item.body}</p><time>{time(item.created_at)}</time></article>)}</div>{supportCase.status === 'resolved' ? <div className={styles.resolved}>This case is resolved. Open a new case if you need further help.</div> : <form className={styles.reply} onSubmit={reply}><label>Reply to Fendor<textarea required minLength={1} maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your reply…" /></label><button disabled={sending}>{sending ? 'Sending…' : 'Send reply'}</button></form>}</div> : null}</main></div>;
}
