import type { Metadata } from 'next';
import { HelpPage } from '../../components/customer/help-policy-page';
export const metadata: Metadata = { title: 'Help centre — Fendor', description: 'Get help with Fendor accounts, orders, payments and delivery.' };
export default function Page() { return <HelpPage />; }
