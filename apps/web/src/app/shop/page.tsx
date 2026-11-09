import type { Metadata } from 'next';
import { StorefrontPage } from '../../components/customer/storefront-page';

export const metadata: Metadata = {
  title: 'Shop verified products — Fendora',
  description: 'Browse approved vendor products on Fendora. Exact stock is confirmed before checkout.',
};

export default function ShopPage() {
  return <StorefrontPage />;
}
