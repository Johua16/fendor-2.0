import type { Metadata } from 'next';
import { SavedPage } from '../../components/customer/saved-page';

export const metadata: Metadata = { title: 'Saved products — Fendora', description: 'Return to products saved while browsing Fendora.' };
export default function Page() { return <SavedPage />; }
