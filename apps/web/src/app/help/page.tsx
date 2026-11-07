import type { Metadata } from 'next';
import { HelpPage } from '../../components/customer/help-policy-page';
export const metadata: Metadata = { title: 'Help centre — Fendora', description: 'Get help with Fendora accounts, orders, payments and delivery.' };
export default function Page() { return <HelpPage />; }
