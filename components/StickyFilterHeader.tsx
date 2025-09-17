'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useHybridCart } from '@/lib/hybrid-cart-context';

interface StickyFilterHeaderProps {
  // Search props
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearchSubmit: () => void;
  searchPlaceholder: string;
  
  // Filter props
  filters: Array<{
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string; }>;
    placeholder: string;
  }>;
  
  // Actions
  onClearFilters: () => void;
}

export default function StickyFilterHeader({
  searchTerm,
  onSearchTermChange,
  onSearchSubmit,
  searchPlaceholder,
  filters,
  onClearFilters
}: StickyFilterHeaderProps) {
  const [isSticky, setIsSticky] = useState(false);
  const { totalItems } = useHybridCart();

  useEffect(() => {
    const handleScroll = () => {
      // Make sticky when scrolled past the original header
      setIsSticky(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className={`transition-all duration-300 z-50 ${
        isSticky 
          ? 'fixed top-0 left-0 right-0 bg-white shadow-lg border-b' 
          : 'hidden'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Image 
              src="/assets/logos/paw-svgrepo-200x200-purple.svg" 
              alt="Pawtraits Logo" 
              width={24} 
              height={24} 
              className="w-6 h-6"
            />
            <span className="text-lg font-bold text-gray-900 font-[family-name:var(--font-life-savers)]">
              Pawtraits
            </span>
          </Link>

          {/* Search and Filters */}
          <div className="flex-1 max-w-4xl mx-8">
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => onSearchTermChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSearchSubmit();
                    }
                  }}
                  className="pl-10 h-9"
                />
              </div>
              
              {/* Filter Row */}
              {filters.length > 0 && (
                <div className={`grid gap-2 ${
                  filters.length === 2 ? 'grid-cols-3' : 'grid-cols-5'
                }`}>
                  {filters.map((filter, index) => (
                    <select
                      key={index}
                      value={filter.value}
                      onChange={(e) => filter.onChange(e.target.value)}
                      className="block w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="">{filter.placeholder}</option>
                      {filter.options.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ))}
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onClearFilters}
                    className="w-full text-sm h-8"
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Cart Icon */}
          <Link href="/shop/cart" className="relative">
            <ShoppingCart className="w-6 h-6 text-gray-700 hover:text-purple-600 transition-colors" />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}