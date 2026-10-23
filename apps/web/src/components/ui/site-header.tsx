'use client';

import { useState, type FormEvent } from 'react';
import { Button } from './button';
import { Field } from './field';
import { DesignIcon } from './design-icon';

export const departments = ['Phones & Tablets', 'Electronics', 'Fashion', 'Home Living', 'Health & Beauty', 'Groceries', 'Footwear', 'Accessories', 'Computing', 'Kitchenware'];
const navigation = ['Phones & Tablets', 'Electronics', 'Fashion & Apparel', 'Home & Office', 'Health & Beauty', 'Groceries & Essentials', 'Baby & Kids', 'Sports & Outdoors', 'Computing', 'Handcrafted & Artisan'];

export function Brand({ footer = false }: { footer?: boolean }) {
  return <a className="brand" href="#top" aria-label="Fendor homepage"><DesignIcon section={footer ? '175-1737' : '174-1533'} index={0} /><span><strong>Fendor</strong><small>MARKETPLACE</small></span></a>;
}
export function SiteHeader({ cartCount, onSearch, onNotice }: { cartCount: number; onSearch: (query: string, department: string) => void; onNotice: (title: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSearch(String(data.get('query') || ''), String(data.get('department') || 'All'));
  }
  return <header className="site-header">
    <div className="utility-bar"><div className="page-width"><button onClick={() => onNotice('Help & Support')}>Help & Support</button><span aria-hidden="true">•</span><a href="#sell">Sell on Fendor</a></div></div>
    <div className="header-main page-width">
      <Brand />
      <form className="site-search" role="search" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="search-department">Search department</label>
        <select id="search-department" name="department" defaultValue="All"><option>All</option>{departments.map(item => <option key={item}>{item}</option>)}</select>
        <Field id="site-search" name="query" label="Search sample products" hideLabel placeholder="Search products, brands, or vendors..." type="search" />
        <Button type="submit" aria-label="Search sample products"><DesignIcon section="174-1533" index={2} /><span>Search</span></Button>
      </form>
      <div className="header-actions">
        <button className="account-button" onClick={() => onNotice('Account')}><span className="account-icon"><DesignIcon section="174-1533" index={3} /></span><span><small>Welcome</small><strong>Account <DesignIcon section="174-1533" index={4} /></strong></span></button>
        <button onClick={() => onNotice('Help & Support')}><DesignIcon section="174-1533" index={5} /><span>Help</span></button>
        <button aria-label={`Open sample cart with ${cartCount} items`} onClick={() => onNotice('Sample cart')}><span className="cart-icon"><DesignIcon section="174-1533" index={6} /><small>{cartCount}</small></span><span>Cart</span></button>
      </div>
      <Button className="mobile-menu-toggle" variant="quiet" aria-expanded={menuOpen} aria-controls="department-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close departments −' : 'Browse departments +'}</Button>
    </div>
    <nav className={`department-navigation ${menuOpen ? 'is-open' : ''}`} id="department-navigation" aria-label="Departments"><div className="page-width">{navigation.map((item, index) => <button key={item} onClick={() => { setMenuOpen(false); onSearch('', departments[index] || item); }}>{item}</button>)}</div></nav>
  </header>;
}
