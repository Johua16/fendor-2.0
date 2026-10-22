import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Fendor — Development foundation',
  description: 'Shared development foundation for Fendor.',
  robots: { index: false, follow: false }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
