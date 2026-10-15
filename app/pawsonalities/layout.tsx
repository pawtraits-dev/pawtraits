import type { Metadata } from 'next';
import { CountryProvider } from '@/lib/country-context';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://pawtraits.pics'),
};

export default function PawsonalitiesLayout({ children }: { children: React.ReactNode }) {
  // The site header (UserAwareNavigation) needs the country context
  return <CountryProvider>{children}</CountryProvider>;
}
