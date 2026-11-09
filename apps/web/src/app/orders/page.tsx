import type { Metadata } from 'next';
import { CustomerOrdersPage } from '../../components/customer/customer-orders';

export const metadata: Metadata = { title: 'Order requests — Fendora', description: 'Follow your Fendora availability requests and fulfilment progress.' };

export default function Page() { return <CustomerOrdersPage />; }
