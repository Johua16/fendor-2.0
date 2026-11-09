import type { Metadata } from 'next';
import { PolicyPage } from '@/components/customer/help-policy-page';
export const metadata: Metadata = { title: 'Vendor agreement — Fendora', description: 'Rules for approved vendors selling through the Fendora marketplace.' };
export default function Page(){return <PolicyPage kind="vendors"/>;}
