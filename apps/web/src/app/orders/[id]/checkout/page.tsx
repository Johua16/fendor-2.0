import type { Metadata } from 'next';
import { CustomerCheckoutPage } from '../../../../components/customer/customer-checkout';

export const metadata: Metadata = { title: 'Review quote — Fendora', description: 'Review and accept the complete Fendora order quote.' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CustomerCheckoutPage id={(await params).id} />;
}
