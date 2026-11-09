'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DeliveryDetails, DeliveryZone, getDeliveryDetails, getOrderHistory, getOrderRequest, listDeliveryZones, listPackagingOptions, PackagingOption, MarketplaceApiError, OrderHistoryEvent, OrderRequest, saveDeliveryDetails, saveOrderPersonalisation } from '../../lib/client/marketplace';
import { CustomerHeader } from './customer-orders';
import home from './home-page.module.css';
import styles from './customer-delivery.module.css';

type Form = { zoneId: string; recipientName: string; phone: string; address: string; instructions: string; deliveryDate: string };
const blank: Form = { zoneId: '', recipientName: '', phone: '', address: '', instructions: '', deliveryDate: '' };
const labels: Record<string, string> = { request_created: 'Request received', personalisation_saved: 'Gift details saved', delivery_saved: 'Delivery details saved', reserve: 'Availability confirmed', reservation_expired: 'Availability needs reconfirmation', quote_created: 'Fendora quote prepared', quote_accepted: 'Quote accepted', funds_recorded: 'Funds recorded for review', online_payment_verified: 'Payment verified — order confirmed', online_payment_review_required: 'Payment under review', payment_verified: 'Payment verified', prepare: 'Preparation started', ready: 'Ready for dispatch', dispatch: 'Out for delivery', 'delivery-failed': 'Delivery attempt needs attention', delivered: 'Delivered', returned: 'Returned', cancel: 'Request cancelled', decline: 'Product unavailable' };
const dateOnly = (value: string | null) => value ? new Date(value).toISOString().slice(0, 10) : '';

