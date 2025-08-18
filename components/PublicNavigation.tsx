'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  ShoppingCart, 
  Menu, 
  X,
  ChevronDown
} from 'lucide-react';
import Image from 'next/image';
import { SupabaseService } from '@/lib/supabase';

interface Breed {
  id: string;
  name: string;
  animal_type: string;
}

interface Theme {
  id: string;
  name: string;
  description: string;
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
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabaseService = new SupabaseService();

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
      const [allBreeds, themesData] = await Promise.all([
        supabaseService.getBreeds(),
        supabaseService.getThemes()
      ]);

      const dogs = allBreeds.filter(breed => breed.animal_type === 'dog').slice(0, 10);
      const cats = allBreeds.filter(breed => breed.animal_type === 'cat').slice(0, 10);
      
      setDogBreeds(dogs);
      setCatBreeds(cats);
      setThemes(themesData.filter(theme => theme.is_active).slice(0, 10));
    } catch (error) {
      console.error('Error loading navigation data:', error);
    } finally {
      setLoading(false);
    }
  };

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
      router.push(`${path}${queryString ? `?${queryString}` : ''}`);
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
              alt="PawTraits Logo" 
              width={32} 
              height={32} 
              className="w-8 h-8"
            />
            <span className="text-2xl font-bold text-gray-900 font-[family-name:var(--font-margarine)]">
              PawTraits
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8 font-[family-name:var(--font-margarine)] text-lg" ref={dropdownRef}>
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
                    onClick={() => handleDropdownClick('/dogs')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                  >
                    View All Dogs
                  </button>
                  {dogBreeds.map((breed) => (
                    <button
                      key={breed.id}
                      onClick={() => handleDropdownClick('/dogs', { breed: breed.id })}
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
                    onClick={() => handleDropdownClick('/cats')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                  >
                    View All Cats
                  </button>
                  {catBreeds.map((breed) => (
                    <button
                      key={breed.id}
                      onClick={() => handleDropdownClick('/cats', { breed: breed.id })}
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

            {/* Themes Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnter('themes')}
              onMouseLeave={handleMouseLeave}
            >
              <button className="flex items-center space-x-1 text-gray-700 hover:text-purple-600 transition-colors">
                <span>Themes</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {activeDropdown === 'themes' && !loading && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">Popular Themes</p>
                  </div>
                  <button
                    onClick={() => handleDropdownClick('/themes')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                  >
                    View All Themes
                  </button>
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => handleDropdownClick('/themes', { theme: theme.id })}
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                    >
                      {theme.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* About - Only show on home page */}
            {typeof window !== 'undefined' && (window.location.pathname === '/' || window.location.pathname === '') && (
              <button 
                onClick={() => scrollToSection('about')} 
                className="text-gray-700 hover:text-purple-600 transition-colors"
              >
                About
              </button>
            )}

            {/* Sign Up - Only show on home page */}
            {typeof window !== 'undefined' && (window.location.pathname === '/' || window.location.pathname === '') && (
              <button 
                onClick={() => scrollToSection('signup')} 
                className="text-gray-700 hover:text-purple-600 transition-colors"
              >
                Sign Up
              </button>
            )}

            <Link href="/cart" className="relative">
              <ShoppingCart className="w-6 h-6 text-gray-700 hover:text-purple-600 transition-colors" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1 font-[family-name:var(--font-margarine)]">
              <div className="space-y-2">
                <div className="px-3 py-2 font-medium text-gray-900">Dogs</div>
                <button
                  onClick={() => handleDropdownClick('/dogs')}
                  className="block w-full text-left px-6 py-1 text-gray-700 hover:text-purple-600"
                >
                  View All Dogs
                </button>
                {dogBreeds.slice(0, 5).map((breed) => (
                  <button
                    key={breed.id}
                    onClick={() => handleDropdownClick('/dogs', { breed: breed.id })}
                    className="block w-full text-left px-6 py-1 text-sm text-gray-600 hover:text-purple-600"
                  >
                    {breed.name}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <div className="px-3 py-2 font-medium text-gray-900">Cats</div>
                <button
                  onClick={() => handleDropdownClick('/cats')}
                  className="block w-full text-left px-6 py-1 text-gray-700 hover:text-purple-600"
                >
                  View All Cats
                </button>
                {catBreeds.slice(0, 5).map((breed) => (
                  <button
                    key={breed.id}
                    onClick={() => handleDropdownClick('/cats', { breed: breed.id })}
                    className="block w-full text-left px-6 py-1 text-sm text-gray-600 hover:text-purple-600"
                  >
                    {breed.name}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <div className="px-3 py-2 font-medium text-gray-900">Themes</div>
                <button
                  onClick={() => handleDropdownClick('/themes')}
                  className="block w-full text-left px-6 py-1 text-gray-700 hover:text-purple-600"
                >
                  View All Themes
                </button>
                {themes.slice(0, 5).map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => handleDropdownClick('/themes', { theme: theme.id })}
                    className="block w-full text-left px-6 py-1 text-sm text-gray-600 hover:text-purple-600"
                  >
                    {theme.name}
                  </button>
                ))}
              </div>

              <Link href="/cart" className="block px-3 py-2 text-gray-700 hover:text-purple-600">
                Basket
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}