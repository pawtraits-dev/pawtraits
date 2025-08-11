'use client';

import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServerCart } from '@/lib/server-cart-context';
import Link from 'next/link';

export default function CartIcon() {
  const { cart } = useServerCart();

  return (
    <Link href="/shop/cart">
      <Button variant="outline" className="relative">
        <ShoppingCart className="w-4 h-4" />
        {cart.totalItems > 0 && (
          <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {cart.totalItems > 99 ? '99+' : cart.totalItems}
          </span>
        )}
        <span className="ml-2 hidden sm:inline">
          Cart {cart.totalItems > 0 && `(${cart.totalItems})`}
        </span>
      </Button>
    </Link>
  );
}