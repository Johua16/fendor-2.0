import type { Metadata } from 'next';
import { CartPage } from '../../components/customer/cart-page';

export const metadata: Metadata = {
  title: 'My cart — Fendor',
  description: 'Review products from verified Fendor vendors before sending availability requests.',
};

export default function Page() {
  return <CartPage />;
}
