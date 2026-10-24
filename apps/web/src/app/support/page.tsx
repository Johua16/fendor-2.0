import type { Metadata } from 'next';
import { CustomerCarePage } from '../../components/customer/customer-care';

export const metadata: Metadata = { title: 'Customer care — Fendor', description: 'View Fendor notifications and contact customer support.' };
export default function Page() { return <CustomerCarePage />; }
