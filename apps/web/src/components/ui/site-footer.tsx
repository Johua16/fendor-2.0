import { Brand } from './site-header';
import { DesignIcon } from './design-icon';

export function SiteFooter({ onNotice, onSaved }: { onNotice: (title: string) => void; onSaved: () => void }) {
  const groups = [
    { title: 'Shopping', links: ['Browse Products', 'Categories', 'Featured Vendors', 'Saved Items'] },
    { title: 'Selling', links: ['Sell on Fendor', 'Vendor Hub', 'Merchant Standards'] },
    { title: 'Customer Care', links: ['Help Centre', 'Order Tracking', 'Contact Fendor'] },
    { title: 'Trust & Policies', links: ['Vendor Review', 'Payment Process', 'Privacy Policy', 'Terms'] },
  ];
  const anchors: Record<string, string> = { Categories: '#departments', 'Featured Vendors': '#vendors', 'Sell on Fendor': '#sell', 'Vendor Review': '#trust', 'Payment Process': '#trust' };
  return <footer className="site-footer"><div className="page-width">
    <div className="footer-grid"><div className="footer-intro"><Brand footer /><p>A marketplace connecting local vendors and shoppers, with Fendor coordinating customer communication.</p><span className="footer-review"><DesignIcon section="175-1737" index={1} />Development preview</span></div>
      {groups.map(group => <nav key={group.title} aria-label={group.title}><h2>{group.title}</h2><ul>{group.links.map(label => <li key={label}>{anchors[label] ? <a href={anchors[label]}>{label}</a> : <button onClick={() => label === 'Saved Items' ? onSaved() : onNotice(label)}>{label}</button>}</li>)}</ul></nav>)}
    </div>
    <p className="footer-copyright"><DesignIcon section="175-1737" index={2} />© 2026 Fendor Marketplace</p>
  </div></footer>;
}
