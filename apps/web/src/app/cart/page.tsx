import type { Metadata } from 'next';
import { CartPage } from '../../components/customer/cart-page';

export const metadata: Metadata = {
  title: 'My cart — Fendora',
  description: 'Review products from verified Fendora vendors before sending availability requests.',
};

export default function Page() {
  return <CartPage />;
}
