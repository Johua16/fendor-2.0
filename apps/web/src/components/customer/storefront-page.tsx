'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { ProductCard, products } from './home-page';
import home from './home-page.module.css';
import styles from './storefront-page.module.css';

const categoryOptions = ['All products', 'Phones & Tablets', 'Electronics', 'Fashion', 'Home & Living', 'Gifts'];

const categoryByProduct: Record<string, string> = {
  'Samsung Galaxy A55 5G': 'Phones & Tablets',
  'Vegetable-Tanned Field Satchel': 'Fashion',
  'Soundcore Space One ANC': 'Electronics',
  'Ojai Matte Clay Tea Set': 'Home & Living',
  'Men’s Slim-Fit Chinos': 'Fashion',
  'Precision Espresso Tamper': 'Gifts',
};

export function StorefrontPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [category, setCategory] = useState('All products');
  const [sort, setSort] = useState('popular');
  const [cartCount, setCartCount] = useState(0);
  const [notice, setNotice] = useState('');

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchesCategory = category === 'All products' || categoryByProduct[product.name] === category;
      const haystack = `${product.name} ${product.vendor}`.toLowerCase();
      return matchesCategory && haystack.includes(submittedQuery.toLowerCase());
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'price-low') return Number(a.price.replace(/\D/g, '')) - Number(b.price.replace(/\D/g, ''));
      if (sort === 'price-high') return Number(b.price.replace(/\D/g, '')) - Number(a.price.replace(/\D/g, ''));
      return 0;
    });
  }, [category, sort, submittedQuery]);

  function runSearch(event: FormEvent) {
    event.preventDefault();
    setSubmittedQuery(query.trim());
    setNotice(query.trim() ? `Results for “${query.trim()}”` : 'Showing all products');
  }

  function addToCart(name: string) {
    setCartCount((current) => current + 1);
    setNotice(`${name} added to cart`);
  }

  return <div className={home.page}>
    <header className={home.header}>
      <div className={home.utility}><div className={home.shell}><span>Help & Support</span><span>Sell on Fendor</span></div></div>
      <div className={`${home.shell} ${home.mainHeader}`}>
        <Link href="/" className={home.logo} aria-label="Fendor home"><Image src="/icons/home/logo.svg" width={40} height={40} alt="" priority /><span><b>Fendor</b><small>MARKETPLACE</small></span></Link>
        <form className={home.search} onSubmit={runSearch} role="search">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, brands or vendors" aria-label="Search products" />
          <button aria-label="Submit search"><Image src="/icons/home/search.svg" width={19} height={19} alt="" /></button>
        </form>
        <nav className={home.actions} aria-label="Account actions">
          <Link href="/login"><Image src="/icons/home/account.svg" width={21} height={21} alt="" /><span>Account</span></Link>
          <Link href="#support"><Image src="/icons/home/help.svg" width={21} height={21} alt="" /><span>Help</span></Link>
          <Link href="/cart" className={home.cart}><Image src="/icons/home/cart.svg" width={23} height={23} alt="" /><span>Cart</span>{cartCount > 0 && <b>{cartCount}</b>}</Link>
        </nav>
      </div>
      <nav className={`${home.shell} ${home.categoryNav}`} aria-label="Marketplace categories">
        <Link href="/shop" className={home.allCategories}>☰ &nbsp; All Categories</Link>
        {categoryOptions.slice(1).map((item) => <button className={styles.categoryButton} key={item} onClick={() => setCategory(item)}>{item}</button>)}
      </nav>
    </header>

    {notice && <button className={home.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}

    <main>
      <section className={`${home.shell} ${styles.intro}`}>
        <div><p className={home.kicker}>FENDOR MARKETPLACE</p><h1>Shop products from verified vendors</h1><p>Browse the marketplace freely. Fendor confirms stock with the vendor before asking you to complete payment.</p></div>
        <div className={styles.promise}><b>✓</b><span><strong>Confirmation before payment</strong><small>No payment request until stock and order details are approved.</small></span></div>
      </section>

      <section className={`${home.shell} ${home.section} ${home.panel}`}>
        <div className={home.sectionHead}><div className={home.titleWithBadge}><span className={home.pill}>FLASH WINDOW</span><div><h2>Deals worth discovering</h2><p>Selected offers from verified vendors, subject to stock confirmation.</p></div></div></div>
        <div className={home.productScroller}>{products.map((product) => <ProductCard key={product.name} product={product} onAdd={() => addToCart(product.name)} />)}</div>
      </section>

      <section className={`${home.shell} ${styles.catalogue}`}>
        <div className={styles.catalogueHead}><div><p className={home.kicker}>BROWSE THE MARKETPLACE</p><h2>Popular on Fendor</h2><p>{`${visibleProducts.length} product${visibleProducts.length === 1 ? '' : 's'} available to request`}</p></div><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">Popular</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></div>
        <div className={styles.filters} aria-label="Filter by category">{categoryOptions.map((item) => <button key={item} className={category === item ? styles.activeFilter : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
        {visibleProducts.length ? <div className={styles.grid}>{visibleProducts.map((product) => <ProductCard key={product.name} product={product} onAdd={() => addToCart(product.name)} />)}</div> : <div className={styles.empty}><span>⌕</span><h3>No products match this search</h3><p>Try another keyword or clear the current category.</p><button onClick={() => { setCategory('All products'); setQuery(''); setSubmittedQuery(''); }}>Clear filters</button></div>}
      </section>

      <section className={`${home.shell} ${home.newsletter}`}><div><span className={home.pill}>CURATED UPDATES</span><h2>Stay in the loop</h2><p>Receive new collections, vendor stories, and thoughtful gift ideas.</p></div><form onSubmit={(event) => { event.preventDefault(); setNotice('You’re on the Fendor updates list.'); }}><div><input required type="email" placeholder="Enter your email address" aria-label="Email address" /><button>Subscribe</button></div><small>No spam. Unsubscribe at any time.</small></form></section>
    </main>

    <footer className={home.footer} id="support"><div className={`${home.shell} ${home.footerGrid}`}><div><Link href="/" className={home.logo}><Image src="/icons/home/logo.svg" width={40} height={40} alt="" /><span><b>Fendor</b><small>MARKETPLACE</small></span></Link><p>Thoughtful products from verified vendors, coordinated through one dependable marketplace.</p><span className={home.footerBadge}>✓ Verified marketplace</span></div>{[['Shopping', 'Browse products', 'Categories', 'Featured vendors'], ['Selling', 'Sell on Fendor', 'Vendor hub', 'Vendor standards'], ['Customer care', 'Help centre', 'Order tracking', 'Contact Fendor'], ['Trust & policies', 'Vendor verification', 'Returns', 'Privacy policy']].map(([title, ...links]) => <div key={title}><h3>{title}</h3>{links.map((link) => <a href="#" key={link}>{link}</a>)}</div>)}</div><div className={`${home.shell} ${home.copyright}`}>© 2026 Fendor Marketplace. Built for meaningful commerce.</div></footer>
  </div>;
}
