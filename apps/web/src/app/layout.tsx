import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Fendor — Thoughtful products from verified vendors',
  description: 'Discover gifts and everyday products from verified Nigerian vendors, coordinated through Fendor.',
  robots: { index: false, follow: false }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
