import type { Metadata } from 'next';
import { PREFS_COPY } from '@/lib/marketing/consent-copy';

export const metadata: Metadata = { title: PREFS_COPY.title, robots: { index: false, follow: false } };

export default function EmailPreferencesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
