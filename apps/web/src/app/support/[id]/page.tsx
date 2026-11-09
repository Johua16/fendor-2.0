import type { Metadata } from 'next';
import { SupportConversationPage } from '../../../components/customer/customer-care';

export const metadata: Metadata = { title: 'Support conversation — Fendora', description: 'Continue a private conversation with Fendora support.' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <SupportConversationPage id={(await params).id} />; }
