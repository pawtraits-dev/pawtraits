import type { Metadata } from 'next';
import { CountryProvider } from '@/lib/country-context';

export const metadata: Metadata = {
  // Absolute URLs for link-preview images (opengraph-image) on result pages
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://pawtraits.pics'),
  title: "What's your pet's Pawsonality? | Pawtraits",
  description: '20 quick swipes, 16 possible types, one suspiciously accurate result — painted as a Pawtrait of your pet. Free, about 90 seconds, no sign-up.',
  openGraph: {
    title: "What's your pet's Pawsonality?",
    description: '20 quick swipes, 16 possible types, one suspiciously accurate result. Free, no sign-up.',
    type: 'website',
    locale: 'en_GB',
    siteName: 'Pawtraits',
  },
};

export default function PawsonalityLayout({ children }: { children: React.ReactNode }) {
  // The site header (UserAwareNavigation) needs the country context
  return <CountryProvider>{children}</CountryProvider>;
}
