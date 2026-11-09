'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { addCartItem, cartItemCount } from '../../lib/client/cart';
import { useCart } from '../../lib/client/use-cart';
import { CatalogueProduct, listProducts, MarketplaceApiError } from '../../lib/client/marketplace';
import { Icon, type IconName } from '../ui/icon';
import styles from './home-page.module.css';

const categories: [string, IconName][] = [
  ['Phones & Tablets', 'smartphone'], ['Electronics', 'headphones'], ['Fashion', 'shirt'], ['Home Living', 'home'],
  ['Health & Beauty', 'sparkles'], ['Groceries', 'shopping-basket'], ['Footwear', 'shoe'], ['Accessories', 'watch'],
  ['Computing', 'laptop'], ['Kitchenware', 'cooking-pot'],
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

const categoryArt: Record<string, Pick<DisplayProduct, 'art' | 'tint'>> = {
  flowers: { art: 'tea', tint: '#ead9cc' }, cakes: { art: 'tea', tint: '#f1dfd8' }, hampers: { art: 'bag', tint: '#ead8c6' },
  'personalised-gifts': { art: 'tamper', tint: '#ddd1c4' }, fashion: { art: 'fashion', tint: '#d8ded8' }, home: { art: 'tea', tint: '#ead9cc' }, other: { art: 'bag', tint: '#dedfe4' },
};

function catalogueProduct(product: CatalogueProduct): DisplayProduct {
  return { id: product.id, variantId: product.variantId, name: product.title, vendor: 'Approved Fendora vendor', price: `₦${Math.round(product.priceKobo / 100).toLocaleString('en-NG')}`, imagePath: product.imagePath, description: product.description, category: product.category, ...(categoryArt[product.category] ?? categoryArt.other) };
}

const heroSlides = [
  { eyebrow: 'Curated for meaningful moments', title: 'Find Your Next Favourite Thing', copy: 'Discover thoughtful products from approved Nigerian vendors, brought together in one coordinated marketplace.', position: '50% 48%' },
  { eyebrow: 'Gifts with more meaning', title: 'Make Every Gift Feel Personal', copy: 'Choose a product, add the recipient details, and let Fendora guide the order from confirmation to fulfilment.', position: '28% 50%' },
  { eyebrow: 'Local makers, closer to you', title: 'Discover Trusted Nigerian Vendors', copy: 'Explore independent stores and distinctive products, with Fendora coordinating every confirmed order.', position: '73% 50%' },
];

export function ProductArt({ type, tint }: { type: string; tint: string }) {
  return <div className={`${styles.productArt} ${styles[type]}`} style={{ backgroundColor: tint }} aria-hidden="true"><span /></div>;
}

export function productHref(product: DisplayProduct) {
  return `/product/${product.id ?? product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
}

export function displayProductToCartItem(product: DisplayProduct) {
  return {
    id: product.variantId ?? product.id ?? productHref(product),
    productId: product.id,
    variantId: product.variantId,
    name: product.name,
    vendor: product.vendor,
    priceKobo: Number(product.price.replace(/\D/g, '')) * 100,
    oldPriceKobo: product.old ? Number(product.old.replace(/\D/g, '')) * 100 : undefined,
    art: product.art,
    tint: product.tint,
    imagePath: product.imagePath,
    option: 'Standard finish',
  };
}

export function ProductCard({ product, compact = false, onAdd }: { product: DisplayProduct; compact?: boolean; onAdd?: () => void }) {
  return <article className={`${styles.productCard} ${compact ? styles.compactCard : ''}`}>
    {product.imagePath ? <div className={styles.productImage}><Image src={product.imagePath} fill sizes="(max-width: 720px) 55vw, 25vw" alt={product.name} /></div> : <ProductArt type={product.art} tint={product.tint} />}
    <div className={styles.vendorLine}><span className={styles.verifiedDot}><Icon name="check" size={12} /></span>{product.vendor}</div>
    <h3><Link className={styles.productLink} href={productHref(product)}>{product.name}</Link></h3>
    <div className={styles.priceRow}><strong>{product.price}</strong>{product.old && <del>{product.old}</del>}</div>
    {!compact && <small>Exact stock is confirmed by the vendor before checkout.</small>}
    {onAdd && <button className={styles.addButton} onClick={onAdd}>Add to cart</button>}
  </article>;
}

export function HomePage() {
  const [slide, setSlide] = useState(0);
  const { items: cartItems } = useCart();
  const cartCount = cartItemCount(cartItems);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [catalogue, setCatalogue] = useState<DisplayProduct[]>([]);
  const [catalogueState, setCatalogueState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % heroSlides.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    listProducts({ limit: 12 }, controller.signal).then(({ products: result }) => {
      setCatalogue(result.map(catalogueProduct));
      setCatalogueState('ready');
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setCatalogue([]);
      setCatalogueState('error');
      setNotice(error instanceof MarketplaceApiError && error.status === 503 ? 'The live marketplace is temporarily unavailable.' : 'Fendora could not load the live catalogue.');
    });
    return () => controller.abort();
  }, []);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const query = search.trim();
    if (query) window.location.href = `/shop?q=${encodeURIComponent(query)}`;
    else setNotice('Type what you are looking for first.');
  }

  function addToCart(product: DisplayProduct) {
    addCartItem(displayProductToCartItem(product));
    setNotice(`${product.name} has been added to your cart.`);
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <div className={styles.utility}><div className={styles.shell}><span className={styles.betaBadge}>PUBLIC BETA</span><span>Help & Support</span><span>Sell on Fendora</span></div></div>
      <div className={`${styles.shell} ${styles.mainHeader}`}>
        <Link href="/" className={styles.logo} aria-label="Fendora home"><Image src="/icons/home/logo.svg" width={40} height={40} alt="" priority /><span><b>Fendora</b><small>MARKETPLACE</small></span></Link>
        <form className={styles.search} onSubmit={handleSearch} role="search">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products, brands and categories" aria-label="Search Fendora" />
          <button aria-label="Submit search"><Icon name="search" size={19} /></button>
        </form>
        <nav className={styles.actions} aria-label="Account actions">
          <Link href="/account" aria-label="My Account"><Icon name="user" size={21} /><span>My Account</span></Link>
          <Link href="/help"><Icon name="circle-help" size={21} /><span>Help</span></Link>
          <Link href="/cart" className={styles.cart}><Icon name="shopping-cart" size={23} /><span>Cart</span>{cartCount > 0 && <b>{cartCount}</b>}</Link>
        </nav>
      </div>
      <nav className={`${styles.shell} ${styles.categoryNav}`} aria-label="Main categories">
        <a href="#categories" className={styles.allCategories}><Icon name="menu" size={18} /> All Categories</a>
        {['New Arrivals', 'Phones & Tablets', 'Fashion', 'Home & Living', 'Gifts', 'Deals'].map((item) => <Link key={item} href="/shop">{item}</Link>)}
      </nav>
    </header>

    {notice && <button className={styles.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}

    <main>
      <section className={`${styles.shell} ${styles.hero}`} aria-roledescription="carousel" aria-label="Fendora highlights">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{heroSlides[slide].eyebrow}</p>
          <h1>{heroSlides[slide].title}</h1>
          <p>{heroSlides[slide].copy}</p>
          <div className={styles.heroButtons}><Link href="/shop" className={styles.primaryButton}>Browse approved products</Link><a href="#how-it-works" className={styles.textButton}>How gifting works <Icon name="arrow-right" size={16}/></a></div>
        </div>
        <div className={styles.heroImage}>
          <Image src="/images/home/hero-pottery.png" fill sizes="(max-width: 720px) 100vw, 50vw" alt="A curated handmade pottery collection" priority style={{ objectPosition: heroSlides[slide].position }} />
          <div className={styles.heroBadge}><small>THIS WEEK’S EDIT</small><strong>{slide === 0 ? 'Made with care' : slide === 1 ? 'Gift beautifully' : 'Shop local'}</strong></div>
          <button className={`${styles.arrow} ${styles.previous}`} aria-label="Previous slide" onClick={() => setSlide((slide + 2) % 3)}><Icon name="chevron-left" size={24}/></button>
          <button className={`${styles.arrow} ${styles.next}`} aria-label="Next slide" onClick={() => setSlide((slide + 1) % 3)}><Icon name="chevron-right" size={24}/></button>
        </div>
        <div className={styles.dots}>{heroSlides.map((_, index) => <button key={index} className={index === slide ? styles.activeDot : ''} aria-label={`Go to slide ${index + 1}`} onClick={() => setSlide(index)} />)}</div>
      </section>

      <section className={`${styles.shell} ${styles.section}`} id="categories">
        <div className={styles.sectionHead}><div><p className={styles.kicker}>SHOP YOUR WAY</p><h2>Browse popular categories</h2></div><Link href="/shop">View all <span>→</span></Link></div>
        <div className={styles.categoryGrid}>{categories.map(([name, icon]) => <Link href="/shop" className={styles.category} key={name}><span><Icon name={icon} size={25}/></span><b>{name}</b></Link>)}</div>
      </section>

      <section className={`${styles.shell} ${styles.section} ${styles.panel}`}>
        <div className={styles.sectionHead}><div className={styles.titleWithBadge}><span className={styles.pill}>FLASH WINDOW</span><div><h2>Deals worth discovering</h2><p>Limited offers from verified vendors. Stock is confirmed before payment.</p></div></div><Link href="/shop">View all deals <span>→</span></Link></div>
        {catalogueState === 'loading' ? <div className={styles.catalogueState}>Loading approved products…</div> : catalogueState === 'error' ? <div className={styles.catalogueState}>Live products are unavailable right now. <Link href="/shop">Try the marketplace again</Link>.</div> : catalogue.length ? <div className={styles.productScroller}>{catalogue.slice(0, 6).map((product) => <ProductCard key={product.id} product={product} onAdd={() => addToCart(product)} />)}</div> : <div className={styles.catalogueState}><strong>Our approved catalogue is being prepared.</strong><br />No product is available to request until its vendor and listing pass Fendora review.</div>}
      </section>

      {catalogueState === 'ready' && catalogue.length > 0 && <section className={`${styles.shell} ${styles.section}`} id="popular">
        <div className={styles.sectionHead}><div><p className={styles.kicker}>CUSTOMER FAVOURITES</p><h2>Popular right now</h2></div><Link href="/shop">Shop all products <span>→</span></Link></div>
        <div className={styles.popularGrid}>{catalogue.slice(0, 5).map((product) => <ProductCard key={product.id} product={product} compact onAdd={() => addToCart(product)} />)}</div>
      </section>}

      {catalogue.length > 0 && <section className={`${styles.shell} ${styles.section} ${styles.discovery}`}>
        <div><p className={styles.kicker}>NEW TO THE MARKETPLACE</p><h2>Fresh approved products</h2><div className={styles.recentList}>{catalogue.slice(0, 3).map((p) => <ProductCard key={p.id} product={p} compact />)}</div></div>
        <div><p className={styles.kicker}>MORE TO EXPLORE</p><h2>Made for thoughtful gifting</h2><div className={styles.recentList}>{catalogue.slice(3, 6).map((p) => <ProductCard key={p.id} product={p} compact />)}</div></div>
      </section>}

      <section className={`${styles.shell} ${styles.section} ${styles.trust}`} id="how-it-works">
        <div className={styles.centeredHead}><p className={styles.kicker}>PERSONALISED GIFTING, STEP BY STEP</p><h2>From a thoughtful idea to a coordinated delivery</h2><p>Fendora keeps the customer journey clear while approved vendors focus on supplying the product.</p></div>
        <div className={styles.trustGrid}>{[
          ['shopping-basket', '1. Choose an approved product', 'Browse only listings approved for the public catalogue. Availability is still confirmed for your exact quantity.'],
          ['message-circle', '2. Personalise the request', 'Tell us about the recipient, occasion and relationship, then add a message and packaging preference.'],
          ['package', '3. Vendor confirms exact stock', 'The approved vendor reserves the requested quantity. A listing is never treated as in stock before this step.'],
          ['truck', '4. Review, pay and follow delivery', 'Review product, packaging and delivery costs before checkout. Fendora then coordinates preparation and delivery updates.'],
        ].map(([icon, title, copy]) => <article key={title}><span aria-hidden="true"><Icon name={icon as IconName} size={26}/></span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className={`${styles.shell} ${styles.section} ${styles.trust}`}>
        <div className={styles.centeredHead}><h2>Why shop on Fendora</h2><p>Built to make discovery, confirmation, and fulfilment feel clear from the start.</p></div>
        <div className={styles.trustGrid}>{[
          ['shield-check', 'Approved vendors', 'Vendors submit identity and business information before their products can be approved.'],
          ['package', 'Stock confirmation', 'The vendor confirms and reserves the exact quantity before checkout can open.'],
          ['truck', 'Clear order updates', 'Follow each order through stock confirmation, payment, preparation, and fulfilment.'],
          ['message-circle', 'Fendora support', 'Questions and order issues stay inside Fendora so every request has a visible record.'],
        ].map(([icon, title, copy]) => <article key={title}><span aria-hidden="true"><Icon name={icon as IconName} size={26}/></span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className={`${styles.shell} ${styles.vendorCta}`}>
        <div><span className={styles.lightPill}>VENDOR APPLICATIONS OPEN</span><h2>Have products to sell? Meet Fendora.</h2><p>Join a marketplace built around verified products, responsive stock confirmation, and a clear order process.</p><div className={styles.heroButtons}><Link href="/signup" className={styles.primaryButton}>Open your storefront</Link><a href="#support" className={styles.secondaryButton}>Learn how it works</a></div></div>
        <div className={styles.protocol}><h3>WHAT WE LOOK FOR</h3><ul><li>Verified identity and business details</li><li>Accurate product and stock information</li><li>Fast responses to order requests</li><li>Reliable preparation and handover</li></ul></div>
      </section>

      <section className={`${styles.shell} ${styles.newsletter}`}><div><span className={styles.pill}>CURATED UPDATES</span><h2>Stay in the loop</h2><p>Receive new collections, vendor stories, and thoughtful gift ideas.</p></div><form onSubmit={(e) => { e.preventDefault(); setNotice('You’re on the Fendora updates list.'); }}><div><input required type="email" placeholder="Enter your email address" aria-label="Email address" /><button>Subscribe</button></div><small>No spam. Unsubscribe at any time.</small></form></section>
    </main>

    <footer className={styles.footer} id="support"><div className={`${styles.shell} ${styles.footerGrid}`}><div><Link href="/" className={styles.logo}><Image src="/icons/home/logo.svg" width={40} height={40} alt="" /><span><b>Fendora</b><small>MARKETPLACE</small></span></Link><p>Thoughtful products from approved vendors, coordinated through one dependable marketplace.</p><a href="mailto:officialfendora@gmail.com">officialfendora@gmail.com</a></div><div><h3>Shopping</h3><Link href="/shop">Browse products</Link><Link href="/saved">Saved products</Link><Link href="/cart">Cart</Link></div><div><h3>Customer care</h3><Link href="/help">Help centre</Link><Link href="/orders">Order tracking</Link><Link href="/support">Contact Fendora</Link></div><div><h3>Trust & policies</h3><Link href="/policies/refunds">Refunds & cancellations</Link><Link href="/policies/returns">Returns</Link><Link href="/policies/privacy">Privacy notice</Link><Link href="/policies/terms">Marketplace terms</Link><Link href="/policies/vendor-agreement">Vendor agreement</Link></div></div><div className={`${styles.shell} ${styles.copyright}`}>Fendora is operated by Fendora Innovations Limited · RC 9980315 · Nigeria · © 2026</div></footer>
  </div>;
}
