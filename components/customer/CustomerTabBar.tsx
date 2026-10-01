'use client';

/**
 * The customer's four places: Orders, My Pawtraits, Share & earn, Account.
 * Used by the customer drawer menu and as a fixed tab bar on phones
 * (customer layout, /orders and /account).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, Image as ImageIcon, Share2, User } from 'lucide-react';

export const CUSTOMER_NAV = [
  { name: 'Orders', href: '/orders', icon: Package, match: ['/orders', '/customer/orders', '/customer/downloads'] },
  { name: 'My Pawtraits', href: '/customer/gallery', icon: ImageIcon, match: ['/customer/gallery', '/customer/pets', '/customer/customize'] },
  { name: 'Share & earn', href: '/referrals', icon: Share2, match: ['/referrals'] },
  { name: 'Account', href: '/account', icon: User, match: ['/account', '/customer/inbox'] },
];

export const isActivePath = (pathname: string | null, match: string[]) =>
  !!pathname && match.some(m => pathname === m || pathname.startsWith(m + '/'));

export default function CustomerTabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="grid grid-cols-4">
        {CUSTOMER_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.match);
          return (
            <li key={item.name}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? 'text-purple-700' : 'text-gray-600'}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
