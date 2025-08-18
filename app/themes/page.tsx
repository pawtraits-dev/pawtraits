'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Palette,
  Star,
  Search,
  Filter
} from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { getSupabaseClient } from '@/lib/supabase-client';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import PublicNavigation from '@/components/PublicNavigation';
import { Input } from '@/components/ui/input';
import type { Theme, ImageCatalogWithDetails, Breed, AnimalType } from '@/lib/types';
import type { Product, ProductPricing } from '@/lib/product-types';
import { formatPrice } from '@/lib/product-types';
import ProductSelectionModal from '@/components/ProductSelectionModal';
import ShareModal from '@/components/share-modal';
import UserInteractionsService from '@/lib/user-interactions';
import { useServerCart } from '@/lib/server-cart-context';
import { CountryProvider, useCountryPricing } from '@/lib/country-context';
import EnhancedHeroCarousel from '@/components/EnhancedHeroCarousel';
import ClickableMetadataTags from '@/components/clickable-metadata-tags';
import ImageModal from '@/components/ImageModal';
import { extractDescriptionTitle } from '@/lib/utils';

function ThemesPageContent() {
  const router = useRouter();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [images, setImages] = useState<ImageCatalogWithDetails[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnimalType, setSelectedAnimalType] = useState<AnimalType | ''>('');
  const [sortBy, setSortBy] = useState('name');
  
  const supabaseService = new SupabaseService();
  const { addToCart } = useServerCart();
  const { selectedCountry, selectedCountryData, getCountryPricing, getLowestPrice } = useCountryPricing();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [themesResponse, imagesResponse, productsResponse, pricingResponse] = await Promise.all([
        supabaseService.getThemes(),
        supabaseService.getImages(),
        supabaseService.getProducts(),
        supabaseService.getProductPricing()
      ]);

      setThemes(themesResponse || []);
      setImages(imagesResponse || []);
      setProducts(productsResponse || []);
      setPricing(pricingResponse || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const getImagesForTheme = (themeId: string) => {
    return images.filter(image => image.theme_id === themeId);
  };

  const getThemeProductInfo = (themeId: string) => {
    const themeImages = getImagesForTheme(themeId);
    let productCount = 0;
    let lowestPrice: number | null = null;

    themeImages.forEach(image => {
      const imageProducts = products.filter(p => p.image_catalog_id === image.id);
      productCount += imageProducts.length;
      
      imageProducts.forEach(product => {
        const productPricing = getCountryPricing(product.id, pricing);
        if (productPricing?.retail_price && (lowestPrice === null || productPricing.retail_price < lowestPrice)) {
          lowestPrice = productPricing.retail_price;
        }
      });
    });

    return {
      productCount,
      lowestPrice,
      currency: selectedCountryData?.currency || 'GBP',
      currencySymbol: selectedCountryData?.currency_symbol || '£'
    };
  };

  // Filter themes
  const filteredThemes = themes.filter(theme => {
    if (searchTerm && !theme.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !theme.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    if (selectedAnimalType && theme.animal_type !== selectedAnimalType && theme.animal_type !== 'both') {
      return false;
    }
    
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'popular':
        return getImagesForTheme(b.id).length - getImagesForTheme(a.id).length;
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return a.name.localeCompare(b.name);
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <PublicNavigation />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <PublicNavigation />

      {/* Hero Carousel Section */}
      <section className="relative">
        <EnhancedHeroCarousel 
          pageType="themes"
          className="h-[400px] md:h-[500px]"
          showControls={true}
        />
      </section>

      {/* Search and Filter Section */}
      <section className="py-8 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search themes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <select
                value={selectedAnimalType}
                onChange={(e) => setSelectedAnimalType(e.target.value as AnimalType | '')}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">All Animals</option>
                <option value="dog">Dogs</option>
                <option value="cat">Cats</option>
                <option value="both">Both</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="name">Sort by Name</option>
                <option value="popular">Most Popular</option>
                <option value="newest">Newest</option>
              </select>
            </div>

            {(searchTerm || selectedAnimalType) && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600">Active filters:</span>
                {searchTerm && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Search: {searchTerm}
                    <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-red-600">
                      ×
                    </button>
                  </Badge>
                )}
                {selectedAnimalType && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Animal: {selectedAnimalType === 'both' ? 'Dogs & Cats' : selectedAnimalType === 'dog' ? 'Dogs' : 'Cats'}
                    <button onClick={() => setSelectedAnimalType('')} className="ml-1 hover:text-red-600">
                      ×
                    </button>
                  </Badge>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedAnimalType('');
                  }}
                >
                  Clear all
                </Button>
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* Themes Gallery Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-life-savers)]">
              Available Themes
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose from our carefully curated collection of artistic themes and styles
            </p>
          </div>

          {filteredThemes.length === 0 ? (
            <div className="text-center py-12">
              <Palette className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">
                {themes.length === 0 ? 'Themes coming soon...' : 'No themes match your search criteria'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredThemes.map((theme) => {
                const imageCount = getImagesForTheme(theme.id).length;
                const themeProductInfo = getThemeProductInfo(theme.id);
                
                return (
                  <Card key={theme.id} className="group hover:shadow-lg transition-shadow overflow-hidden">
                    <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-purple-50 to-blue-50">
                      {/* Theme preview or placeholder */}
                      <div className="w-full h-full flex items-center justify-center">
                        <Palette className="w-16 h-16 text-purple-400" />
                      </div>
                      
                      {/* Animal type badge */}
                      <div className="absolute top-2 left-2">
                        <Badge variant="secondary" className="bg-white/90">
                          {theme.animal_type === 'both' ? 'Dogs & Cats' : 
                           theme.animal_type?.charAt(0).toUpperCase() + theme.animal_type?.slice(1) || 'Unknown'}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="p-4 space-y-3">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                        {theme.name}
                      </h3>
                      
                      {theme.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {theme.description}
                        </p>
                      )}

                      {/* Animal type tags */}
                      <div className="flex flex-wrap gap-2">
                        {(theme.animal_type === 'dog' || theme.animal_type === 'both') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => router.push(`/dogs?theme=${theme.id}`)}
                          >
                            Dogs
                          </Button>
                        )}
                        {(theme.animal_type === 'cat' || theme.animal_type === 'both') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => router.push(`/cats?theme=${theme.id}`)}
                          >
                            Cats
                          </Button>
                        )}
                      </div>
                      
                      <div className="pt-3 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm text-gray-600">
                            {imageCount > 0 ? (
                              <>
                                {imageCount} image{imageCount > 1 ? 's' : ''} from{' '}
                                {themeProductInfo.lowestPrice && themeProductInfo.currencySymbol ? 
                                  formatPrice(themeProductInfo.lowestPrice, themeProductInfo.currency || 'GBP', themeProductInfo.currencySymbol) : 
                                  '£9.99'
                                }
                              </>
                            ) : (
                              'Coming soon'
                            )}
                          </div>
                        </div>
                        
                        <Button 
                          className="w-full" 
                          size="sm"
                          onClick={() => {
                            // Navigate to dogs or cats page with theme filter, or both if theme supports both
                            const targetPage = theme.animal_type === 'cat' ? '/cats' : '/dogs';
                            router.push(`${targetPage}?theme=${theme.id}`);
                          }}
                          disabled={imageCount === 0}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          View Products
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function ThemesPage() {
  return (
    <CountryProvider>
      <ThemesPageContent />
    </CountryProvider>
  );
}