import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search designs | Pawtraits',
  description: 'Find a Pawtrait by breed, occasion, team or anything in the picture.',
  robots: { index: false, follow: true },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
