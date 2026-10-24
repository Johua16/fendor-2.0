'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DeliveryDetails, DeliveryZone, getDeliveryDetails, getOrderHistory, getOrderRequest, listDeliveryZones, MarketplaceApiError, OrderHistoryEvent, OrderRequest, saveDeliveryDetails } from '../../lib/client/marketplace';
import { CustomerHeader } from './customer-orders';
import home from './home-page.module.css';
import styles from './customer-delivery.module.css';

type Form = { zoneId: string; recipientName: string; phone: string; address: string; instructions: string; deliveryDate: string };
const blank: Form = { zoneId: '', recipientName: '', phone: '', address: '', instructions: '', deliveryDate: '' };
const labels: Record<string, string> = { request_created: 'Request received', personalisation_saved: 'Gift details saved', delivery_saved: 'Delivery details saved', reserve: 'Availability confirmed', reservation_expired: 'Availability needs reconfirmation', quote_created: 'Fendor quote prepared', quote_accepted: 'Quote accepted', funds_recorded: 'Funds recorded for review', payment_verified: 'Payment verified', prepare: 'Preparation started', ready: 'Ready for dispatch', dispatch: 'Out for delivery', 'delivery-failed': 'Delivery attempt needs attention', delivered: 'Delivered', returned: 'Returned', cancel: 'Request cancelled', decline: 'Product unavailable' };
const dateOnly = (value: string) => value ? new Date(value).toISOString().slice(0, 10) : '';

