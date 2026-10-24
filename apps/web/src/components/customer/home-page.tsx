'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import styles from './home-page.module.css';

const categories = [
  ['Phones & Tablets', '▣'], ['Electronics', '⌁'], ['Fashion', '◇'], ['Home Living', '⌂'],
  ['Health & Beauty', '✦'], ['Groceries', '◉'], ['Footwear', '◒'], ['Accessories', '◈'],
  ['Computing', '⌘'], ['Kitchenware', '◫'],
];

export type DisplayProduct = {
  id?: string;
  variantId?: string;
  name: string;
  vendor: string;
  price: string;
  old?: string;
  tint: string;
  art: string;
  imagePath?: string | null;
  description?: string;
  category?: string;
};

export const products: DisplayProduct[] = [
  { name: 'Samsung Galaxy A55 5G', vendor: 'AfriTech Direct', price: '₦385,000', old: '₦440,000', tint: '#dce3df', art: 'phone' },
  { name: 'Vegetable-Tanned Field Satchel', vendor: 'Maro Leather Works', price: '₦48,500', old: '₦55,000', tint: '#ead8c6', art: 'bag' },
  { name: 'Soundcore Space One ANC', vendor: 'Sound District', price: '₦124,900', old: '₦139,000', tint: '#dddde5', art: 'headphones' },
  { name: 'Ojai Matte Clay Tea Set', vendor: 'Earth & Ember', price: '₦36,000', old: '₦42,000', tint: '#ead9cc', art: 'tea' },
  { name: 'Men’s Slim-Fit Chinos', vendor: 'Defacto Abuja', price: '₦29,900', old: '₦34,000', tint: '#d8ded8', art: 'fashion' },
  { name: 'Precision Espresso Tamper', vendor: 'Brew Culture', price: '₦18,500', old: '₦22,000', tint: '#ddd1c4', art: 'tamper' },
];

const heroSlides = [
  { eyebrow: 'Curated for meaningful moments', title: 'Find Your Next Favourite Thing', copy: 'Discover thoughtful products from verified Nigerian vendors, brought together in one dependable marketplace.', position: '50% 48%' },
  { eyebrow: 'Gifts with more meaning', title: 'Make Every Gift Feel Personal', copy: 'Choose a product, add the recipient details, and let Fendor guide the order from confirmation to fulfilment.', position: '28% 50%' },
  { eyebrow: 'Local makers, closer to you', title: 'Discover Trusted Nigerian Vendors', copy: 'Explore independent stores and distinctive products, with Fendor coordinating every confirmed order.', position: '73% 50%' },
];

const collections = [
  { title: 'Phones, Tablets & Audio', subtitle: 'Everyday technology from verified sellers', items: products.slice(0, 3) },
  { title: 'Fashion, Bags & Apparel', subtitle: 'Pieces selected for style and quality', items: [products[1], products[4], products[5]] },
  { title: 'Home, Living & Gifting', subtitle: 'Beautiful finds for people and spaces', items: [products[3], products[5], products[1]] },
];

const vendors = [
  { initials: 'AT', name: 'AfriTech Direct', specialty: 'Phones & electronics', items: ['phone', 'headphones', 'tamper'] },
  { initials: 'ML', name: 'Maro Leather Works', specialty: 'Hand-finished leather goods', items: ['bag', 'fashion', 'bag'] },
  { initials: 'EE', name: 'Earth & Ember', specialty: 'Homeware & ceramics', items: ['tea', 'tamper', 'tea'] },
  { initials: 'SD', name: 'Sound District', specialty: 'Audio & accessories', items: ['headphones', 'phone', 'headphones'] },
];

export function ProductArt({ type, tint }: { type: string; tint: string }) {
  return <div className={`${styles.productArt} ${styles[type]}`} style={{ backgroundColor: tint }} aria-hidden="true"><span /></div>;
}

