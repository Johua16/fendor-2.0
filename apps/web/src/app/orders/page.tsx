import type { Metadata } from 'next';
import { CustomerOrdersPage } from '../../components/customer/customer-orders';

export const metadata: Metadata = { title: 'Order requests — Fendor', description: 'Follow your Fendor availability requests and fulfilment progress.' };

export default function Page() { return <CustomerOrdersPage />; }
