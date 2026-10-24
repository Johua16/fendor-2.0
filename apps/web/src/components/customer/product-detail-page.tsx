'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { ProductArt, ProductCard, products } from './home-page';
import home from './home-page.module.css';
import styles from './product-detail-page.module.css';

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function ProductDetailPage({ slug }: { slug: string }) {
  const product = useMemo(() => products.find((item) => slugify(item.name) === slug) ?? products[0], [slug]);
  const [quantity, setQuantity] = useState(1);
  const [gallery, setGallery] = useState(0);
  const [saved, setSaved] = useState(false);
  const [gift, setGift] = useState('standard');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const unitPrice = Number(product.price.replace(/\D/g, ''));
  const oldUnitPrice = Number(product.old.replace(/\D/g, ''));

  function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.location.href = '/shop';
  }

  function requestOrder() {
    setNotice('Order request prepared. Fendor will confirm stock before payment.');
  }

  return <div className={home.page}>
    <header className={home.header}>
      <div className={home.utility}><div className={home.shell}><span>Help & Support</span><span>Sell on Fendor</span></div></div>
      <div className={`${home.shell} ${home.mainHeader}`}>
        <Link href="/" className={home.logo} aria-label="Fendor home"><Image src="/icons/home/logo.svg" width={40} height={40} alt="" priority /><span><b>Fendor</b><small>MARKETPLACE</small></span></Link>
        <form className={home.search} onSubmit={runSearch} role="search"><input placeholder="Search products, brands or vendors" aria-label="Search products" /><button aria-label="Submit search"><Image src="/icons/home/search.svg" width={19} height={19} alt="" /></button></form>
        <nav className={home.actions} aria-label="Account actions"><Link href="/login"><Image src="/icons/home/account.svg" width={21} height={21} alt="" /><span>Account</span></Link><Link href="#support"><Image src="/icons/home/help.svg" width={21} height={21} alt="" /><span>Help</span></Link><Link href="/cart"><Image src="/icons/home/cart.svg" width={23} height={23} alt="" /><span>Cart</span></Link></nav>
      </div>
      <nav className={`${home.shell} ${home.categoryNav}`} aria-label="Marketplace categories"><Link href="/shop" className={home.allCategories}>☰ &nbsp; All Categories</Link>{['Phones & Tablets', 'Electronics', 'Fashion', 'Home & Living', 'Gifts'].map((item) => <Link key={item} href="/shop">{item}</Link>)}</nav>
    </header>

    {notice && <button className={home.toast} onClick={() => setNotice('')} aria-live="polite">{notice}<span>×</span></button>}

    <main className={home.shell}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">Home</Link><span>›</span><Link href="/shop">Marketplace</Link><span>›</span><b>{product.name}</b></nav>

      <section className={styles.showcase}>
        <div className={styles.gallery}>
          <div className={styles.mainVisual}>
            <ProductArt type={product.art} tint={[product.tint, '#f2dfd6', '#dedfe4'][gallery]} />
            <div className={styles.badges}><span>VERIFIED PRODUCT</span><small>Confirmation required</small></div>
            <button className={`${styles.save} ${saved ? styles.saved : ''}`} onClick={() => setSaved(!saved)} aria-label={saved ? 'Remove from saved items' : 'Save product'}>{saved ? '♥' : '♡'}</button>
          </div>
          <div className={styles.thumbnails}>{[product.tint, '#f2dfd6', '#dedfe4'].map((tint, index) => <button key={tint} className={gallery === index ? styles.activeThumb : ''} onClick={() => setGallery(index)} aria-label={`View product image ${index + 1}`}><ProductArt type={product.art} tint={tint} /></button>)}</div>
          <div className={styles.microProof}><span>✓ Product reviewed by Fendor</span><span>Communication stays on Fendor</span></div>
        </div>

        <div className={styles.details}>
          <div className={styles.brandRow}><Link href="#vendor">Brand: {product.vendor}</Link><span>SKU: FEN-{slug.slice(0, 8).toUpperCase()}</span></div>
          <h1>{product.name}</h1>
          <div className={styles.reviews}><span>★★★★★</span><b>4.8</b><a href="#reviews">Customer reviews</a></div>
          <div className={styles.confirmation}><b><i /> Confirmation required</b><span>Vendor checks current stock after your request</span></div>

          <div className={styles.benefits}><h2>PRODUCT HIGHLIGHTS</h2><ul><li><b>Verified listing:</b> reviewed before publication on Fendor.</li><li><b>Clear product details:</b> price and selected options are recorded with your request.</li><li><b>Protected communication:</b> order updates stay inside the Fendor process.</li><li><b>Flexible gifting:</b> choose packaging and add a recipient message.</li></ul></div>

          <fieldset className={styles.options}><legend>How should this be prepared?</legend><button type="button" className={gift === 'standard' ? styles.selectedOption : ''} onClick={() => setGift('standard')}><b>Standard order</b><small>Product only</small></button><button type="button" className={gift === 'gift' ? styles.selectedOption : ''} onClick={() => setGift('gift')}><b>Prepare as a gift</b><small>Packaging confirmed later</small></button></fieldset>
          {gift === 'gift' && <label className={styles.message}>Gift message <textarea value={message} maxLength={180} onChange={(event) => setMessage(event.target.value)} placeholder="Write a short message for the recipient" /><small>{message.length}/180 characters</small></label>}
          <div className={styles.quantity}><b>Quantity</b><div><button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity">−</button><span>{quantity}</span><button onClick={() => setQuantity(Math.min(10, quantity + 1))} aria-label="Increase quantity">+</button></div><small>Maximum 10 per order</small></div>
          <div className={styles.processNote}><b>What happens after you request?</b><span>Fendor sends the request to the vendor, confirms stock and preparation details, then gives you the offline-payment instructions.</span></div>
        </div>

        <aside className={styles.sidebar}>
          <section className={styles.vendorCard} id="vendor"><div className={styles.vendorTitle}><span>{product.vendor.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><div><small>VERIFIED VENDOR</small><h2>{product.vendor}</h2></div></div><div className={styles.vendorFacts}><span><b>Identity</b>Checked</span><span><b>Listings</b>Reviewed</span></div><Link href="/shop">Visit storefront</Link></section>
          <section className={styles.orderCard}><small>PRODUCT PRICE</small><div className={styles.price}><strong>₦{(unitPrice * quantity).toLocaleString()}</strong><del>₦{(oldUnitPrice * quantity).toLocaleString()}</del></div><p>Delivery and optional packaging are calculated after recipient details are confirmed.</p><button className={styles.secondaryAction} onClick={() => setNotice('Product added to your cart.')}>Add to cart</button><button className={styles.primaryAction} onClick={requestOrder}>Request to order</button><div className={styles.delivery}><h3>FULFILMENT</h3><p><b>Stock:</b> Confirmed by the vendor after request</p><p><b>Delivery:</b> Priced from the recipient’s location</p><p><b>Returns:</b> Reviewed under Fendor’s return policy</p></div></section>
        </aside>
      </section>

      <section className={styles.information}><article><h2>Product details</h2><p>This verified listing includes the product and quantity selected above. Final availability, packaging options, delivery fee, and delivery timeline are confirmed before payment.</p><dl><div><dt>Vendor</dt><dd>{product.vendor}</dd></div><div><dt>Category</dt><dd>Curated marketplace product</dd></div><div><dt>Order type</dt><dd>{gift === 'gift' ? 'Gift preparation requested' : 'Standard product order'}</dd></div></dl></article><article id="reviews"><h2>How reviews work</h2><p>Reviews are connected to completed Fendor orders. This helps customers understand the product and the vendor’s fulfilment quality.</p><div className={styles.reviewScore}><strong>4.8</strong><span>★★★★★<small>Customer rating</small></span></div></article></section>

      <section className={styles.related}><div><p className={home.kicker}>YOU MAY ALSO LIKE</p><h2>More from verified vendors</h2></div><div className={styles.relatedGrid}>{products.filter((item) => item.name !== product.name).slice(0, 4).map((item) => <ProductCard key={item.name} product={item} compact />)}</div></section>
    </main>
    <footer className={home.footer} id="support"><div className={`${home.shell} ${home.copyright}`}>© 2026 Fendor Marketplace. Product requests and communication stay within Fendor.</div></footer>
  </div>;
}
