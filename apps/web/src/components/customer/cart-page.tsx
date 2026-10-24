'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { ProductArt, ProductCard, products } from './home-page';
import home from './home-page.module.css';
import styles from './cart-page.module.css';

type CartItem = {
  id: string;
  name: string;
  vendor: string;
  priceKobo: number;
  oldPriceKobo: number;
  quantity: number;
  art: string;
  tint: string;
  option: string;
  saved?: boolean;
};

const startingItems: CartItem[] = [
  {
    id: 'field-satchel',
    name: 'Vegetable-Tanned Field Satchel',
    vendor: 'Maro Leather Works',
    priceKobo: 4_850_000,
    oldPriceKobo: 5_500_000,
    quantity: 1,
    art: 'bag',
    tint: '#ead8c6',
    option: 'Natural chestnut · Standard finish',
  },
  {
    id: 'clay-tea-set',
    name: 'Ojai Matte Clay Tea Set',
    vendor: 'Earth & Ember',
    priceKobo: 3_600_000,
    oldPriceKobo: 4_200_000,
    quantity: 1,
    art: 'tea',
    tint: '#ead9cc',
    option: 'Six-piece set · Warm clay',
  },
];

function formatNaira(kobo: number) {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
}

export function CartPage() {
  const [items, setItems] = useState(startingItems);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.priceKobo * item.quantity, 0), [items]);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  function updateQuantity(id: string, change: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.min(10, Math.max(1, item.quantity + change)) } : item));
  }

  function removeItem(id: string) {
    const removed = items.find((item) => item.id === id);
    setItems((current) => current.filter((item) => item.id !== id));
    setNotice(removed ? `${removed.name} removed from your cart.` : 'Item removed.');
  }

  function toggleSaved(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, saved: !item.saved } : item));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.location.href = search.trim() ? `/shop?q=${encodeURIComponent(search.trim())}` : '/shop';
  }

  return <div className={home.page}>
    <header className={home.header}>
      <div className={home.utility}><div className={home.shell}><span>Help & Support</span><span>Sell on Fendor</span></div></div>
      <div className={`${home.shell} ${home.mainHeader}`}>
        <Link href="/" className={home.logo} aria-label="Fendor home"><Image src="/icons/home/logo.svg" width={40} height={40} alt="" priority /><span><b>Fendor</b><small>MARKETPLACE</small></span></Link>
        <form className={home.search} onSubmit={handleSearch} role="search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, brands or vendors" aria-label="Search products" /><button aria-label="Submit search"><Image src="/icons/home/search.svg" width={19} height={19} alt="" /></button></form>
        <nav className={home.actions} aria-label="Account actions"><Link href="/login"><Image src="/icons/home/account.svg" width={21} height={21} alt="" /><span>Account</span></Link><Link href="#support"><Image src="/icons/home/help.svg" width={21} height={21} alt="" /><span>Help</span></Link><Link href="/cart" className={home.cart}><Image src="/icons/home/cart.svg" width={23} height={23} alt="" /><span>Cart</span>{itemCount > 0 && <b>{itemCount}</b>}</Link></nav>
      </div>
      <nav className={`${home.shell} ${home.categoryNav}`} aria-label="Marketplace categories"><Link href="/shop" className={home.allCategories}>☰ &nbsp; All Categories</Link>{['Phones & Tablets', 'Electronics', 'Fashion', 'Home & Living', 'Gifts'].map((item) => <Link key={item} href="/shop">{item}</Link>)}</nav>
    </header>

    {notice && <button className={home.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}

    <main className={`${home.shell} ${styles.main}`}>
      {items.length === 0 ? <section className={styles.empty}>
        <span aria-hidden="true">⌑</span>
        <p className={home.kicker}>YOUR CART IS READY FOR A FRESH START</p>
        <h1>Your cart is empty</h1>
        <p>Explore products from verified vendors and save the ones you would like Fendor to confirm.</p>
        <Link href="/shop" className={styles.primary}>Browse the marketplace</Link>
      </section> : <>
        <div className={styles.pageHead}>
          <div><p className={home.kicker}>REVIEW BEFORE REQUESTING</p><div className={styles.titleLine}><h1>My Cart</h1><span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span></div><p>Check quantities and product choices before Fendor sends availability requests to the vendors.</p></div>
          <Link href="/shop">← Continue shopping</Link>
        </div>

        <div className={styles.layout}>
          <div className={styles.items}>
            {items.map((item) => <article className={styles.vendorGroup} key={item.id}>
              <header className={styles.vendorHead}><div className={styles.vendorIdentity}><span>{item.vendor.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><div><h2>{item.vendor} <b>✓</b></h2><small>Verified vendor · Availability confirmation required</small></div></div><Link href="/shop">Visit storefront →</Link></header>
              <div className={styles.itemRow}>
                <Link className={styles.visual} href={`/product/${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`}><ProductArt type={item.art} tint={item.tint} /></Link>
                <div className={styles.itemInfo}><div className={styles.itemTop}><div><h3>{item.name}</h3><p>{item.option}</p></div><div className={styles.itemPrice}><strong>{formatNaira(item.priceKobo * item.quantity)}</strong><del>{formatNaira(item.oldPriceKobo * item.quantity)}</del></div></div>
                  <span className={styles.status}><i /> Vendor will confirm this exact item and quantity</span>
                  <div className={styles.controls}><div className={styles.stepper}><button onClick={() => updateQuantity(item.id, -1)} aria-label={`Decrease ${item.name} quantity`}>−</button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, 1)} aria-label={`Increase ${item.name} quantity`}>+</button></div><div className={styles.itemActions}><button onClick={() => toggleSaved(item.id)}>{item.saved ? '♥ Saved' : '♡ Save for later'}</button><button onClick={() => removeItem(item.id)}>Remove</button></div></div>
                </div>
              </div>
            </article>)}

            <section className={styles.location}><span aria-hidden="true">⌖</span><div><small>DELIVERY DETAILS COME NEXT</small><h2>Where should Fendor deliver?</h2><p>The recipient’s location, preferred date, packaging and delivery instructions are collected after you sign in. Delivery fees are quoted before payment.</p></div><Link href="/login?next=/orders/new">Add after sign in</Link></section>
          </div>

          <aside className={styles.summary}>
            <h2>Order request summary</h2>
            <dl><div><dt>Products ({itemCount})</dt><dd>{formatNaira(subtotal)}</dd></div><div><dt>Packaging</dt><dd>Confirmed later</dd></div><div><dt>Delivery</dt><dd>Calculated later</dd></div></dl>
            <div className={styles.estimate}><span>Current product total</span><strong>{formatNaira(subtotal)}</strong><small>This is not the final payable amount.</small></div>
            <Link className={styles.primary} href="/login?next=/orders/new">Continue to order request</Link>
            <p className={styles.signIn}>Already have an account? <Link href="/login?next=/orders/new">Sign in</Link></p>
            <ol className={styles.nextSteps}><li><span>1</span><div><b>Tell us about the recipient</b><small>Add delivery and optional gift details.</small></div></li><li><span>2</span><div><b>Vendors confirm availability</b><small>Each vendor checks the exact product and quantity.</small></div></li><li><span>3</span><div><b>Fendor sends the final quote</b><small>Pay only after stock, packaging and delivery are confirmed.</small></div></li></ol>
          </aside>
        </div>

        <section className={styles.recommendations}><div><p className={home.kicker}>KEEP DISCOVERING</p><h2>You might also like</h2></div><div className={styles.recommendationGrid}>{products.filter((product) => !items.some((item) => item.name === product.name)).slice(0, 4).map((product) => <ProductCard key={product.name} product={product} compact />)}</div></section>
      </>}
    </main>

    <footer className={home.footer} id="support"><div className={`${home.shell} ${home.copyright}`}>© 2026 Fendor Marketplace. Stock and final costs are confirmed before payment.</div></footer>
  </div>;
}
