'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Paths (prefix match) where the shared footer is not shown
const HIDDEN_PREFIXES = [
  '/admin',
  '/auth',
  '/signup',
  '/partners/', // trailing slash: the public /partners landing page keeps the footer
  '/api',
  '/stall',
  '/setup',
  '/shop/checkout',
  '/customer', // signed-in area with its own fixed bottom tab bar
];

const LINK_CLASS = 'text-gray-800 hover:text-purple-700';

export default function SiteFooter() {
  const pathname = usePathname() || '';

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  // The design page has a sticky bottom basket bar that would otherwise cover the footer
  const extraPadding = pathname.startsWith('/customise') ? ' pb-24' : '';

  return (
    <footer className={`border-t border-gray-200${extraPadding}`}>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-3 px-5 py-8 text-sm md:grid-cols-6">
        <Link href="/browse" className={LINK_CLASS}>Browse designs</Link>
        <Link href="/quiz/pawsonality" className={LINK_CLASS}>Pawsonality quiz</Link>
        <Link href="/help" className={LINK_CLASS}>Help &amp; delivery</Link>
        <Link href="/orders" className={LINK_CLASS}>My orders</Link>
        <Link href="/auth/login" className={LINK_CLASS}>Sign in</Link>
        <Link href="/partners" className={LINK_CLASS}>Become a partner</Link>
        <Link href="/signup/partner" className={LINK_CLASS}>Partner with us</Link>
        <Link href="/terms" className={LINK_CLASS}>Terms</Link>
        <Link href="/privacy" className={LINK_CLASS}>Privacy</Link>
        <a href="mailto:support@pawtraits.pics" className={LINK_CLASS}>support@pawtraits.pics</a>
        <p className="col-span-2 mt-2 text-gray-500 md:col-span-6">© {new Date().getFullYear()} Pawtraits</p>
      </div>
    </footer>
  );
}
