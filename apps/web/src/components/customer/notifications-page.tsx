'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CustomerNotification, CustomerServiceError, listNotifications, markNotificationRead } from '../../lib/client/customer-service';
import { CustomerHeader } from './customer-orders';
import home from './home-page.module.css';
import styles from './notifications-page.module.css';

export function NotificationsPage() {
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const load = () => { setLoading(true); setError(null); return listNotifications().then(({notifications}) => setItems(notifications)).catch((reason:unknown) => setError(reason instanceof Error ? reason : new Error('Could not load updates.'))).finally(() => setLoading(false)); };
  useEffect(() => { void load(); }, []);
  async function read(item:CustomerNotification) { if(item.read_at) return; try { await markNotificationRead(item.id); setItems(current => current.map(value => value.id === item.id ? {...value,read_at:new Date().toISOString()} : value)); } catch(reason) { setError(reason instanceof Error ? reason : new Error('Could not mark this update as read.')); } }
  const signedOut = error instanceof CustomerServiceError && error.status === 401;
  return <div className={home.page}><CustomerHeader/><main className={`${home.shell} ${styles.main}`}><header><div><p className={home.kicker}>FENDOR UPDATES</p><h1>Notifications</h1><p>Availability, payment, preparation, delivery and support updates appear here.</p></div><Link href="/account">Back to account</Link></header>{loading?<section className={styles.state}><i/><h2>Loading updates</h2></section>:error?<section className={styles.state}><b>!</b><h2>{signedOut?'Sign in to see your updates':'We could not load notifications'}</h2><p>{error.message}</p><Link href="/login?next=/notifications">Sign in</Link></section>:items.length?<section className={styles.list}>{items.map(item=><button key={item.id} className={item.read_at?styles.read:styles.unread} onClick={()=>read(item)}><span>{item.read_at?'✓':'●'}</span><div><b>{item.title}</b><p>{item.message}</p><time>{new Date(item.created_at).toLocaleString()}</time></div></button>)}</section>:<section className={styles.state}><b>○</b><h2>No updates yet</h2><p>Fendor will notify you as your requests move forward.</p><Link href="/shop">Browse products</Link></section>}</main></div>;
}
