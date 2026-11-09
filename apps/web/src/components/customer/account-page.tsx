'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { accountDestination, AuthApiError, currentUser, CurrentUser, resendVerification, signOut } from '../../lib/client/auth';
import { listNotifications, listSupportCases } from '../../lib/client/customer-service';
import { listOrderRequests, OrderRequest } from '../../lib/client/marketplace';
import { CustomerHeader } from './customer-orders';
import { AccountOverview } from './account-overview';
import { Icon } from '../ui/icon';
import home from './home-page.module.css';
import styles from './account-page.module.css';

export function AccountPage() {
  const [user, setUser] = useState<CurrentUser | null>(null); const [orders, setOrders] = useState<OrderRequest[]>([]); const [unread, setUnread] = useState(0); const [cases, setCases] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState<Error | null>(null); const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const identity = await currentUser();
        if (controller.signal.aborted) return;
        const destination = accountDestination(identity.user);
        if (destination !== '/account') { window.location.replace(destination); return; }
        setUser(identity.user);
        const [orderResult, notificationResult, caseResult] = await Promise.all([
          listOrderRequests(controller.signal), listNotifications(controller.signal), listSupportCases(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setOrders(orderResult.orders);
        setUnread(notificationResult.notifications.filter((item) => !item.read_at).length);
        setCases(caseResult.cases.filter((item) => item.status !== 'resolved').length);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error('Fendora could not load your account.'));
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, []);
  async function logout() { await signOut(); window.location.href = '/'; }
  async function resend() { if (!user) return; try { const response = await resendVerification(user.email); setNotice(response.message); } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Fendora could not queue a verification email.'); } }
  const signedOut = error instanceof AuthApiError && error.status === 401;
  return <div className={home.page}>
    <CustomerHeader />
    {notice && <button className={home.toast} onClick={() => setNotice('')}>{notice}<span>×</span></button>}
    <main className={`${home.shell} ${styles.main}`}>
      {loading ? <section className={styles.state} role="status"><i /><h1>Opening your Fendora space…</h1></section>
        : error ? <section className={styles.state} role="alert"><span><Icon name={signedOut ? 'user' : 'alert-triangle'} size={28} /></span><h1>{signedOut ? 'Your thoughtful moments, in one place.' : 'We couldn’t load your account'}</h1><p>{signedOut ? 'Sign in to see your orders, follow deliveries and pick up where you left off.' : error.message}</p><Link href="/login?next=/account">Sign in <Icon name="arrow-right" size={17} /></Link></section>
        : user ? <>
          {!user.verified && <section className={styles.verify}><div><b>Verify your email to use protected order actions</b><p>Your account exists, but some marketplace actions remain unavailable.</p></div><button onClick={resend}>Resend verification email</button></section>}
          <AccountOverview user={user} orders={orders} unread={unread} cases={cases} logout={logout} />
        </> : null}
    </main>
  </div>;
}
