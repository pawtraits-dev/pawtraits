'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useHybridCart } from '@/lib/hybrid-cart-context';

/** Slim "what's in my basket" bar for the customise flow — lets shoppers keep adding, then check out. */
export default function BasketBar() {
  const { totalItems, totalPrice } = useHybridCart();
  if (!totalItems) return null;
  return (
    <Link href="/shop/checkout"
      className="flex h-11 items-center justify-between rounded-xl bg-purple-50 px-4 text-sm font-medium text-purple-900 ring-1 ring-purple-200">
      <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />{totalItems} in your basket · £{(totalPrice / 100).toFixed(2)}</span>
      <span className="font-semibold">Checkout →</span>
    </Link>
  );
}
