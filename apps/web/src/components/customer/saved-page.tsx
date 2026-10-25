'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { addCartItem } from '../../lib/client/cart';
import { useSaved } from '../../lib/client/use-saved';
import { CustomerHeader } from './customer-orders';
import { ProductArt } from './home-page';
import { Icon } from '../ui/icon';
import home from './home-page.module.css';
import styles from './saved-page.module.css';

const money = (value: number) => `₦${Math.round(value / 100).toLocaleString('en-NG')}`;

export function SavedPage() {
  const { items, setItems, ready } = useSaved();
  const [notice, setNotice] = useState('');
  return <div className={home.page}><CustomerHeader />{notice && <button className={home.toast} onClick={() => setNotice('')}>{notice}<span>×</span></button>}<main className={`${home.shell} ${styles.main}`}>
    <div className={styles.head}><div><p className={home.kicker}>SAVED PRODUCTS</p><h1>Products you want to revisit</h1><p>Keep a shortlist on this device, then add a product to your cart when you are ready to request availability.</p></div><Link href="/shop">Browse marketplace</Link></div>
    {!ready ? <section className={styles.empty}>Loading saved products…</section> : items.length === 0 ? <section className={styles.empty}><span><Icon name="heart" size={32}/></span><h2>No saved products yet</h2><p>Use the heart on a product page to keep it here.</p><Link href="/shop">Find products</Link></section> : <div className={styles.grid}>{items.map((item) => <article key={item.id}><Link className={styles.visual} href={`/product/${item.productId ?? item.id}`}>{item.imagePath ? <Image src={item.imagePath} fill sizes="280px" alt={item.name} /> : <ProductArt type={item.art} tint={item.tint} />}</Link><small>VERIFIED VENDOR</small><h2>{item.name}</h2><p>{item.vendor}</p><strong>{money(item.priceKobo)}</strong><div><button onClick={() => { addCartItem(item); setNotice(`${item.name} added to your cart.`); }}>Add to cart</button><button onClick={() => setItems((current) => current.filter((saved) => saved.id !== item.id))}>Remove</button></div></article>)}</div>}
    <p className={styles.deviceNote}>Saved products are stored in this browser for this MVP. Your orders and support history remain secured in your account.</p>
  </main></div>;
}
