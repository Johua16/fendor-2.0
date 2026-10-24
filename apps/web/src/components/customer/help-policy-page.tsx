import Link from 'next/link';
import { CustomerHeader } from './customer-orders';
import home from './home-page.module.css';
import styles from './help-policy-page.module.css';

type Section = { title: string; body: string; points?: string[] };

const policies: Record<string, { eyebrow: string; title: string; intro: string; sections: Section[] }> = {
  returns: { eyebrow: 'RETURNS & REMEDIES', title: 'When an order does not go as planned', intro: 'Fendor reviews return, replacement and refund requests against the product, payment and delivery record.', sections: [
    { title: 'Start with Fendor support', body: 'Open a support case from the affected order as soon as you notice a problem. Keep the product and packaging while the case is reviewed.' },
    { title: 'What we review', body: 'Eligibility depends on the order stage and evidence available.', points: ['Wrong, damaged or materially different product', 'Delivery evidence and timing', 'Whether the item has been used or altered', 'Vendor response and the protected Fendor order record'] },
    { title: 'Possible outcomes', body: 'Fendor may coordinate a correction, replacement, approved return, partial adjustment or refund. A refund is complete only after the financial record is confirmed.' },
  ] },
  privacy: { eyebrow: 'PRIVACY', title: 'How customer information moves through Fendor', intro: 'Fendor collects the information needed to create accounts, coordinate orders, deliver products and resolve support cases.', sections: [
    { title: 'Information we use', body: 'This may include account details, selected products, recipient information, delivery addresses, order communications and transaction records.' },
    { title: 'Vendor privacy boundary', body: 'Vendors receive only the information needed to confirm and prepare a product. Recipient phone numbers and street addresses remain with authorised Fendor operations and delivery workflows.' },
    { title: 'Your choices', body: 'You can request help with account information through Fendor support. Saved products in this MVP are held only in the current browser.' },
  ] },
  terms: { eyebrow: 'MARKETPLACE TERMS', title: 'The rules behind a Fendor order', intro: 'These service terms explain the marketplace flow in plain language while the final legal text is prepared for launch.', sections: [
    { title: 'Availability comes first', body: 'A cart or request does not guarantee stock. The vendor confirms the exact product and Fendor prepares the complete quote before payment.' },
    { title: 'Payment confirmation', body: 'Pay only through instructions shown or sent by Fendor. Screenshots and transfer alerts do not confirm an order; Fendor verifies the transaction against its financial records.' },
    { title: 'Protected communication', body: 'Customers and vendors must keep order communication within Fendor. Fendor may cancel or investigate activity that attempts to bypass this process.' },
  ] },
};

export function HelpPage() {
  return <div className={home.page}><CustomerHeader /><main className={`${home.shell} ${styles.main}`}><section className={styles.hero}><p className={home.kicker}>HELP CENTRE</p><h1>What do you need help with?</h1><p>Understand the Fendor order process or open a private support case linked to your account.</p><div><Link href="/support">Contact Fendor support</Link><Link href="/orders">Track an order</Link></div></section><div className={styles.cards}>{[
    ['Before payment', 'Stock, packaging, delivery and the full total are confirmed before Fendor opens payment.'], ['After payment', 'Your timeline shows preparation, dispatch, delivery attempts and completion.'], ['Order problem', 'Open a support case so Fendor can review the protected order record.'], ['Account access', 'Use password recovery from the sign-in page. Verification links are sent by email.'],
  ].map(([title, body]) => <article key={title}><h2>{title}</h2><p>{body}</p></article>)}</div><section className={styles.links}><h2>Policies and service rules</h2><Link href="/policies/returns">Returns and remedies <span>→</span></Link><Link href="/policies/privacy">Privacy <span>→</span></Link><Link href="/policies/terms">Marketplace terms <span>→</span></Link></section></main></div>;
}

export function PolicyPage({ kind }: { kind: keyof typeof policies }) {
  const policy = policies[kind];
  return <div className={home.page}><CustomerHeader /><main className={`${home.shell} ${styles.policy}`}><nav><Link href="/help">← Help centre</Link></nav><header><p className={home.kicker}>{policy.eyebrow}</p><h1>{policy.title}</h1><p>{policy.intro}</p><small>MVP service summary · Final launch wording requires Fendor’s legal approval.</small></header>{policy.sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p>{section.points && <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>}</section>)}<aside>Need help with a specific order? <Link href="/support">Contact Fendor support</Link>.</aside></main></div>;
}
