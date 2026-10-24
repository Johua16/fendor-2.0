import type { Metadata } from 'next';
import { CustomerCheckoutPage } from '../../../../components/customer/customer-checkout';

export const metadata: Metadata = { title: 'Review quote — Fendor', description: 'Review and accept the complete Fendor order quote.' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CustomerCheckoutPage id={(await params).id} />;
}
