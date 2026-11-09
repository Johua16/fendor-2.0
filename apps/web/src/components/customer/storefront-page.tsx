'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CatalogueProduct, listProducts, MarketplaceApiError } from '../../lib/client/marketplace';
import { addCartItem, cartItemCount } from '../../lib/client/cart';
import { useCart } from '../../lib/client/use-cart';
import { DisplayProduct, displayProductToCartItem, ProductCard } from './home-page';
import { Icon } from '../ui/icon';
import home from './home-page.module.css';
import styles from './storefront-page.module.css';

const categoryOptions = [
  ['All products', ''], ['Flowers', 'flowers'], ['Cakes', 'cakes'], ['Hampers', 'hampers'],
  ['Personalised gifts', 'personalised-gifts'], ['Fashion', 'fashion'], ['Home', 'home'], ['Other', 'other'],
] as const;

const categoryArt: Record<string, Pick<DisplayProduct, 'art' | 'tint'>> = {
  flowers: { art: 'tea', tint: '#ead9cc' }, cakes: { art: 'tea', tint: '#f1dfd8' }, hampers: { art: 'bag', tint: '#ead8c6' },
  'personalised-gifts': { art: 'tamper', tint: '#ddd1c4' }, fashion: { art: 'fashion', tint: '#d8ded8' }, home: { art: 'tea', tint: '#ead9cc' }, other: { art: 'bag', tint: '#dedfe4' },
};

function toDisplayProduct(product: CatalogueProduct): DisplayProduct {
  const visual = categoryArt[product.category] ?? categoryArt.other;
  return { id: product.id, variantId: product.variantId, name: product.title, vendor: 'Approved Fendora vendor', price: `₦${Math.round(product.priceKobo / 100).toLocaleString('en-NG')}`, imagePath: product.imagePath, description: product.description, category: product.category, ...visual };
}