export function CustomerDeliveryPage({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderRequest | null>(null);
  const [details, setDetails] = useState<DeliveryDetails | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [events, setEvents] = useState<OrderHistoryEvent[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MarketplaceApiError | Error | null>(null);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    Promise.all([getOrderRequest(id, controller.signal), getDeliveryDetails(id, controller.signal), listDeliveryZones(controller.signal), getOrderHistory(id, controller.signal)])
      .then(([orderResult, delivery, zoneResult, history]) => {
        setOrder(orderResult.order); setDetails(delivery); setZones(zoneResult.zones); setEvents(history.events);
        if (delivery) {
          const zone = zoneResult.zones.find((item) => item.city === delivery.city && item.state === delivery.state);
          setForm({ zoneId: zone?.id ?? '', recipientName: delivery.recipientName, phone: delivery.phone, address: delivery.address, instructions: delivery.instructions ?? '', deliveryDate: dateOnly(delivery.deliveryDate) });
        }
      }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error('Fendor could not load delivery information.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, reload]);

  const editable = !!order && ['checking_availability', 'reserved'].includes(order.state) && !order.orderConfirmed;
  const grouped = useMemo(() => zones.reduce<Record<string, DeliveryZone[]>>((all, zone) => { (all[zone.state] ??= []).push(zone); return all; }, {}), [zones]);

  async function save(event: FormEvent) {
    event.preventDefault(); if (!order) return; setSaving(true); setNotice('');
    try {
      await saveDeliveryDetails(order.id, { version: order.version, ...form });
      setNotice('Delivery details saved securely. Fendor will use them to prepare the complete quote.');
      setReload((value) => value + 1);
    } catch (reason) {
      setNotice(reason instanceof MarketplaceApiError && reason.code === 'STALE_VERSION' ? 'This request changed. Reload before saving delivery details.' : reason instanceof Error ? reason.message : 'Fendor could not save these details.');
    } finally { setSaving(false); }
  }

  const signedOut = error instanceof MarketplaceApiError && error.status === 401;
  return <div className={home.page}><CustomerHeader />{notice && <button className={home.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}<main className={`${home.shell} ${styles.main}`}>
    <nav className={styles.back}><Link href={`/orders/${id}`}>← Back to request</Link></nav>
    {loading ? <section className={styles.state}><i /><h1>Loading delivery information</h1></section> : error ? <section className={styles.state} role="alert"><span>!</span><h1>{signedOut ? 'Sign in to manage delivery' : 'We couldn’t load delivery information'}</h1><p>{signedOut ? 'Recipient and tracking details are private to your Fendor account.' : error.message}</p>{signedOut ? <Link href={`/login?next=${encodeURIComponent(`/orders/${id}/delivery`)}`}>Sign in</Link> : <button onClick={() => setReload((value) => value + 1)}>Try again</button>}</section> : order ? <>
      <div className={styles.head}><div><p className={home.kicker}>DELIVERY & FULFILMENT</p><h1>{order.product.title}</h1><p>Add recipient information securely and follow each verified fulfilment update from Fendor.</p></div><span>{details?.trackingReference ? `Tracking: ${details.trackingReference}` : order.orderConfirmed ? 'Fulfilment in progress' : 'Planning delivery'}</span></div>
      <div className={styles.grid}><DeliveryForm order={order} details={details} grouped={grouped} form={form} setForm={setForm} editable={editable} saving={saving} save={save} /><Tracking order={order} details={details} events={events} /></div>
    </> : null}
  </main></div>;
}

type DeliveryFormProps = { order: OrderRequest; details: DeliveryDetails | null; grouped: Record<string, DeliveryZone[]>; form: Form; setForm: (form: Form) => void; editable: boolean; saving: boolean; save: (event: FormEvent) => void };
function DeliveryForm({ order, grouped, form, setForm, editable, saving, save }: DeliveryFormProps) {
  return <form className={styles.form} onSubmit={save}><div className={styles.formHead}><div><h2>Recipient delivery details</h2><p>Only authorised Fendor staff can see the contact and address. Vendors receive the delivery state and date only.</p></div>{editable && <button disabled={saving}>{saving ? 'Saving…' : 'Save details'}</button>}</div>{order.quoteId && editable && <div className={styles.quoteWarning}><b>Changing delivery details removes the current quote.</b><span>Fendor must recheck delivery cost and feasibility before you accept a new total.</span></div>}<div className={styles.fields}>
    <label>Delivery area<select required disabled={!editable} value={form.zoneId} onChange={(event) => setForm({ ...form, zoneId: event.target.value })}><option value="">Choose a supported area</option>{Object.entries(grouped).map(([state, zones]) => <optgroup key={state} label={state}>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.city} — {zone.name}</option>)}</optgroup>)}</select></label>
    <label>Preferred delivery date<input required disabled={!editable} type="date" min={new Date().toISOString().slice(0, 10)} value={form.deliveryDate} onChange={(event) => setForm({ ...form, deliveryDate: event.target.value })} /></label>
    <label>Recipient name<input required disabled={!editable} minLength={2} maxLength={100} value={form.recipientName} onChange={(event) => setForm({ ...form, recipientName: event.target.value })} /></label>
    <label>Recipient phone<input required disabled={!editable} minLength={7} maxLength={25} inputMode="tel" placeholder="+234…" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
    <label className={styles.full}>Delivery address<textarea required disabled={!editable} minLength={10} maxLength={1000} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
    <label className={styles.full}>Delivery instructions <small>Optional</small><textarea disabled={!editable} maxLength={1000} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label>
  </div>{!editable && <p className={styles.locked}>Contact Fendor support if these protected delivery details must change at the current order stage.</p>}</form>;
}

function Tracking({ order, details, events }: { order: OrderRequest; details: DeliveryDetails | null; events: OrderHistoryEvent[] }) {
  const completed = ['delivered', 'returned', 'refunded'].includes(order.state);
  return <aside className={styles.tracking}><h2>Order tracking</h2>{completed && <div className={styles.completed}><b>{order.state === 'delivered' ? '✓ Delivery completed' : order.state === 'refunded' ? 'Financial remedy completed' : 'Product returned'}</b><p>The protected order history below is the record of this fulfilment.</p>{details?.proofId && <a href={`/api/media/${details.proofId}`} target="_blank" rel="noreferrer"><img src={`/api/media/${details.proofId}`} alt="Delivery proof recorded for this order" /><span>Open delivery proof</span></a>}</div>}{details && <div className={styles.deliveryCard}><small>DELIVERY PLAN</small><b>{details.city}, {details.state}</b><span>{new Date(details.deliveryDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>{details.attempts > 0 && <span>{details.attempts} dispatch {details.attempts === 1 ? 'attempt' : 'attempts'}</span>}</div>}<ol>{events.length ? events.map((item, index) => <li className={index === events.length - 1 ? styles.current : ''} key={item.id}><i /><div><b>{labels[item.event_type] ?? item.event_type.replaceAll('_', ' ')}</b><time>{new Date(item.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</time></div></li>) : <li className={styles.current}><i /><div><b>Request created</b><time>Waiting for the first fulfilment update</time></div></li>}</ol><div className={styles.privacy}><b>Private by design</b><p>The vendor never receives the recipient’s phone number or street address through this workflow.</p></div></aside>;
}
