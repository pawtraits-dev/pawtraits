import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Browse designs | Pawtraits',
};

export default function BrowseLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
