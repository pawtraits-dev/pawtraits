'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Heart,
  Share2,
  ShoppingCart,
  Star,
  Sparkles,
  ArrowRight,
  Search,
  Filter,
  Dog,
  Cat,
  Palette
} from 'lucide-react';
import { SupabaseService } from '@/lib/supabase';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import PublicNavigation from '@/components/PublicNavigation';
import type { Breed, Theme, AnimalType, ImageCatalogWithDetails } from '@/lib/types';
import type { Product, ProductPricing } from '@/lib/product-types';
import { formatPrice } from '@/lib/product-types';
import ProductSelectionModal from '@/components/ProductSelectionModal';
import ShareModal from '@/components/share-modal';
import UserInteractionsService from '@/lib/user-interactions';
import { useServerCart } from '@/lib/server-cart-context';
import { CountryProvider, useCountryPricing } from '@/lib/country-context';
import ContentBasedCarousel from '@/components/ContentBasedCarousel';
import { PageType } from '@/lib/carousel-types';

type BrowseTab = 'dogs' | 'cats' | 'themes';

function BrowsePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get initial tab from URL params
  const getInitialTab = (): BrowseTab => {
    const typeParam = searchParams.get('type');
    if (typeParam === 'cats' || typeParam === 'themes') return typeParam;
    return 'dogs'; // default
  };

  const [activeTab, setActiveTab] = useState<BrowseTab>(getInitialTab);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [loading, setLoading] = useState(true);

  // Data states
  const [dogBreeds, setDogBreeds] = useState<Breed[]>([]);
  const [catBreeds, setCatBreeds] = useState<Breed[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [images, setImages] = useState<ImageCatalogWithDetails[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);

  // Modal states
  const [selectedImage, setSelectedImage] = useState<ImageCatalogWithDetails | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [imageToShare, setImageToShare] = useState<ImageCatalogWithDetails | null>(null);

  // Interaction states
  const [likedImages, setLikedImages] = useState<Set<string>>(new Set());
  const [sharedImages, setSharedImages] = useState<Set<string>>(new Set());
  const [purchasedImages, setPurchasedImages] = useState<Set<string>>(new Set());

  const supabaseService = new SupabaseService();
  const { addToCart } = useServerCart();
  const { selectedCountry, getCountryPricing } = useCountryPricing();

  useEffect(() => {
    loadData();
    loadUserInteractions();
  }, []);

  useEffect(() => {
    // Update URL when tab changes
    updateUrl();
  }, [activeTab, searchTerm]);

  const updateUrl = () => {
    const params = new URLSearchParams();
    if (activeTab !== 'dogs') params.set('type', activeTab);
    if (searchTerm) params.set('search', searchTerm);

    const newUrl = `/browse${params.toString() ? '?' + params.toString() : ''}`;
    router.push(newUrl, { scroll: false });
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const [breedsData, themesData, imagesData, productsData, pricingData] = await Promise.all([
        supabaseService.getBreeds(),
        supabaseService.getThemes(),
        fetch('/api/images?public=true').then(res => res.json()),
        supabaseService.getPublicProducts(),
        supabaseService.getPublicProductPricing()
      ]);

      // Separate dog and cat breeds
      const dogs = breedsData.filter(breed => breed.animal_type === 'dog');
      const cats = breedsData.filter(breed => breed.animal_type === 'cat');

      setDogBreeds(dogs);
      setCatBreeds(cats);
      setThemes(themesData.filter(theme => theme.is_active));
      setImages(imagesData.images || []);
      setProducts(productsData || []);
      setPricing(pricingData || []);
    } catch (error) {
      console.error('Error loading browse data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserInteractions = () => {
    const liked = UserInteractionsService.getLikedImageIds();
    const shared = UserInteractionsService.getSharedImageIds();
    const purchased = UserInteractionsService.getPurchasedImageIds();

    setLikedImages(new Set(liked));
    setSharedImages(new Set(shared));
    setPurchasedImages(new Set(purchased));
  };

  const getCarouselPageType = (): PageType => {
    switch (activeTab) {
      case 'dogs': return 'dogs';
      case 'cats': return 'cats';
      case 'themes': return 'themes';
      default: return 'dogs';
    }
  };

  const getFilteredBreeds = (breeds: Breed[]) => {
    if (!searchTerm) return breeds;

    return breeds.filter(breed =>
      breed.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      breed.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      breed.personality_traits?.some(trait =>
        trait.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  };

  const getFilteredThemes = () => {
    if (!searchTerm) return themes;

    return themes.filter(theme =>
      theme.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      theme.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getBreedImageCount = (breedId: string) => {
    return images.filter(img => img.breed_id === breedId).length;
  };

  const getThemeImageCount = (themeId: string) => {
    return images.filter(img => img.theme_id === themeId).length;
  };

  const getLowestPriceForBreed = (breedId: string) => {
    const breedImages = images.filter(img => img.breed_id === breedId);
    if (breedImages.length === 0) return null;

    const countryPricing = getCountryPricing(pricing);
    let lowestPrice = null;
    let currency = null;
    let currencySymbol = null;

    breedImages.forEach(image => {
      if (image.format_id) {
        const availableProducts = products.filter(p => p.is_active && p.format_id === image.format_id);
        availableProducts.forEach(product => {
          const productPricing = countryPricing.find(p => p.product_id === product.id);
          if (productPricing && (lowestPrice === null || productPricing.sale_price < lowestPrice)) {
            lowestPrice = productPricing.sale_price;
            currency = productPricing.currency_code;
            currencySymbol = productPricing.currency_symbol;
          }
        });
      }
    });

    return lowestPrice ? { lowestPrice, currency, currencySymbol } : null;
  };

  const handleTabChange = (tab: BrowseTab) => {
    setActiveTab(tab);
    // Scroll to top smoothly when changing tabs
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBreedClick = (breed: Breed) => {
    const animalType = breed.animal_type as AnimalType;
    router.push(`/browse?type=${animalType}s&breed=${breed.id}`);
  };

  const handleThemeClick = (theme: Theme, animalType?: 'dogs' | 'cats') => {
    const type = animalType || 'dogs';
    router.push(`/browse?type=${type}&theme=${theme.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <PublicNavigation />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  const currentBreeds = activeTab === 'dogs' ? getFilteredBreeds(dogBreeds) :
                      activeTab === 'cats' ? getFilteredBreeds(catBreeds) : [];
  const currentThemes = getFilteredThemes();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <PublicNavigation />

      {/* Hero Carousel - Dynamic based on active tab */}
      <section className="relative">
        <ContentBasedCarousel
          pageType={getCarouselPageType()}
          className="h-96 lg:h-[500px]"
        />
      </section>

      {/* Filter Tabs and Search */}
      <section className="py-8 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="flex bg-white rounded-lg p-1 shadow-lg">
              <Button
                variant={activeTab === 'dogs' ? 'default' : 'ghost'}
                onClick={() => handleTabChange('dogs')}
                className={`px-6 py-3 rounded-md transition-all ${
                  activeTab === 'dogs'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-700 hover:text-purple-600'
                }`}
              >
                <Dog className="w-5 h-5 mr-2" />
                Dogs ({dogBreeds.length})
              </Button>
              <Button
                variant={activeTab === 'cats' ? 'default' : 'ghost'}
                onClick={() => handleTabChange('cats')}
                className={`px-6 py-3 rounded-md transition-all ${
                  activeTab === 'cats'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-700 hover:text-purple-600'
                }`}
              >
                <Cat className="w-5 h-5 mr-2" />
                Cats ({catBreeds.length})
              </Button>
              <Button
                variant={activeTab === 'themes' ? 'default' : 'ghost'}
                onClick={() => handleTabChange('themes')}
                className={`px-6 py-3 rounded-md transition-all ${
                  activeTab === 'themes'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-700 hover:text-purple-600'
                }`}
              >
                <Palette className="w-5 h-5 mr-2" />
                Themes ({themes.length})
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 text-lg border-2 border-gray-200 focus:border-purple-500 rounded-xl"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                >
                  ×
                </Button>
              )}
            </div>

            {searchTerm && (
              <div className="mt-4 text-center">
                <Badge variant="secondary" className="text-sm">
                  Searching for: "{searchTerm}"
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchTerm('')}
                    className="ml-2 p-0 h-auto"
                  >
                    ×
                  </Button>
                </Badge>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Cards Grid Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-life-savers)]">
              {activeTab === 'dogs' && 'Popular Dog Breeds'}
              {activeTab === 'cats' && 'Popular Cat Breeds'}
              {activeTab === 'themes' && 'Artistic Themes'}
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {activeTab === 'dogs' && 'Discover beautiful AI-generated portraits for your favorite dog breeds'}
              {activeTab === 'cats' && 'Explore stunning AI-generated portraits for popular cat breeds'}
              {activeTab === 'themes' && 'Choose from our curated collection of artistic styles and themes'}
            </p>
          </div>

          {/* Breed Cards (Dogs/Cats) */}
          {(activeTab === 'dogs' || activeTab === 'cats') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {currentBreeds.map((breed) => {
                const imageCount = getBreedImageCount(breed.id);
                const priceInfo = getLowestPriceForBreed(breed.id);

                return (
                  <Card key={breed.id} className="group hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden">
                    <div
                      className="relative aspect-square overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50"
                      onClick={() => handleBreedClick(breed)}
                    >
                      {breed.hero_image_url ? (
                        <img
                          src={breed.hero_image_url}
                          alt={breed.hero_image_alt || `${breed.name} breed`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {activeTab === 'dogs' ? (
                            <Dog className="w-16 h-16 text-purple-400" />
                          ) : (
                            <Cat className="w-16 h-16 text-purple-400" />
                          )}
                        </div>
                      )}

                      {/* Hover overlay with stats */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300">
                        <div className="absolute bottom-4 left-4 right-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <p className="text-sm font-medium">{imageCount} portraits available</p>
                          {priceInfo && (
                            <p className="text-xs">From {formatPrice(priceInfo.lowestPrice, priceInfo.currency, priceInfo.currencySymbol)}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <CardContent className="p-4" onClick={() => handleBreedClick(breed)}>
                      <h3 className="font-semibold text-lg text-gray-900 mb-2">{breed.name}</h3>
                      {breed.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{breed.description}</p>
                      )}

                      {/* Personality traits */}
                      {breed.personality_traits && breed.personality_traits.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {breed.personality_traits.slice(0, 3).map((trait, index) => (
                            <Badge key={index} variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                              {trait}
                            </Badge>
                          ))}
                          {breed.personality_traits.length > 3 && (
                            <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
                              +{breed.personality_traits.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                      <Button
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        size="sm"
                        disabled={imageCount === 0}
                      >
                        View {breed.name} Portraits
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Theme Cards */}
          {activeTab === 'themes' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {currentThemes.map((theme) => {
                const imageCount = getThemeImageCount(theme.id);

                return (
                  <Card key={theme.id} className="group hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50">
                      {theme.hero_image_url ? (
                        <img
                          src={theme.hero_image_url}
                          alt={theme.hero_image_alt || `${theme.name} theme`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Palette className="w-16 h-16 text-purple-400" />
                        </div>
                      )}

                      {/* Theme style preview overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute bottom-4 left-4 right-4 text-white">
                          <div className="flex gap-2">
                            <Badge className="bg-white/20 text-white text-xs">Dogs</Badge>
                            <Badge className="bg-white/20 text-white text-xs">Cats</Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg text-gray-900 mb-2 flex items-center gap-2">
                        <Palette className="w-5 h-5 text-purple-600" />
                        {theme.name}
                      </h3>
                      {theme.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-4">{theme.description}</p>
                      )}

                      {/* Quick navigation buttons */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => handleThemeClick(theme, 'dogs')}
                          disabled={imageCount === 0}
                        >
                          🐕 Dogs
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => handleThemeClick(theme, 'cats')}
                          disabled={imageCount === 0}
                        >
                          🐱 Cats
                        </Button>
                      </div>

                      {imageCount > 0 && (
                        <p className="text-xs text-center text-gray-500 mt-2">
                          {imageCount} portrait{imageCount > 1 ? 's' : ''} available
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty states */}
          {(activeTab === 'dogs' || activeTab === 'cats') && currentBreeds.length === 0 && (
            <div className="text-center py-12">
              {activeTab === 'dogs' ? (
                <Dog className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              ) : (
                <Cat className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              )}
              <p className="text-gray-600">
                {searchTerm
                  ? `No ${activeTab} breeds match your search "${searchTerm}"`
                  : `${activeTab === 'dogs' ? 'Dog' : 'Cat'} breeds coming soon...`
                }
              </p>
              {searchTerm && (
                <Button
                  variant="outline"
                  onClick={() => setSearchTerm('')}
                  className="mt-4"
                >
                  Clear search
                </Button>
              )}
            </div>
          )}

          {activeTab === 'themes' && currentThemes.length === 0 && (
            <div className="text-center py-12">
              <Palette className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchTerm
                  ? `No themes match your search "${searchTerm}"`
                  : 'Themes coming soon...'
                }
              </p>
              {searchTerm && (
                <Button
                  variant="outline"
                  onClick={() => setSearchTerm('')}
                  className="mt-4"
                >
                  Clear search
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Modals */}
      {selectedImage && (
        <ProductSelectionModal
          isOpen={showProductModal}
          onClose={() => {
            setShowProductModal(false);
            setSelectedImage(null);
          }}
          image={selectedImage}
          products={products}
          pricing={pricing}
          onAddToBasket={() => {}} // TODO: implement
        />
      )}

      {imageToShare && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setImageToShare(null);
          }}
          image={imageToShare as any}
          onShare={() => {}} // TODO: implement
        />
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <CountryProvider>
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </div>
      }>
        <BrowsePageContent />
      </Suspense>
    </CountryProvider>
  );
}