'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  ShoppingCart, 
  Menu, 
  X,
  ChevronDown,
  Search
} from 'lucide-react';
import Image from 'next/image';
import { SupabaseService } from '@/lib/supabase';
import CountrySelector from '@/components/CountrySelector';
import { useHybridCart } from '@/lib/hybrid-cart-context';

interface Breed {
  id: string;
  name: string;
  animal_type: string;
}

interface NavCollection {
  id: string;
  path: string;
  name: string;
  kind: string;
  depth: number;
  designs: number;
  inSeason: boolean;
}

interface PublicNavigationProps {
  className?: string;
}

export default function PublicNavigation({ className = '' }: PublicNavigationProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dogBreeds, setDogBreeds] = useState<Breed[]>([]);
  const [catBreeds, setCatBreeds] = useState<Breed[]>([]);
  const [collections, setCollections] = useState<NavCollection[]>([]);
  const [loading, setLoading] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabaseService = new SupabaseService();
  const { totalItems } = useHybridCart();

  useEffect(() => {
    loadNavigationData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadNavigationData = async () => {
    try {
      const [allBreeds, withDesigns, collectionsData] = await Promise.all([
        supabaseService.getBreeds(),
        fetch('/api/public/breeds-with-designs').then(r => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/public/collections').then(r => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      // Only breeds that have designs (most designs first); everything if that list is unavailable
      const order: string[] | null = withDesigns?.breeds ? withDesigns.breeds.map((b: any) => b.id) : null;
      const visible = order
        ? allBreeds.filter(b => order.includes(b.id)).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
        : allBreeds;
      const dogs = visible.filter(breed => breed.animal_type === 'dog').slice(0, 10);
      const cats = visible.filter(breed => breed.animal_type === 'cat').slice(0, 10);
      
      setDogBreeds(dogs);
      setCatBreeds(cats);
      // Collections that have designs (themes are behind the scenes now: collections-plan phase 3)
      setCollections(((collectionsData?.collections ?? []) as NavCollection[]).filter(c => c.designs > 0));
    } catch (error) {
      console.error('Error loading navigation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const inSeason = collections.filter(c => c.kind === 'occasion' && c.depth === 1 && c.inSeason).slice(0, 2);
  const topCollections = collections.filter(c => c.depth === 0);

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  const handleMouseEnter = (dropdown: string) => {
    setActiveDropdown(dropdown);
  };

  const handleMouseLeave = () => {
    // Add a small delay to prevent flickering
    setTimeout(() => {
      setActiveDropdown(null);
    }, 100);
  };

  const handleDropdownClick = (path: string, params?: { breed?: string; theme?: string }) => {
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.breed) searchParams.set('breed', params.breed);
      if (params.theme) searchParams.set('theme', params.theme);
      const queryString = searchParams.toString();
      router.push(`${path}${queryString ? `${path.includes('?') ? '&' : '?'}${queryString}` : ''}`);
    } else {
      router.push(path);
    }
    setActiveDropdown(null);
    setMobileMenuOpen(false);
  };

  return (
    <nav className={`bg-white shadow-sm sticky top-0 z-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Image 
              src="/assets/logos/paw-svgrepo-200x200-purple.svg" 
              alt="Pawtraits Logo" 
              width={32} 
              height={32} 
              className="w-8 h-8"
            />
            <span className="text-2xl font-bold text-gray-900 font-[family-name:var(--font-life-savers)]">
              Pawtraits
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8 font-[family-name:var(--font-life-savers)] text-lg" ref={dropdownRef}>
            {/* Dogs Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnter('dogs')}
              onMouseLeave={handleMouseLeave}
            >
              <button className="flex items-center space-x-1 text-gray-700 hover:text-purple-600 transition-colors">
                <span>Dogs</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {activeDropdown === 'dogs' && !loading && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">Popular Dog Breeds</p>
                  </div>
                  <button
                    onClick={() => handleDropdownClick('/browse?type=dogs')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                  >
                    View All Dogs
                  </button>
                  {dogBreeds.map((breed) => (
                    <button
                      key={breed.id}
                      onClick={() => handleDropdownClick('/browse?type=dogs&breed=' + breed.id)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                    >
                      {breed.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cats Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnter('cats')}
              onMouseLeave={handleMouseLeave}
            >
              <button className="flex items-center space-x-1 text-gray-700 hover:text-purple-600 transition-colors">
                <span>Cats</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {activeDropdown === 'cats' && !loading && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">Popular Cat Breeds</p>
                  </div>
                  <button
                    onClick={() => handleDropdownClick('/browse?type=cats')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                  >
                    View All Cats
                  </button>
                  {catBreeds.map((breed) => (
                    <button
                      key={breed.id}
                      onClick={() => handleDropdownClick('/browse?type=cats&breed=' + breed.id)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                    >
                      {breed.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reviews - Only show on home page */}
            {typeof window !== 'undefined' && (window.location.pathname === '/' || window.location.pathname === '') && (
              <button 
                onClick={() => scrollToSection('reviews')} 
                className="text-gray-700 hover:text-purple-600 transition-colors"
              >
                Reviews
              </button>
            )}

            {/* Collections Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnter('collections')}
              onMouseLeave={handleMouseLeave}
            >
              <button className="flex items-center space-x-1 text-gray-700 hover:text-purple-600 transition-colors" onClick={() => handleDropdownClick('/collections')}>
                <span>Collections</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {activeDropdown === 'collections' && !loading && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  {inSeason.length > 0 && (
                    <div className="border-b border-gray-100 pb-1">
                      <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-purple-700">In season</p>
                      {inSeason.map(c => (
                        <button key={c.id} onClick={() => handleDropdownClick(`/collections/${c.path}`)}
                          className="w-full text-left px-4 py-2 text-sm font-medium text-gray-800 hover:bg-purple-50 hover:text-purple-600 transition-colors">{c.name}</button>
                      ))}
                    </div>
                  )}
                  {topCollections.map(c => (
                    <button key={c.id} onClick={() => handleDropdownClick(`/collections/${c.path}`)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors">{c.name}</button>
                  ))}
                  <button onClick={() => handleDropdownClick('/collections')}
                    className="w-full text-left px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 transition-colors">All collections</button>
                </div>
              )}
            </div>

            <Link href="/mugs" className="text-gray-700 hover:text-purple-600 transition-colors">Mugs</Link>

            <Link href="/search" aria-label="Search designs" className="text-gray-700 hover:text-purple-600 transition-colors">
              <Search className="w-5 h-5" />
            </Link>


            {/* Sign Up - Only show on home page */}
            {typeof window !== 'undefined' && (window.location.pathname === '/' || window.location.pathname === '') && (
              <button 
                onClick={() => scrollToSection('signup')} 
                className="text-gray-700 hover:text-purple-600 transition-colors"
              >
                Sign Up
              </button>
            )}

            <CountrySelector
              compact={true}
              showLabel={false}
              showDefault={false}
              className="mr-4"
            />

            <Link href="/shop/cart" className="relative" aria-label={`Basket${totalItems ? `, ${totalItems} item${totalItems === 1 ? "" : "s"}` : ""}`}>
              <ShoppingCart className="w-6 h-6 text-gray-700 hover:text-purple-600 transition-colors" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1 font-[family-name:var(--font-life-savers)]">
              <Link href="/browse" onClick={() => setMobileMenuOpen(false)}
                className="mx-1 mb-2 flex h-12 items-center justify-center rounded-xl bg-purple-600 font-sans font-semibold text-white">
                Make my pet&apos;s Pawtrait
              </Link>
              <div className="space-y-2">
                <div className="px-3 py-2 font-medium text-gray-900">Dogs</div>
                <button
                  onClick={() => handleDropdownClick('/browse?type=dogs')}
                  className="block w-full text-left px-6 py-1 text-gray-700 hover:text-purple-600"
                >
                  View All Dogs
                </button>
                {dogBreeds.slice(0, 5).map((breed) => (
                  <button
                    key={breed.id}
                    onClick={() => handleDropdownClick('/browse?type=dogs', { breed: breed.id })}
                    className="block w-full text-left px-6 py-1 text-sm text-gray-600 hover:text-purple-600"
                  >
                    {breed.name}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <div className="px-3 py-2 font-medium text-gray-900">Cats</div>
                <button
                  onClick={() => handleDropdownClick('/browse?type=cats')}
                  className="block w-full text-left px-6 py-1 text-gray-700 hover:text-purple-600"
                >
                  View All Cats
                </button>
                {catBreeds.slice(0, 5).map((breed) => (
                  <button
                    key={breed.id}
                    onClick={() => handleDropdownClick('/browse?type=cats', { breed: breed.id })}
                    className="block w-full text-left px-6 py-1 text-sm text-gray-600 hover:text-purple-600"
                  >
                    {breed.name}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <div className="px-3 py-2 font-medium text-gray-900">Collections</div>
                {[...inSeason, ...topCollections].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleDropdownClick(`/collections/${c.path}`)}
                    className="block w-full text-left px-6 py-1 text-sm text-gray-600 hover:text-purple-600"
                  >
                    {c.name}{c.inSeason && c.depth > 0 ? ' · in season' : ''}
                  </button>
                ))}
                <button
                  onClick={() => handleDropdownClick('/collections')}
                  className="block w-full text-left px-6 py-1 text-gray-700 hover:text-purple-600"
                >
                  All collections
                </button>
              </div>

              <Link href="/mugs" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-gray-700 hover:text-purple-600">Zodiac mugs</Link>
              <Link href="/search" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-purple-600">
                <Search className="h-4 w-4" /> Search designs
              </Link>

              <Link href="/shop/cart" className="relative block px-3 py-2 text-gray-700 hover:text-purple-600">
                <div className="flex items-center">
                  Basket
                  {totalItems > 0 && (
                    <span className="ml-2 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {totalItems > 99 ? '99+' : totalItems}
                    </span>
                  )}
                </div>
              </Link>
              <Link href="/orders" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-gray-700 hover:text-purple-600">My orders</Link>
              <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-gray-700 hover:text-purple-600">Sign in</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}