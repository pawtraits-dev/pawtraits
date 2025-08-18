'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Heart, 
  Share2, 
  ShoppingCart, 
  Sparkles, 
  ArrowRight,
  ArrowLeft,
  Search,
  Filter
} from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import PublicNavigation from '@/components/PublicNavigation';
import { Input } from '@/components/ui/input';
import type { Breed, Theme, AnimalType } from '@/lib/types';

interface GalleryImage {
  id: string;
  filename: string;
  public_url: string;
  prompt_text: string;
  description: string;
  tags: string[];
  breed_id?: string;
  theme_id?: string;
  style_id?: string;
  format_id?: string;
  rating?: number;
  is_featured: boolean;
  created_at: string;
  breed?: {
    id: string;
    name: string;
    animal_type: string;
  };
  theme?: {
    id: string;
    name: string;
  };
  style?: {
    id: string;
    name: string;
  };
}

export default function CatsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBreed, setSelectedBreed] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  
  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadData();
    initializeFilters();
  }, []);

  useEffect(() => {
    loadCatImages();
  }, [searchTerm, selectedBreed, selectedTheme, featuredOnly]);

  const initializeFilters = () => {
    const breedParam = searchParams.get('breed');
    const themeParam = searchParams.get('theme');
    const searchParam = searchParams.get('search');
    const featuredParam = searchParams.get('featured');

    if (breedParam) setSelectedBreed(breedParam);
    if (themeParam) setSelectedTheme(themeParam);
    if (searchParam) setSearchTerm(searchParam);
    if (featuredParam === 'true') setFeaturedOnly(true);
  };

  const loadData = async () => {
    try {
      const [breedsData, themesData] = await Promise.all([
        supabaseService.getBreeds('cat'),
        supabaseService.getThemes()
      ]);
      setBreeds(breedsData);
      setThemes(themesData.filter(theme => theme.is_active));
    } catch (error) {
      console.error('Error loading filter data:', error);
    }
  };

  const updateUrlParams = (updates: { [key: string]: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    router.push(newUrl);
  };

  const loadCatImages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/gallery/images');
      if (response.ok) {
        const data = await response.json();
        // Filter for cat images only
        let catImages = (data.images || []).filter((img: GalleryImage) => 
          img.breed?.animal_type === 'cat' || 
          img.tags?.includes('cat')
        );

        // Apply search filter
        if (searchTerm) {
          catImages = catImages.filter((img: GalleryImage) =>
            img.prompt_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            img.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            img.breed?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            img.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
          );
        }

        // Apply breed filter
        if (selectedBreed) {
          catImages = catImages.filter((img: GalleryImage) => img.breed_id === selectedBreed);
        }

        // Apply theme filter
        if (selectedTheme) {
          catImages = catImages.filter((img: GalleryImage) => img.theme_id === selectedTheme);
        }

        // Apply featured filter
        if (featuredOnly) {
          catImages = catImages.filter((img: GalleryImage) => img.is_featured);
        }

        setImages(catImages);
      }
    } catch (error) {
      console.error('Error loading cat images:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <PublicNavigation />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              <span className="font-[family-name:var(--font-margarine)] text-purple-600">Cat</span> Portraits
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Honor your feline friend with elegant AI-generated portraits. From playful kittens to regal cats, 
              capture their independent spirit and mysterious charm.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Button 
                size="lg"
                onClick={() => router.push('/customer/shop')}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Heart className="w-5 h-5 mr-2" />
                Create Cat Portrait
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => router.push('/dogs')}
              >
                View Dog Portraits
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="py-8 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search cat images..."
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);
                    updateUrlParams({ search: value || null });
                  }}
                  className="pl-10"
                />
              </div>
              
              <select
                value={selectedBreed}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedBreed(value);
                  updateUrlParams({ breed: value || null });
                }}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">All Cat Breeds</option>
                {breeds.map(breed => (
                  <option key={breed.id} value={breed.id}>{breed.name}</option>
                ))}
              </select>
              
              <select
                value={selectedTheme}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedTheme(value);
                  updateUrlParams({ theme: value || null });
                }}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">All Themes</option>
                {themes.map(theme => (
                  <option key={theme.id} value={theme.id}>{theme.name}</option>
                ))}
              </select>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="featured"
                  checked={featuredOnly}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFeaturedOnly(checked);
                    updateUrlParams({ featured: checked ? 'true' : null });
                  }}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="featured" className="text-sm text-gray-700">Featured only</label>
              </div>
            </div>
            
            {(searchTerm || selectedBreed || selectedTheme || featuredOnly) && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600">Active filters:</span>
                {searchTerm && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Search: {searchTerm}
                    <button onClick={() => {
                      setSearchTerm('');
                      updateUrlParams({ search: null });
                    }} className="ml-1 hover:text-red-600">
                      ×
                    </button>
                  </Badge>
                )}
                {selectedBreed && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Breed: {breeds.find(b => b.id === selectedBreed)?.name}
                    <button onClick={() => {
                      setSelectedBreed('');
                      updateUrlParams({ breed: null });
                    }} className="ml-1 hover:text-red-600">
                      ×
                    </button>
                  </Badge>
                )}
                {selectedTheme && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Theme: {themes.find(t => t.id === selectedTheme)?.name}
                    <button onClick={() => {
                      setSelectedTheme('');
                      updateUrlParams({ theme: null });
                    }} className="ml-1 hover:text-red-600">
                      ×
                    </button>
                  </Badge>
                )}
                {featuredOnly && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Featured
                    <button onClick={() => {
                      setFeaturedOnly(false);
                      updateUrlParams({ featured: null });
                    }} className="ml-1 hover:text-red-600">
                      ×
                    </button>
                  </Badge>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedBreed('');
                    setSelectedTheme('');
                    setFeaturedOnly(false);
                    updateUrlParams({ search: null, breed: null, theme: null, featured: null });
                  }}
                  className="text-xs"
                >
                  Clear all
                </Button>
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-margarine)]">
              Elegant Cat Portraits
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Browse our collection of AI-generated cat portraits showcasing feline grace and beauty
            </p>
          </div>

          {images.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Cat portraits coming soon...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {images.map((image) => (
                <Card key={image.id} className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
                  <div className="relative aspect-square">
                    <CatalogImage
                      imageId={image.id}
                      alt={image.prompt_text}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {image.is_featured && (
                      <div className="absolute top-4 left-4">
                        <Badge className="bg-purple-100 text-purple-800">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Featured
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{image.prompt_text}</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-1">
                        {image.breed && (
                          <Badge variant="outline" className="text-xs">{image.breed.name}</Badge>
                        )}
                        {image.style && (
                          <Badge variant="outline" className="text-xs">{image.style.name}</Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <Heart className="w-4 h-4 text-gray-400 hover:text-red-500 transition-colors cursor-pointer" />
                        <Share2 className="w-4 h-4 text-gray-400 hover:text-blue-500 transition-colors cursor-pointer" />
                        <ShoppingCart className="w-4 h-4 text-gray-400 hover:text-green-500 transition-colors cursor-pointer" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <Button 
              size="lg"
              onClick={() => router.push('/customer/gallery')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              View All Portraits
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}