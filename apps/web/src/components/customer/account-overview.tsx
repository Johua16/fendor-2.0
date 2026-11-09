'use client';

import Link from 'next/link';
import type { CurrentUser } from '../../lib/client/auth';
import type { OrderRequest } from '../../lib/client/marketplace';
import { useCart } from '../../lib/client/use-cart';
import { useSaved } from '../../lib/client/use-saved';
import { cartItemCount } from '../../lib/client/cart';
import { Icon, type IconName } from '../ui/icon';
import styles from './account-page.module.css';

const shortcuts: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: '/orders', icon: 'truck', title: 'Track a request', text: 'Follow availability, preparation and delivery.' },
  { href: '/saved', icon: 'heart', title: 'Saved favourites', text: 'Return to the things that caught your eye.' },
  { href: '/cart', icon: 'shopping-basket', title: 'Your cart', text: 'Pick up where you left off.' },
  { href: '/support', icon: 'headphones', title: 'Talk to Fendora', text: 'Get help with your gifting journey.' },
];
const navigation: { href: string; icon: IconName; label: string }[] = [
  { href: '/account', icon: 'home', label: 'Overview' },
  { href: '/orders', icon: 'package', label: 'My orders & tracking' },
  { href: '/saved', icon: 'heart', label: 'Saved favourites' },
  { href: '/cart', icon: 'shopping-basket', label: 'My cart' },
  { href: '/notifications', icon: 'bell', label: 'Updates' },
  { href: '/support', icon: 'headphones', label: 'Help & support' },
];

export function AccountOverview({ user, orders, unread, cases, logout }: {
  user: CurrentUser; orders: OrderRequest[]; unread: number; cases: number; logout: () => Promise<void>;
}) {
  const { items: cart, ready: cartReady } = useCart();
  const { items: saved, ready: savedReady } = useSaved();
  const firstName = user.fullName.trim().split(/\s+/)[0];
  const initials = user.fullName.trim().split(/\s+/).slice(0, 2).map((name) => name[0]).join('');
  return <>
    <div className={styles.breadcrumb}><Link href="/">Home</Link><Icon name="chevron-right" size={14} /><span>My Account</span></div>
    <div className={styles.accountLayout}>
      <aside className={styles.sidebar} aria-label="My account">
        <div className={styles.profile}><span className={styles.avatar} aria-hidden="true">{initials}</span><div><b>{user.fullName}</b><small>Your Fendora space</small></div></div>
        <nav aria-label="Account navigation">{navigation.map((item) => <Link key={item.href} href={item.href} aria-current={item.href === '/account' ? 'page' : undefined}><Icon name={item.icon} size={19} /><span>{item.label}</span></Link>)}</nav>
        <button onClick={logout}><Icon name="log-out" size={18} />Sign out</button>
      </aside>
      <div className={styles.content}>
        <section className={styles.welcome}>
          <div><p className={styles.eyebrow}>MY ACCOUNT</p><h1>A little thought.<br />A lot of meaning.</h1><p>Welcome back, {firstName}. Your gifts, requests and updates, all in one place.</p><Link href="/shop">Find your next gift <Icon name="arrow-right" size={17} /></Link></div>
          <div className={styles.heroArt} aria-hidden="true"><span><Icon name="gift" size={76} /></span><i><Icon name="sparkles" size={28} /></i></div>
        </section>
        <section className={styles.stats} aria-label="Your activity">
          <Link href="/orders"><span className={styles.statIcon}><Icon name="package" /></span><div><b>{orders.length}</b><span>Order requests</span></div><Icon name="chevron-right" size={17} /></Link>
          <Link href="/notifications"><span className={styles.statIcon}><Icon name="bell" /></span><div><b>{unread}</b><span>Unread updates</span></div><Icon name="chevron-right" size={17} /></Link>
          <Link href="/support"><span className={styles.statIcon}><Icon name="message-circle" /></span><div><b>{cases}</b><span>Open support cases</span></div><Icon name="chevron-right" size={17} /></Link>
        </section>
        <section className={styles.shortcuts} aria-labelledby="shortcuts-heading"><div className={styles.sectionHeading}><h2 id="shortcuts-heading">What would you like to do?</h2><span>Make yourself at home.</span></div><div className={styles.shortcutGrid}>{shortcuts.map((item) => <Link key={item.href} href={item.href}><span className={styles.shortcutIcon}><Icon name={item.icon} size={23} /></span><div><h3>{item.title}{item.href === '/cart' && cartReady && cart.length > 0 ? ` (${cartItemCount(cart)})` : item.href === '/saved' && savedReady && saved.length > 0 ? ` (${saved.length})` : ''}</h3><p>{item.text}</p></div><Icon name="arrow-right" size={17} /></Link>)}</div></section>
        <section className={styles.recent} aria-labelledby="recent-heading"><div className={styles.sectionHeading}><div><h2 id="recent-heading">Your latest requests</h2><p>From the first thought to the final delivery.</p></div><Link href="/orders">View all <Icon name="arrow-right" size={15} /></Link></div>
          {orders.length ? <div className={styles.orderList}>{orders.slice(0, 4).map((order) => <Link key={order.id} href={`/orders/${order.id}`}><span className={styles.orderIcon}><Icon name="gift" size={23} /></span><div><b>{order.product.title}</b><small>Request #{order.id.slice(0, 8).toUpperCase()} · {order.quantity} {order.quantity === 1 ? 'item' : 'items'}</small></div><span className={styles.status} data-state={order.state}>{order.state.replaceAll('_', ' ')}</span><Icon name="chevron-right" size={17} /></Link>)}</div> : <div className={styles.empty}><span><Icon name="gift" size={32} /></span><h3>Your next thoughtful moment starts here.</h3><p>Once you send a request, you can follow every update here.</p><Link href="/shop">Explore the marketplace <Icon name="arrow-right" size={16} /></Link></div>}
        </section>
        <footer className={styles.accountFooter}><span><Icon name="user" size={15} />{user.email}</span><Link href="/help">Need a hand?</Link></footer>
      </div>
    </div>
  </>;
}