export function StorefrontPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('popular');
  const { items: cartItems } = useCart();
  const cartCount = cartItemCount(cartItems);
  const [notice, setNotice] = useState('');
  const [catalogue, setCatalogue] = useState<DisplayProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('q')?.trim() ?? '';
    if (requested) { setQuery(requested); setSubmittedQuery(requested); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    listProducts({ q: submittedQuery || undefined, category: category || undefined, limit: 50 }, controller.signal)
      .then(({ products: result }) => setCatalogue(result.map(toDisplayProduct)))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogue([]);
        setLoadError(error instanceof MarketplaceApiError && error.status === 503 ? 'The marketplace catalogue is temporarily unavailable. Please try again shortly.' : error instanceof Error ? error.message : 'Fendora could not load the catalogue.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [category, submittedQuery, reloadKey]);

  const visibleProducts = useMemo(() => {
    return [...catalogue].sort((a, b) => {
      if (sort === 'price-low') return Number(a.price.replace(/\D/g, '')) - Number(b.price.replace(/\D/g, ''));
      if (sort === 'price-high') return Number(b.price.replace(/\D/g, '')) - Number(a.price.replace(/\D/g, ''));
      return 0;
    });
  }, [catalogue, sort]);

  function runSearch(event: FormEvent) {
    event.preventDefault();
    setSubmittedQuery(query.trim());
    setNotice(query.trim() ? `Results for “${query.trim()}”` : 'Showing all products');
  }

  function addToCart(product: DisplayProduct) {
    addCartItem(displayProductToCartItem(product));
    setNotice(`${product.name} added to cart`);
  }

  return <div className={home.page}>
    <header className={home.header}>
      <div className={home.utility}><div className={home.shell}><span className={home.betaBadge}>PUBLIC BETA</span><span>Help & Support</span><span>Sell on Fendora</span></div></div>
      <div className={`${home.shell} ${home.mainHeader}`}>
        <Link href="/" className={home.logo} aria-label="Fendora home"><Image src="/icons/home/logo.svg" width={40} height={40} alt="" priority /><span><b>Fendora</b><small>MARKETPLACE</small></span></Link>
        <form className={home.search} onSubmit={runSearch} role="search">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, brands or vendors" aria-label="Search products" />
          <button aria-label="Submit search"><Icon name="search" size={19}/></button>
        </form>
        <nav className={home.actions} aria-label="Account actions">
          <Link href="/account"><Icon name="user" size={21}/><span>Account</span></Link>
          <Link href="/help"><Icon name="circle-help" size={21}/><span>Help</span></Link>
          <Link href="/cart" className={home.cart}><Icon name="shopping-cart" size={23}/><span>Cart</span>{cartCount > 0 && <b>{cartCount}</b>}</Link>
        </nav>
      </div>
      <nav className={`${home.shell} ${home.categoryNav}`} aria-label="Marketplace categories">
        <Link href="/shop" className={home.allCategories}><Icon name="menu" size={18}/> All Categories</Link>
        {categoryOptions.slice(1, 6).map(([label, value]) => <button className={styles.categoryButton} key={value} onClick={() => setCategory(value)}>{label}</button>)}
      </nav>
    </header>

    {notice && <button className={home.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}

    <main>
      <section className={`${home.shell} ${styles.intro}`}>
        <div><p className={home.kicker}>FENDORA MARKETPLACE</p><h1>Shop products from approved vendors</h1><p>Browse approved public listings. Fendora confirms and reserves your exact quantity before checkout can open.</p></div>
        <div className={styles.promise}><b>✓</b><span><strong>Confirmation before payment</strong><small>No payment request until stock and order details are approved.</small></span></div>
      </section>

      <section className={`${home.shell} ${styles.catalogue}`}>
        <div className={styles.catalogueHead}><div><p className={home.kicker}>BROWSE THE MARKETPLACE</p><h2>Popular on Fendora</h2><p>{`${visibleProducts.length} product${visibleProducts.length === 1 ? '' : 's'} available to request`}</p></div><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">Popular</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></div>
        <div className={styles.filters} aria-label="Filter by category">{categoryOptions.map(([label, value]) => <button key={value || 'all'} className={category === value ? styles.activeFilter : ''} onClick={() => setCategory(value)}>{label}</button>)}</div>
        {loading ? <div className={styles.statePanel} aria-live="polite"><span className={styles.loader} /><h3>Loading approved products</h3><p>Fendora is checking the current public catalogue.</p></div> : loadError ? <div className={styles.statePanel} role="alert"><span><Icon name="alert-triangle" size={28}/></span><h3>We couldn’t load the marketplace</h3><p>{loadError}</p><button onClick={() => setReloadKey((key) => key + 1)}>Try again</button></div> : visibleProducts.length ? <div className={styles.grid}>{visibleProducts.map((product) => <ProductCard key={product.id ?? product.name} product={product} onAdd={() => addToCart(product)} />)}</div> : <div className={styles.empty}><span><Icon name="search" size={28}/></span><h3>{submittedQuery || category ? 'No approved products match this search' : 'Our approved catalogue is being prepared'}</h3><p>{submittedQuery || category ? 'Try another keyword or clear the current category.' : 'No product is available to request until its vendor and listing pass Fendora review.'}</p>{(submittedQuery || category) && <button onClick={() => { setCategory(''); setQuery(''); setSubmittedQuery(''); }}>Clear filters</button>}</div>}
      </section>

      <section className={`${home.shell} ${home.newsletter}`}><div><span className={home.pill}>CURATED UPDATES</span><h2>Stay in the loop</h2><p>Receive new collections, vendor stories, and thoughtful gift ideas.</p></div><form onSubmit={(event) => { event.preventDefault(); setNotice('You’re on the Fendora updates list.'); }}><div><input required type="email" placeholder="Enter your email address" aria-label="Email address" /><button>Subscribe</button></div><small>No spam. Unsubscribe at any time.</small></form></section>
    </main>

    <footer className={home.footer} id="support"><div className={`${home.shell} ${home.footerGrid}`}><div><Link href="/" className={home.logo}><Image src="/icons/home/logo.svg" width={40} height={40} alt="" /><span><b>Fendora</b><small>MARKETPLACE</small></span></Link><p>Thoughtful products from approved vendors, coordinated through one dependable marketplace.</p><a href="mailto:officialfendora@gmail.com">officialfendora@gmail.com</a></div><div><h3>Shopping</h3><Link href="/shop">Browse products</Link><Link href="/saved">Saved products</Link><Link href="/cart">Cart</Link></div><div><h3>Selling</h3><Link href="/welcome">Sell on Fendora</Link><Link href="/vendor">Vendor hub</Link><Link href="/policies/vendor-agreement">Vendor standards</Link></div><div><h3>Customer care</h3><Link href="/help">Help centre</Link><Link href="/orders">Order tracking</Link><Link href="/support">Contact Fendora</Link></div><div><h3>Trust & policies</h3><Link href="/policies/refunds">Refunds & cancellations</Link><Link href="/policies/returns">Returns</Link><Link href="/policies/privacy">Privacy notice</Link><Link href="/policies/terms">Terms</Link></div></div><div className={`${home.shell} ${home.copyright}`}>Fendora is operated by Fendora Innovations Limited · RC 9980315 · Nigeria · © 2026</div></footer>
  </div>;
}
