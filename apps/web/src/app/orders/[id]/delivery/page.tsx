import type { Metadata } from 'next';
import { CustomerDeliveryPage } from '../../../../components/customer/customer-delivery';

export const metadata: Metadata = { title: 'Delivery and tracking — Fendor', description: 'Manage private recipient delivery details and follow fulfilment updates.' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CustomerDeliveryPage id={(await params).id} />;
}