export function CustomerDeliveryPage({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderRequest | null>(null);
  const [details, setDetails] = useState<DeliveryDetails | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [events, setEvents] = useState<OrderHistoryEvent[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [gift,setGift]=useState<OrderRequest['giftDetails']>({});
  const [packaging,setPackaging]=useState<PackagingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MarketplaceApiError | Error | null>(null);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    Promise.all([getOrderRequest(id, controller.signal), getDeliveryDetails(id, controller.signal), listDeliveryZones(controller.signal), getOrderHistory(id, controller.signal),listPackagingOptions()])
      .then(([orderResult, delivery, zoneResult, history, packs]) => {
        setOrder(orderResult.order); setDetails(delivery); setZones(zoneResult.zones); setEvents(history.events);
        setGift(orderResult.order.giftDetails??{});setPackaging(packs.options);
        if(!delivery)setForm({...blank,recipientName:orderResult.order.giftDetails?.recipientName??''});
        if (delivery) {
          const zone = zoneResult.zones.find((item) => item.id === delivery.zoneId);
          setForm({ zoneId: zone?.id ?? '', recipientName: delivery.recipientName, phone: delivery.phone, address: delivery.address, instructions: delivery.instructions ?? '', deliveryDate: dateOnly(delivery.deliveryDate) });
        }
      }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error('Fendora could not load delivery information.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, reload]);

  const editable = !!order && ['checking_availability', 'reserved'].includes(order.state) && !order.orderConfirmed;
  useEffect(() => {
    if (!order || !order.orderConfirmed) return;
    const controller = new AbortController();
    let refreshing = false;
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || refreshing) return;
      refreshing = true;
      try {
        const [latest, delivery, history] = await Promise.all([getOrderRequest(id, controller.signal), getDeliveryDetails(id, controller.signal), getOrderHistory(id, controller.signal)]);
        if (!controller.signal.aborted) { setOrder(latest.order); setDetails(delivery); setEvents(history.events); }
      } catch { /* Keep the last confirmed view; the refresh button allows an explicit retry. */ }
      finally { refreshing = false; }
    };
    const timer = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [id, order?.orderConfirmed]);

  const grouped = useMemo(() => zones.reduce<Record<string, DeliveryZone[]>>((all, zone) => { (all[zone.state] ??= []).push(zone); return all; }, {}), [zones]);

  async function saveGiftForLater() {
    if(!order)return;setSaving(true);setNotice('');
    try {const result=await saveOrderPersonalisation(order.id,order.version,{...gift,...(form.recipientName.trim()?{recipientName:form.recipientName}:{})});setOrder(result.order);setNotice('Gift details saved. You can return later to add the delivery address.');}
    catch(reason){setNotice(reason instanceof MarketplaceApiError && reason.code==='STALE_VERSION'?'The order changed while you were editing. Please copy your entries, then reload before saving.':reason instanceof Error?reason.message:'Could not save gift details.');}
    finally{setSaving(false);}
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!order) return; setSaving(true); setNotice('');
    let giftSaved=false;
    try {
      const updated=await saveOrderPersonalisation(order.id,order.version,{...gift,recipientName:form.recipientName});
      giftSaved=true;setOrder(updated.order);
      await saveDeliveryDetails(order.id, { version: updated.order.version, ...form });
      setNotice('Gift and delivery details saved. Once stock is confirmed, continue to checkout.');
      setReload((value) => value + 1);
    } catch (reason) {
      setNotice(giftSaved ? 'Gift details were saved, but delivery details were not. Your entries are still here; try saving again.' : reason instanceof MarketplaceApiError && reason.code === 'STALE_VERSION' ? 'This request changed. Reload before saving; your unsaved entries may be lost.' : reason instanceof Error ? reason.message : 'Fendora could not save these details.');
    } finally { setSaving(false); }
  }

  const signedOut = error instanceof MarketplaceApiError && error.status === 401;
  return <div className={home.page}><CustomerHeader />{notice && <button className={home.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}<main className={`${home.shell} ${styles.main}`}>
    <nav className={styles.back}><Link href={`/orders/${id}`}>← Back to request</Link>{details && order?.state==='reserved' && <Link href={`/orders/${id}/checkout`} style={{marginLeft:20}}>Continue to checkout →</Link>}</nav>
    {loading ? <section className={styles.state}><i /><h1>Loading delivery information</h1></section> : error ? <section className={styles.state} role="alert"><span>!</span><h1>{signedOut ? 'Sign in to manage delivery' : 'We couldn’t load delivery information'}</h1><p>{signedOut ? 'Recipient and tracking details are private to your Fendora account.' : error.message}</p>{signedOut ? <Link href={`/login?next=${encodeURIComponent(`/orders/${id}/delivery`)}`}>Sign in</Link> : <button onClick={() => setReload((value) => value + 1)}>Try again</button>}</section> : order ? <>
      <div className={styles.head}><div><p className={home.kicker}>YOUR GIFT & DELIVERY</p><h1>{order.product.title}</h1><p>{order.orderConfirmed ? 'Payment is verified. Follow preparation, dispatch and delivery here.' : 'Tell us about your gift and recipient while the vendor checks availability.'}</p></div><span>{details?.trackingReference ? `Tracking: ${details.trackingReference}` : order.orderConfirmed ? order.state==='delivered'?'Delivered':order.state==='delivery_failed'?'Delivery needs attention':'Fulfilment in progress' : 'Planning delivery'}</span></div>
      <button type="button" onClick={()=>setReload(value=>value+1)}>Refresh order status</button><div className={styles.grid}><DeliveryForm order={order} details={details} grouped={grouped} form={form} setForm={setForm} gift={gift} setGift={setGift} packaging={packaging} editable={editable} saving={saving} save={save} saveGiftForLater={saveGiftForLater} /><Tracking order={order} details={details} events={events} /></div>
    </> : null}
  </main></div>;
}

type DeliveryFormProps = { order: OrderRequest; details: DeliveryDetails | null; grouped: Record<string, DeliveryZone[]>; form: Form; setForm: (form: Form) => void; gift:OrderRequest['giftDetails'];setGift:(gift:OrderRequest['giftDetails'])=>void;packaging:PackagingOption[];editable: boolean; saving: boolean; save: (event: FormEvent) => void;saveGiftForLater:()=>void };
function DeliveryForm({ order, grouped, form, setForm, gift,setGift,packaging,editable, saving, save,saveGiftForLater }: DeliveryFormProps) {
  const zones = Object.values(grouped).flat();
  const selected = zones.find(zone => zone.id === form.zoneId);
  const areaLabel = (zone: DeliveryZone) => `${zone.city}, ${zone.state} — ${zone.name}`;
  const [area, setArea] = useState('');
  useEffect(() => { setArea(selected ? areaLabel(selected) : ''); }, [form.zoneId]);
  function chooseArea(value: string) {
    setArea(value);
    const matches = zones.filter(zone => areaLabel(zone).toLowerCase() === value.trim().toLowerCase() || zone.city.toLowerCase() === value.trim().toLowerCase());
    setForm({...form, zoneId: matches.length === 1 ? matches[0].id : ''});
  }
  return <form className={styles.form} onSubmit={save}><div className={styles.formHead}><div><h2>Gift and recipient details</h2><p>Save your gift and delivery details together. Your recipient’s phone and street address stay private from the vendor.</p></div>{editable && <button disabled={saving}>{saving ? 'Saving…' : 'Save details'}</button>}</div>{order.quoteId && editable && <div className={styles.quoteWarning}><b>Changing details removes the current total.</b><span>Calculate and review the updated total before paying.</span></div>}<div className={styles.fields}>
    <label>Occasion<input disabled={!editable} maxLength={100} value={gift.occasion??''} onChange={e=>setGift({...gift,occasion:e.target.value})}/></label>
    <label>Relationship<input disabled={!editable} maxLength={100} value={gift.relationship??''} onChange={e=>setGift({...gift,relationship:e.target.value})}/></label>
    <label className={styles.full}>Packaging<select disabled={!editable} value={gift.packagingId??''} onChange={e=>{const option=packaging.find(p=>p.id===e.target.value);setGift({...gift,packagingId:e.target.value,packagingPreference:option?.name??''});}}><option value="">Choose packaging</option>{packaging.map(p=><option key={p.id} value={p.id}>{p.name} — ₦{(Number(p.priceKobo)/100).toLocaleString('en-NG')}</option>)}</select></label>
    <label className={styles.full}>Gift message <small>Optional</small><textarea disabled={!editable} maxLength={1000} value={gift.giftMessage??''} onChange={e=>setGift({...gift,giftMessage:e.target.value})}/></label>
    {editable && <div className={styles.full}><button type="button" disabled={saving} onClick={saveGiftForLater}>Save gift details for later</button><small>You can add the recipient’s address later.</small></div>}
    <label className={styles.full}>Full delivery address<textarea required disabled={!editable} autoComplete="street-address" placeholder="House number, street, neighbourhood, city and state" minLength={10} maxLength={1000} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /><small>Include the house or building number and a nearby landmark.</small></label>
    <label className={styles.full}>Delivery city / area<input required disabled={!editable || !zones.length} list="delivery-area-options" value={area} placeholder={zones.length ? 'Type your city, e.g. Abuja' : 'Delivery coverage is awaiting setup'} onChange={event => chooseArea(event.target.value)} onBlur={event => event.currentTarget.setCustomValidity(form.zoneId ? '' : 'Choose a matching supported delivery area.')} onInput={event => event.currentTarget.setCustomValidity('')} /><datalist id="delivery-area-options">{zones.map(zone => <option key={zone.id} value={areaLabel(zone)}/>)}</datalist><small>{!zones.length ? 'Fendora has not configured delivery coverage yet. Contact support before proceeding.' : selected ? 'Area matched. Fendora will confirm the exact address, delivery fee and feasibility before payment.' : 'Choose a suggested area after typing. An address alone does not confirm delivery coverage.'}</small></label>
    <p className={styles.full}>Fendora will confirm delivery timing after the order is placed.</p>
    <label>Recipient name<input required disabled={!editable} minLength={2} maxLength={100} value={form.recipientName} onChange={(event) => setForm({ ...form, recipientName: event.target.value })} /></label>
    <label>Recipient phone<input required disabled={!editable} minLength={7} maxLength={25} inputMode="tel" placeholder="+234…" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
    <label className={styles.full}>Delivery instructions <small>Optional</small><textarea disabled={!editable} maxLength={1000} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label>
  </div>{!editable && <p className={styles.locked}>Contact Fendora support if these protected delivery details must change at the current order stage.</p>}</form>;
}

function Tracking({ order, details, events }: { order: OrderRequest; details: DeliveryDetails | null; events: OrderHistoryEvent[] }) {
  const completed = ['delivered', 'returned', 'refunded'].includes(order.state);
  return <aside className={styles.tracking}><h2>Order tracking</h2>{completed && <div className={styles.completed}><b>{order.state === 'delivered' ? '✓ Delivery completed' : order.state === 'refunded' ? 'Financial remedy completed' : 'Product returned'}</b><p>The protected order history below is the record of this fulfilment.</p>{details?.proofId && <a href={`/api/media/${details.proofId}`} target="_blank" rel="noreferrer"><img src={`/api/media/${details.proofId}`} alt="Delivery proof recorded for this order" /><span>Open delivery proof</span></a>}</div>}{details && <div className={styles.deliveryCard}><small>DELIVERY PLAN</small><b>{details.city}, {details.state}</b><span>{details.deliveryDate ? new Date(details.deliveryDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Delivery timing to be confirmed'}</span>{details.attempts > 0 && <span>{details.attempts} dispatch {details.attempts === 1 ? 'attempt' : 'attempts'}</span>}</div>}<ol>{events.length ? events.map((item, index) => <li className={index === events.length - 1 ? styles.current : ''} key={item.id}><i /><div><b>{labels[item.event_type] ?? item.event_type.replaceAll('_', ' ')}</b><time>{new Date(item.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</time></div></li>) : <li className={styles.current}><i /><div><b>Request created</b><time>Waiting for the first fulfilment update</time></div></li>}</ol><div className={styles.privacy}><b>Private by design</b><p>The vendor never receives the recipient’s phone number or street address through this workflow.</p></div></aside>;
}
