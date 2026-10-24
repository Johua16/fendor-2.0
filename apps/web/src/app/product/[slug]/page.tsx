import type { Metadata } from 'next';
import { ProductDetailPage } from '../../../components/customer/product-detail-page';

export const metadata: Metadata = {
  title: 'Product details — Fendor',
  description: 'Review product, vendor, personalisation, and fulfilment information on Fendor.',
};

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetailPage slug={slug} />;
}
