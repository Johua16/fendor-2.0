import type { Metadata } from 'next';
import { CustomerOrderDetailPage } from '../../../components/customer/customer-orders';

export const metadata: Metadata = { title: 'Order request — Fendora', description: 'Review a Fendora order request and save gift details.' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CustomerOrderDetailPage id={(await params).id} />;
}
