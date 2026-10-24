import type { Metadata } from 'next';
import { SavedPage } from '../../components/customer/saved-page';

export const metadata: Metadata = { title: 'Saved products — Fendor', description: 'Return to products saved while browsing Fendor.' };
export default function Page() { return <SavedPage />; }
