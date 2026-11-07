import type { Metadata } from 'next';
import { PolicyPage } from '../../../components/customer/help-policy-page';
export const metadata: Metadata = { title: 'Privacy — Fendora' };
export default function Page() { return <PolicyPage kind="privacy" />; }
