import type { Metadata } from 'next';
import { PolicyPage } from '@/components/customer/help-policy-page';
export const metadata: Metadata = { title: 'Refunds and cancellations — Fendora', description: 'Fendora cancellation, return, delivery-problem and refund rules.' };
export default function Page(){return <PolicyPage kind="refunds"/>;}
