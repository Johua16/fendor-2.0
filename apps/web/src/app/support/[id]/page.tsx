import type { Metadata } from 'next';
import { SupportConversationPage } from '../../../components/customer/customer-care';

export const metadata: Metadata = { title: 'Support conversation — Fendor', description: 'Continue a private conversation with Fendor support.' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <SupportConversationPage id={(await params).id} />; }
