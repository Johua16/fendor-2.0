import type { Metadata } from 'next';
import { CustomerRemedyPage } from '../../../../components/customer/customer-remedy';

export const metadata: Metadata = { title: 'Cancellation and return review — Fendor', description: 'Request a reviewed cancellation or return for a paid Fendor order.' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <CustomerRemedyPage id={(await params).id} />; }
