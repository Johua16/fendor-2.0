import type { Metadata } from 'next';
import { StorefrontPage } from '../../components/customer/storefront-page';

export const metadata: Metadata = {
  title: 'Shop verified products — Fendor',
  description: 'Browse products from verified vendors on Fendor.',
};

export default function ShopPage() {
  return <StorefrontPage />;
}
