import type { Metadata } from 'next';
import { CustomerCarePage } from '../../components/customer/customer-care';

export const metadata: Metadata = { title: 'Customer care — Fendora', description: 'View Fendora notifications and contact customer support.' };
export default function Page() { return <CustomerCarePage />; }
