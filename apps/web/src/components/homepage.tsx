'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { formatNaira, type getSampleHomepage, type SampleProduct } from '@/lib/api/homepage';
import { Badge, Feedback } from './ui/feedback';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Field } from './ui/field';
import { DesignIcon } from './ui/design-icon';
import { ProductCard } from './ui/product-card';
import { departments, SiteHeader } from './ui/site-header';
import { SiteFooter } from './ui/site-footer';

type HomepageData = ReturnType<typeof getSampleHomepage>;
type Panel = { kind: 'notice'; title: string } | { kind: 'product'; product: SampleProduct } | { kind: 'results'; query: string; department: string } | { kind: 'saved' } | null;

function SectionHeading({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children?: ReactNode }) {
  return <div className="section-heading"><div className="section-heading__title">{children}<div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>{action}</div>;
}
function TextAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="text-action" onClick={onClick}>{children}<DesignIcon section="174-530" index={7} /></button>;
}

export function Homepage({ data }: { data: HomepageData }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [cartIds, setCartIds] = useState<string[]>([]);
  const [recent, setRecent] = useState(data.recent);
  const [feedback, setFeedback] = useState('');
  const [newsletterFeedback, setNewsletterFeedback] = useState('');
  const allProducts = [...data.deals, ...data.popular, ...data.collections.flatMap(collection => collection.products), ...data.explore];
  const onView = (product: SampleProduct) => setPanel({ kind: 'product', product });
  const onNotice = (title: string) => setPanel({ kind: 'notice', title });
  const onSearch = (query = '', department = 'All') => setPanel({ kind: 'results', query, department });
  function onAdd(product: SampleProduct) {
    setCartIds(current => [...current, product.id]);
    setFeedback(`${product.name} added to the sample cart. Nothing is reserved or ordered.`);
  }
  function onSave(product: SampleProduct) {
    const saved = savedIds.includes(product.id);
    setSavedIds(current => saved ? current.filter(id => id !== product.id) : [...current, product.id]);
    setFeedback(`${product.name} ${saved ? 'removed from' : 'saved to'} your sample list. This list resets on reload.`);
  }
  function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewsletterFeedback('Newsletter signup is not connected yet. Your email has not been sent or saved.');
  }
  const productActions = { onView, onAdd };
  const results = panel?.kind === 'results' ? allProducts.filter(product =>
    (panel.department === 'All' || product.category === panel.department) &&
    `${product.name} ${product.vendor} ${product.category}`.toLowerCase().includes(panel.query.trim().toLowerCase())
  ) : panel?.kind === 'saved' ? allProducts.filter(product => savedIds.includes(product.id)) : [];
  const panelTitle = panel?.kind === 'product' ? panel.product.name : panel?.kind === 'results' ? 'Explore sample products' : panel?.kind === 'saved' ? 'Saved sample items' : panel?.title || '';

  return <div id="top">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="preview-banner" aria-label="Development preview">Design review · Sample products, prices, ratings and vendor claims · No live orders</aside>
    <SiteHeader cartCount={cartIds.length} onSearch={onSearch} onNotice={onNotice} />
    <main id="main-content" className="homepage page-width">
      <section className="hero" aria-labelledby="hero-title" data-figma-node="174:383">
        <div className="hero__surface"><div className="hero__copy"><h1 id="hero-title">Find Your Next Favourite Thing</h1><p>Explore a curated selection from local vendors across Nigeria. Discover crafts, electronics, and daily essentials in this marketplace preview.</p></div><img className="hero__image" src="/images/landing/174-383-0.png" alt="A potter shaping a clay bowl at a pottery wheel" fetchPriority="high" /></div>
        <div className="hero__indicators" aria-label="Single hero image; additional slides awaiting design"><DesignIcon section="174-383" index={2} /><DesignIcon section="174-383" index={1} /><DesignIcon section="174-383" index={3} /></div>
      </section>

      <section className="department-section" id="departments" aria-labelledby="department-title" data-figma-node="174:460">
        <div className="department-section__heading"><h2 id="department-title">Explore by department</h2><span>Explore the sample catalogue</span></div>
        <div className="department-grid">{departments.map((department, index) => <button key={department} onClick={() => onSearch('', department)}><span className="department-icon"><DesignIcon section="174-460" index={index} /></span><span>{department}</span></button>)}</div>
      </section>

      <section className="homepage-section deals-section" id="deals" aria-label="Sample deals" data-figma-node="174:530">
        <SectionHeading title="Deals Worth Discovering" description="Sample offers for design review; availability is not live." action={<div className="deals-actions"><span className="sample-timer"><DesignIcon section="174-530" index={6} /><span>DEMO TIMER:</span><strong>06h : 42m : 17s</strong></span><TextAction onClick={() => onSearch()}>View All Deals</TextAction></div>}><Badge>Flash window</Badge></SectionHeading>
        <div className="product-grid product-grid--six">{data.deals.map(product => <ProductCard key={product.id} product={product} variant="deal" saved={savedIds.includes(product.id)} onSave={onSave} {...productActions} />)}</div>
      </section>

      <section className="homepage-section popular-section" id="popular" aria-label="Popular sample products" data-figma-node="174:765">
        <SectionHeading title="Popular on Fendor" description="A sample selection from across the marketplace. Ratings are illustrative." action={<TextAction onClick={() => onSearch()}>View All Products</TextAction>} />
        <div className="product-grid">{data.popular.map(product => <ProductCard key={product.id} product={product} variant="popular" {...productActions} />)}</div>
      </section>

      <div className="collections" data-figma-node="174:869">{data.collections.map(collection => <section className="homepage-section collection-section" id={collection.id} key={collection.id} aria-label={`${collection.title} sample collection`}>
        <SectionHeading title={collection.title} description={collection.description} action={<TextAction onClick={() => onSearch('', collection.products[0].category)}>{collection.link}</TextAction>}><span className="collection-icon"><DesignIcon section="174-869" index={collection.icon} /></span></SectionHeading>
        <div className="product-grid">{collection.products.map(product => <ProductCard key={product.id} product={product} {...productActions} />)}</div>
      </section>)}</div>

      <section className="homepage-section vendor-section" id="vendors" aria-label="Sample vendors" data-figma-node="174:1116">
        <Badge tone="soft">Sample merchants</Badge>
        <SectionHeading title="Discover Our Vendors" description="Illustrative vendor profiles. Names, credentials and fulfilment figures are sample data." action={<TextAction onClick={() => onNotice('Vendor storefronts')}>Explore All Vendors</TextAction>} />
        <div className="vendor-grid">{data.vendors.map(vendor => <article className="vendor-card" key={vendor.name}><div className="vendor-card__heading"><span className="vendor-monogram">{vendor.initials}</span><div><h3>{vendor.name}<DesignIcon section="174-1116" index={13} /></h3><p>{vendor.description}</p></div></div><p className="vendor-card__credentials"><span>{vendor.badge}</span> · {vendor.fulfilled}</p><div className="vendor-card__images">{vendor.images.map((src, index) => <img key={src} src={src} alt={`${vendor.name} sample collection ${index + 1}`} loading="lazy" />)}</div><Button variant="quiet" size="compact" onClick={() => onNotice(`${vendor.name} storefront`)}>Visit Storefront</Button></article>)}</div>
      </section>

      <div className="discovery-grid" data-figma-node="174:1248">
        <section className="homepage-section recent-section" aria-labelledby="recent-title"><div className="section-heading"><h2 id="recent-title">Recently Viewed</h2><button className="quiet-text" onClick={() => { setRecent([]); setFeedback('Sample viewing history cleared.'); }} disabled={!recent.length}>Clear history</button></div>
          <div className="recent-list">{recent.length ? recent.map(product => <article key={product.id}><img src={product.image} alt="" loading="lazy" /><div><h3><button onClick={() => onView(product)}>{product.name}</button></h3><p>{product.vendor}</p><strong>{formatNaira(product.priceKobo)}</strong></div><Button size="compact" onClick={() => onView(product)}>View</Button></article>) : <Feedback>No recently viewed samples. Explore the collections above.</Feedback>}</div>
          <p className="recent-note">Sample history · not connected to an account<DesignIcon section="174-1248" index={6} /></p>
        </section>
        <section className="homepage-section explore-section" aria-label="More sample products"><SectionHeading title="More to Explore" description="A few more finds from our sample collection." action={<TextAction onClick={() => onSearch()}>View All Curations</TextAction>} /><div className="explore-grid">{data.explore.map(product => <article key={product.id}><button onClick={() => onView(product)}><img src={product.image} alt={product.name} loading="lazy" /><h3>{product.name}</h3><p>{product.vendor}</p><strong>{formatNaira(product.priceKobo)}</strong></button></article>)}</div><p className="explore-note"><DesignIcon section="174-1248" index={7} />Availability, pricing and fulfilment need confirmation before an order can proceed.</p></section>
      </div>

      <section className="homepage-section trust-section" id="trust" aria-labelledby="trust-title" data-figma-node="174:1398"><h2 id="trust-title">Why Shop on Fendor</h2><p className="trust-intro">A considered shopping experience, with Fendor coordinating each step.</p><div className="trust-grid">{[
        ['Vendor Review', 'Vendor applications require approval before approved vendor access is granted.'],
        ['Payment Verification', 'Initial payments are offline and verified by Fendor staff before preparation begins.'],
        ['Coordinated Fulfilment', 'Availability and delivery feasibility are checked before an order is confirmed.'],
        ['Support through Fendor', 'Fendor coordinates customer communication, vendors and delivery.'],
      ].map(([title, description], index) => <article key={title}><span className="trust-icon"><DesignIcon section="174-1398" index={index} /></span><h3>{title}</h3><p>{description}</p></article>)}</div></section>

      <section className="sell-section" id="sell" aria-labelledby="sell-title" data-figma-node="174:1344"><div><Badge tone="soft">Vendor applications · coming soon</Badge><h2 id="sell-title">Have Products to Sell? Meet Fendor.</h2><p>Connect with shoppers through Fendor. Our team coordinates customer communication, vendor availability and fulfilment.</p><div className="seller-steps"><div><strong>Apply</strong><span>Share your business</span></div><div><strong>Review</strong><span>Await a decision</span></div><div><strong>Prepare</strong><span>After verified payment</span></div></div><div className="seller-actions"><Button onClick={() => onNotice('Vendor application')}>Open Your Storefront</Button><Button variant="quiet" onClick={() => onNotice('Merchant guide')}>Merchant Guide</Button></div></div><aside><h3>Vendor review process</h3><ul>{['Business and identity details for review', 'Application status and requested changes', 'Approval before vendor access', 'Customer communication through Fendor'].map(item => <li key={item}><DesignIcon section="174-1344" index={0} />{item}</li>)}</ul></aside></section>

      <section className="newsletter-section" aria-labelledby="newsletter-title" data-figma-node="174:1442"><div><Badge>Curated updates</Badge><h2 id="newsletter-title">Stay in the Loop</h2><p>Discover curated collections, vendor stories, and marketplace updates.</p></div><form onSubmit={subscribe}><div className="newsletter-form"><Field id="newsletter-email" name="email" label="Email address" type="email" autoComplete="email" placeholder="Enter your email address..." hideLabel required aria-describedby="newsletter-note" /><Button type="submit">Subscribe</Button></div><p id="newsletter-note">Preview only. Newsletter signup is not connected.</p>{newsletterFeedback && <Feedback>{newsletterFeedback}</Feedback>}</form></section>
    </main>
    <SiteFooter onNotice={onNotice} onSaved={() => setPanel({ kind: 'saved' })} />
    {feedback && <div className="preview-toast"><Feedback>{feedback}</Feedback><button aria-label="Dismiss notification" onClick={() => setFeedback('')}>×</button></div>}
    {panel && <Dialog open title={panelTitle} onClose={() => setPanel(null)}>
      {panel?.kind === 'product' && <div className="product-preview"><img src={panel.product.image} alt={panel.product.name} /><div><Badge tone="soft">Sample product</Badge><p>{panel.product.vendor}</p><strong>{formatNaira(panel.product.priceKobo)}</strong><p>Illustrative catalogue data. Stock, price, vendor credentials and ratings are not verified. No order or reservation will be created.</p><Button onClick={() => onAdd(panel.product)}>Add to sample cart</Button><Button variant="quiet" onClick={() => onSave(panel.product)}>{savedIds.includes(panel.product.id) ? 'Unsave sample' : 'Save sample'}</Button><p role="status">{cartIds.filter(id => id === panel.product.id).length} in sample cart</p></div></div>}
      {(panel?.kind === 'results' || panel?.kind === 'saved') && <><p>Sample catalogue only. {panel.kind === 'results' && `${panel.department}${panel.query ? ` · “${panel.query}”` : ''}`} · {results.length} results</p>{results.length ? <div className="dialog-product-grid">{results.map(product => <ProductCard key={product.id} product={product} variant="popular" {...productActions} />)}</div> : <Feedback>No matching sample products. Try another department or search term.</Feedback>}</>}
      {panel?.kind === 'notice' && <>{panel.title === 'Sample cart' ? <><p>This temporary cart resets when you reload. Nothing is reserved, payable or ordered.</p>{cartIds.length ? <ul className="sample-cart-list">{[...new Set(cartIds)].map(id => { const product = allProducts.find(item => item.id === id)!; return <li key={id}><span>{product.name} × {cartIds.filter(item => item === id).length}</span><Button variant="quiet" onClick={() => setCartIds(current => current.filter(item => item !== id))}>Remove<span className="visually-hidden"> {product.name}</span></Button></li>; })}</ul> : <Feedback>Your sample cart is empty.</Feedback>}<p>Checkout is not available in this review.</p></> : <Feedback>{panel.title === 'Browse Products' ? 'The store is planned for /store. This first review covers the homepage; use Search to explore the sample catalogue.' : `${panel.title} is not connected in this homepage review. No account, application, message or payment has been submitted.`}</Feedback>}</>}
    </Dialog>}
  </div>;
}
