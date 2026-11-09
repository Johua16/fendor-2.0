import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN?.startsWith('https://') ? process.env.APP_ORIGIN : 'https://fendor-beta.netlify.app'),
  title: 'Fendora — Personalised gifting from approved Nigerian vendors',
  description: 'Choose an approved product, personalise the gift and follow stock confirmation, preparation and delivery through Fendora.',
  robots: { index: true, follow: true }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