export function productHref(product: DisplayProduct) {
  return `/product/${product.id ?? product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
}

export function ProductCard({ product, compact = false, onAdd }: { product: DisplayProduct; compact?: boolean; onAdd?: () => void }) {
  return <article className={`${styles.productCard} ${compact ? styles.compactCard : ''}`}>
    {product.imagePath ? <div className={styles.productImage}><Image src={product.imagePath} fill sizes="(max-width: 720px) 55vw, 25vw" alt={product.name} /></div> : <ProductArt type={product.art} tint={product.tint} />}
    <div className={styles.vendorLine}><span className={styles.verifiedDot}>✓</span>{product.vendor}</div>
    <h3><Link className={styles.productLink} href={productHref(product)}>{product.name}</Link></h3>
    <div className={styles.rating}>★ <b>4.8</b> <span>(120+)</span></div>
    <div className={styles.priceRow}><strong>{product.price}</strong>{product.old && <del>{product.old}</del>}</div>
    {!compact && <><div className={styles.stock}><span style={{ width: '72%' }} /></div><small>Available after vendor confirmation</small></>}
    {onAdd && <button className={styles.addButton} onClick={onAdd}>Add to cart</button>}
  </article>;
}

export function HomePage() {
  const [slide, setSlide] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % heroSlides.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const query = search.trim();
    setNotice(query ? `Showing ideas for “${query}”` : 'Type what you are looking for first.');
    document.getElementById('popular')?.scrollIntoView({ behavior: 'smooth' });
  }

  function addToCart(name: string) {
    setCartCount((count) => count + 1);
    setNotice(`${name} has been added to your cart.`);
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <div className={styles.utility}><div className={styles.shell}><span>Help & Support</span><span>Sell on Fendor</span></div></div>
      <div className={`${styles.shell} ${styles.mainHeader}`}>
        <Link href="/" className={styles.logo} aria-label="Fendor home"><Image src="/icons/home/logo.svg" width={40} height={40} alt="" priority /><span><b>Fendor</b><small>MARKETPLACE</small></span></Link>
        <form className={styles.search} onSubmit={handleSearch} role="search">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products, brands and categories" aria-label="Search Fendor" />
          <button aria-label="Submit search"><Image src="/icons/home/search.svg" width={19} height={19} alt="" /></button>
        </form>
        <nav className={styles.actions} aria-label="Account actions">
          <Link href="/login"><Image src="/icons/home/account.svg" width={21} height={21} alt="" /><span>Account</span></Link>
          <Link href="#support"><Image src="/icons/home/help.svg" width={21} height={21} alt="" /><span>Help</span></Link>
          <Link href="/cart" className={styles.cart}><Image src="/icons/home/cart.svg" width={23} height={23} alt="" /><span>Cart</span>{cartCount > 0 && <b>{cartCount}</b>}</Link>
        </nav>
      </div>
      <nav className={`${styles.shell} ${styles.categoryNav}`} aria-label="Main categories">
        <a href="#categories" className={styles.allCategories}>☰ &nbsp; All Categories</a>
        {['New Arrivals', 'Phones & Tablets', 'Fashion', 'Home & Living', 'Gifts', 'Deals'].map((item) => <Link key={item} href="/shop">{item}</Link>)}
      </nav>
    </header>

    {notice && <button className={styles.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}

    <main>
      <section className={`${styles.shell} ${styles.hero}`} aria-roledescription="carousel" aria-label="Fendor highlights">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{heroSlides[slide].eyebrow}</p>
          <h1>{heroSlides[slide].title}</h1>
          <p>{heroSlides[slide].copy}</p>
          <div className={styles.heroButtons}><Link href="/shop" className={styles.primaryButton}>Start shopping</Link><a href="#vendors" className={styles.textButton}>Explore vendors <span>→</span></a></div>
        </div>
        <div className={styles.heroImage}>
          <Image src="/images/home/hero-pottery.png" fill sizes="(max-width: 720px) 100vw, 50vw" alt="A curated handmade pottery collection" priority style={{ objectPosition: heroSlides[slide].position }} />
          <div className={styles.heroBadge}><small>THIS WEEK’S EDIT</small><strong>{slide === 0 ? 'Made with care' : slide === 1 ? 'Gift beautifully' : 'Shop local'}</strong></div>
          <button className={`${styles.arrow} ${styles.previous}`} aria-label="Previous slide" onClick={() => setSlide((slide + 2) % 3)}>‹</button>
          <button className={`${styles.arrow} ${styles.next}`} aria-label="Next slide" onClick={() => setSlide((slide + 1) % 3)}>›</button>
        </div>
        <div className={styles.dots}>{heroSlides.map((_, index) => <button key={index} className={index === slide ? styles.activeDot : ''} aria-label={`Go to slide ${index + 1}`} onClick={() => setSlide(index)} />)}</div>
      </section>

      <section className={`${styles.shell} ${styles.section}`} id="categories">
        <div className={styles.sectionHead}><div><p className={styles.kicker}>SHOP YOUR WAY</p><h2>Browse popular categories</h2></div><a href="#collections">View all <span>→</span></a></div>
        <div className={styles.categoryGrid}>{categories.map(([name, icon]) => <a href="#collections" className={styles.category} key={name}><span>{icon}</span><b>{name}</b></a>)}</div>
      </section>

      <section className={`${styles.shell} ${styles.section} ${styles.panel}`}>
        <div className={styles.sectionHead}><div className={styles.titleWithBadge}><span className={styles.pill}>FLASH WINDOW</span><div><h2>Deals worth discovering</h2><p>Limited offers from verified vendors. Stock is confirmed before payment.</p></div></div><Link href="/shop">View all deals <span>→</span></Link></div>
        <div className={styles.productScroller}>{products.map((product) => <ProductCard key={product.name} product={product} onAdd={() => addToCart(product.name)} />)}</div>
      </section>

      <section className={`${styles.shell} ${styles.section}`} id="popular">
        <div className={styles.sectionHead}><div><p className={styles.kicker}>CUSTOMER FAVOURITES</p><h2>Popular right now</h2></div><Link href="/shop">Shop all products <span>→</span></Link></div>
        <div className={styles.popularGrid}>{products.slice(0, 5).map((product) => <ProductCard key={product.name} product={product} compact onAdd={() => addToCart(product.name)} />)}</div>
      </section>

      <section className={`${styles.shell} ${styles.section}`} id="collections">
        <div className={styles.sectionHead}><div><p className={styles.kicker}>CURATED COLLECTIONS</p><h2>Find something for every moment</h2></div></div>
        <div className={styles.collections}>{collections.map((collection) => <article className={styles.collection} key={collection.title}><div className={styles.collectionHead}><div><h3>{collection.title}</h3><p>{collection.subtitle}</p></div><a href="#popular">Explore <span>→</span></a></div><div className={styles.collectionProducts}>{collection.items.map((product) => <ProductCard key={product.name} product={product} compact />)}</div></article>)}</div>
      </section>

      <section className={`${styles.shell} ${styles.section}`} id="vendors">
        <div className={styles.sectionHead}><div><p className={styles.kicker}>SHOP FROM PEOPLE YOU CAN TRUST</p><h2>Discover our vendors</h2></div><a href="#vendors">See all vendors <span>→</span></a></div>
        <div className={styles.vendorGrid}>{vendors.map((vendor) => <article className={styles.vendorCard} key={vendor.name}><div className={styles.vendorHeader}><span>{vendor.initials}</span><div><h3>{vendor.name} <b>✓</b></h3><p>{vendor.specialty}</p></div></div><div className={styles.vendorProducts}>{vendor.items.map((type, index) => <ProductArt key={`${type}-${index}`} type={type} tint={['#ead8c6', '#e8ddd5', '#dedfe4'][index]} />)}</div><button>Visit storefront <span>→</span></button></article>)}</div>
      </section>

      <section className={`${styles.shell} ${styles.section} ${styles.discovery}`}>
        <div><p className={styles.kicker}>PICK UP WHERE YOU LEFT OFF</p><h2>Recently viewed</h2><div className={styles.recentList}>{products.slice(0, 3).map((p) => <ProductCard key={p.name} product={p} compact />)}</div></div>
        <div><p className={styles.kicker}>MORE TO EXPLORE</p><h2>Made for thoughtful gifting</h2><div className={styles.recentList}>{products.slice(3, 6).map((p) => <ProductCard key={p.name} product={p} compact />)}</div></div>
      </section>

      <section className={`${styles.shell} ${styles.section} ${styles.trust}`}>
        <div className={styles.centeredHead}><h2>Why shop on Fendor</h2><p>Built to make discovery, confirmation, and fulfilment feel clear from the start.</p></div>
        <div className={styles.trustGrid}>{[
          ['✓', 'Verified vendors', 'Vendors submit identity and business information before their products can be approved.'],
          ['▣', 'Stock confirmation', 'The vendor confirms availability before Fendor asks you to complete an offline payment.'],
          ['→', 'Clear order updates', 'Follow each order through confirmation, payment review, preparation, and fulfilment.'],
          ['?', 'Fendor support', 'Questions and order issues stay inside Fendor so every request has a visible record.'],
        ].map(([icon, title, copy]) => <article key={title}><span aria-hidden="true">{icon}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className={`${styles.shell} ${styles.vendorCta}`}>
        <div><span className={styles.lightPill}>VENDOR APPLICATIONS OPEN</span><h2>Have products to sell? Meet Fendor.</h2><p>Join a marketplace built around verified products, responsive stock confirmation, and a clear order process.</p><div className={styles.heroButtons}><Link href="/signup" className={styles.primaryButton}>Open your storefront</Link><a href="#support" className={styles.secondaryButton}>Learn how it works</a></div></div>
        <div className={styles.protocol}><h3>WHAT WE LOOK FOR</h3><ul><li>Verified identity and business details</li><li>Accurate product and stock information</li><li>Fast responses to order requests</li><li>Reliable preparation and handover</li></ul></div>
      </section>

      <section className={`${styles.shell} ${styles.newsletter}`}><div><span className={styles.pill}>CURATED UPDATES</span><h2>Stay in the loop</h2><p>Receive new collections, vendor stories, and thoughtful gift ideas.</p></div><form onSubmit={(e) => { e.preventDefault(); setNotice('You’re on the Fendor updates list.'); }}><div><input required type="email" placeholder="Enter your email address" aria-label="Email address" /><button>Subscribe</button></div><small>No spam. Unsubscribe at any time.</small></form></section>
    </main>

    <footer className={styles.footer} id="support"><div className={`${styles.shell} ${styles.footerGrid}`}><div><Link href="/" className={styles.logo}><Image src="/icons/home/logo.svg" width={40} height={40} alt="" /><span><b>Fendor</b><small>MARKETPLACE</small></span></Link><p>Thoughtful products from verified vendors, coordinated through one dependable marketplace.</p><span className={styles.footerBadge}>✓ Verified marketplace</span></div>{[
      ['Shopping', 'Browse products', 'Categories', 'Featured vendors', 'Saved items'], ['Selling', 'Sell on Fendor', 'Vendor hub', 'Vendor standards'], ['Customer care', 'Help centre', 'Order tracking', 'Contact Fendor'], ['Trust & policies', 'Vendor verification', 'Returns', 'Privacy policy', 'Terms'],
    ].map(([title, ...links]) => <div key={title}><h3>{title}</h3>{links.map((link) => <a href="#" key={link}>{link}</a>)}</div>)}</div><div className={`${styles.shell} ${styles.copyright}`}>© 2026 Fendor Marketplace. Built for meaningful commerce.</div></footer>
  </div>;
}
