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
  ArrowLeft,
  Search,
  Filter,
  Dog,
  Cat,
  Palette,
  QrCode,
  Wand2,
  Camera
} from 'lucide-react';
// Import SupabaseService for authentication checking
import { SupabaseService } from '@/lib/supabase';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import type { Breed, Theme, AnimalType, ImageCatalogWithDetails, UserProfile } from '@/lib/types';
import type { Product, ProductPricing } from '@/lib/product-types';
import { formatPrice } from '@/lib/product-types';
import ShareModal from '@/components/share-modal';
import PartnerQRModal from '@/components/PartnerQRModal';
import UserInteractionsService from '@/lib/user-interactions';
import { useHybridCart } from '@/lib/hybrid-cart-context';
import { CountryProvider, useCountryPricing } from '@/lib/country-context';
import { useUserRouting } from '@/hooks/use-user-routing';
import ContentBasedCarousel from '@/components/ContentBasedCarousel';
import { PageType } from '@/lib/carousel-types';
import ReactMarkdown from 'react-markdown';
import { DigitalDownloadButton } from '@/components/DigitalDownloadButton';

type BrowseTab = 'all' | 'dogs' | 'cats' | 'themes';

// Simple in-memory cache to prevent rate limiting
const dataCache = {
  breeds: null as Breed[] | null,
  themes: null as Theme[] | null,
  images: null as any | null,
  products: null as Product[] | null,
  pricing: null as ProductPricing[] | null,
  lastCacheTime: 0,
  cacheTimeout: 10000 // 10 seconds (reduced from 60s for faster updates)
};

function BrowsePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get initial tab from URL params
  const getInitialTab = (): BrowseTab => {
    const typeParam = searchParams.get('type');
    if (typeParam === 'dogs' || typeParam === 'cats' || typeParam === 'themes') return typeParam as BrowseTab;
    return 'all'; // default to show all breeds
  };

  const [activeTab, setActiveTab] = useState<BrowseTab>(getInitialTab);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedBreedId, setSelectedBreedId] = useState(searchParams.get('breed') || '');
  const [selectedThemeId, setSelectedThemeId] = useState(searchParams.get('theme') || '');
  const [loading, setLoading] = useState(true);

  // Theme-specific filtering when viewing a specific theme
  const [themeAnimalFilter, setThemeAnimalFilter] = useState<'all' | 'dogs' | 'cats'>('all');
  const [themeBreedSearch, setThemeBreedSearch] = useState('');

  // Data states
  const [dogBreeds, setDogBreeds] = useState<Breed[]>([]);
  const [catBreeds, setCatBreeds] = useState<Breed[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [images, setImages] = useState<ImageCatalogWithDetails[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);

  // Modal states
  const [showShareModal, setShowShareModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [imageToShare, setImageToShare] = useState<ImageCatalogWithDetails | null>(null);
  const [imageForQR, setImageForQR] = useState<ImageCatalogWithDetails | null>(null);

  // Authentication and user states
  const { userProfile, userLoading } = useUserRouting();
  const [partnerInfo, setPartnerInfo] = useState<any>(null);

  // Interaction states
  const [likedImages, setLikedImages] = useState<Set<string>>(new Set());
  const [sharedImages, setSharedImages] = useState<Set<string>>(new Set());
  const [purchasedImages, setPurchasedImages] = useState<Set<string>>(new Set());

  const { addToCart } = useHybridCart();
  const { selectedCountry, getCountryPricing } = useCountryPricing();

  useEffect(() => {
    loadData();
    loadUserInteractions();
  }, []);

  // Load partner info when user is authenticated and is a partner
  useEffect(() => {
    const loadPartnerInfo = async () => {
      if (userProfile?.user_type === 'partner') {
        try {
          const supabaseService = new SupabaseService();
          const partnerData = await supabaseService.getCurrentPartner();
          setPartnerInfo(partnerData);
        } catch (error) {
          console.error('Error loading partner info:', error);
        }
      }
    };

    if (!userLoading && userProfile) {
      loadPartnerInfo();
    }
  }, [userProfile, userLoading]);

  // Listen for URL parameter changes and update state
  useEffect(() => {
    const newTab = getInitialTab();
    const newSearch = searchParams.get('search') || '';
    const newBreed = searchParams.get('breed') || '';
    const newTheme = searchParams.get('theme') || '';

    setActiveTab(newTab);
    setSearchTerm(newSearch);
    setSelectedBreedId(newBreed);
    setSelectedThemeId(newTheme);
  }, [searchParams]);

  useEffect(() => {
    // Update URL when tab changes (but prevent infinite loop)
    updateUrl();
  }, [activeTab, searchTerm, selectedBreedId, selectedThemeId]);

  const updateUrl = () => {
    const params = new URLSearchParams();
    if (activeTab !== 'all') params.set('type', activeTab);
    if (searchTerm) params.set('search', searchTerm);
    if (selectedBreedId) params.set('breed', selectedBreedId);
    if (selectedThemeId) params.set('theme', selectedThemeId);

    const newUrl = `/browse${params.toString() ? '?' + params.toString() : ''}`;
    const currentUrl = window.location.pathname + window.location.search;

    // Only push if URL is actually different
    if (newUrl !== currentUrl) {
      router.push(newUrl, { scroll: false });
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Check if cache is valid
      const now = Date.now();
      const cacheIsValid = dataCache.lastCacheTime > 0 &&
        (now - dataCache.lastCacheTime) < dataCache.cacheTimeout &&
        dataCache.breeds && dataCache.themes && dataCache.images &&
        dataCache.products && dataCache.pricing;

      if (cacheIsValid) {
        // Use cached data
        const dogs = dataCache.breeds!.filter(breed => breed.animal_type === 'dog').sort((a, b) => a.name.localeCompare(b.name));
        const cats = dataCache.breeds!.filter(breed => breed.animal_type === 'cat').sort((a, b) => a.name.localeCompare(b.name));

        setDogBreeds(dogs);
        setCatBreeds(cats);
        setThemes(dataCache.themes!.filter(theme => theme.is_active).sort((a, b) => a.name.localeCompare(b.name)));
        setImages(dataCache.images!.images || []);
        setProducts(dataCache.products! || []);
        setPricing(dataCache.pricing! || []);
      } else {
        // Fetch data via API endpoints with individual error handling
        console.log('Fetching fresh data from API endpoints...');

        // Fetch breeds with fallback
        let breedsData = [];
        try {
          const breedsResponse = await fetch('/api/public/breeds');
          if (breedsResponse.ok) {
            breedsData = await breedsResponse.json();
          } else {
            console.warn('Breeds API failed, using empty array');
          }
        } catch (error) {
          console.warn('Breeds API error, using empty array:', error);
        }

        // Fetch themes with fallback
        let themesData = [];
        try {
          const themesResponse = await fetch('/api/public/themes');
          if (themesResponse.ok) {
            themesData = await themesResponse.json();
          } else {
            console.warn('Themes API failed, using empty array');
          }
        } catch (error) {
          console.warn('Themes API error, using empty array:', error);
        }

        // Fetch other data that usually works
        const [imagesData, productsData, pricingData] = await Promise.all([
          fetch('/api/images?public=true&limit=1000').then(res => res.json()),
          fetch('/api/public/products').then(res => res.json()),
          fetch('/api/public/pricing').then(res => res.json())
        ]);

        console.log('[BROWSE] Images loaded:', {
          totalImages: imagesData?.images?.length || 0,
          publicImages: imagesData?.images?.filter((img: any) => img.is_public !== false).length || 0,
          recentImages: imagesData?.images?.slice(0, 5).map((img: any) => ({
            id: img.id.substring(0, 8),
            description: img.description?.substring(0, 30),
            is_public: img.is_public,
            created_at: img.created_at
          }))
        });

        // Cache the data
        dataCache.breeds = breedsData;
        dataCache.themes = themesData;
        dataCache.images = imagesData;
        dataCache.products = productsData;
        dataCache.pricing = pricingData;
        dataCache.lastCacheTime = now;

        // Separate dog and cat breeds and sort alphabetically
        const dogs = (breedsData || []).filter(breed => breed.animal_type === 'dog').sort((a, b) => a.name.localeCompare(b.name));
        const cats = (breedsData || []).filter(breed => breed.animal_type === 'cat').sort((a, b) => a.name.localeCompare(b.name));

        setDogBreeds(dogs);
        setCatBreeds(cats);
        setThemes((themesData || []).filter(theme => theme.is_active).sort((a, b) => a.name.localeCompare(b.name)));
        setImages(imagesData.images || []);
        setProducts(productsData || []);
        setPricing(pricingData || []);
      }
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

  const handleLike = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    const isNowLiked = UserInteractionsService.toggleLikeSync(imageId, image);

    setLikedImages(prev => {
      const newLiked = new Set(prev);
      if (isNowLiked) {
        newLiked.add(imageId);
      } else {
        newLiked.delete(imageId);
      }
      return newLiked;
    });
  };

  const handleShare = (image: ImageCatalogWithDetails) => {
    setImageToShare(image);
    setShowShareModal(true);
  };

  const handleShareComplete = (platform: string) => {
    if (imageToShare) {
      UserInteractionsService.recordShare(imageToShare.id, platform, imageToShare);
      setSharedImages(prev => new Set(prev).add(imageToShare.id));
    }
    setShowShareModal(false);
    setImageToShare(null);
  };

  const handleQRShare = (image: ImageCatalogWithDetails) => {
    setImageForQR(image);
    setShowQRModal(true);
  };

  const handleCustomize = (image: ImageCatalogWithDetails) => {
    // Check if user is authenticated and is a customer
    if (!userProfile || userProfile.user_type !== 'customer') {
      router.push('/signup/user');
      return;
    }
    // Navigate to customise page instead of opening modal
    router.push(`/customise/${image.id}`);
  };

  const getCarouselPageType = (): PageType => {
    switch (activeTab) {
      case 'dogs': return 'dogs';
      case 'cats': return 'cats';
      case 'themes': return 'themes';
      case 'all':
      default: return 'dogs'; // Default carousel for 'all' tab
    }
  };

  const getFilteredBreeds = (breeds: Breed[]) => {
    if (!searchTerm) return breeds;

    return breeds.filter(breed =>
      breed.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getFilteredThemes = () => {
    if (!searchTerm) return themes;

    return themes.filter(theme =>
      theme.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getBreedImageCount = (breedId: string) => {
    return images.filter(img => {
      // Check primary breed_id
      if (img.breed_id === breedId) return true;

      // Check subjects in generation_parameters
      const subjects = img.generation_parameters?.subjects || [];
      return subjects.some((subject: any) => subject.breedId === breedId);
    }).length;
  };

  const getThemeImageCount = (themeId: string) => {
    return images.filter(img => img.theme_id === themeId).length;
  };

  const getThemeDogImageCount = (themeId: string) => {
    return images.filter(img => {
      if (img.theme_id !== themeId) return false;

      // Check primary breed
      if (dogBreeds.some(breed => breed.id === img.breed_id)) return true;

      // Check subjects in generation_parameters
      const subjects = img.generation_parameters?.subjects || [];
      return subjects.some((subject: any) =>
        dogBreeds.some(breed => breed.id === subject.breedId)
      );
    }).length;
  };

  const getThemeCatImageCount = (themeId: string) => {
    return images.filter(img => {
      if (img.theme_id !== themeId) return false;

      // Check primary breed
      if (catBreeds.some(breed => breed.id === img.breed_id)) return true;

      // Check subjects in generation_parameters
      const subjects = img.generation_parameters?.subjects || [];
      return subjects.some((subject: any) =>
        catBreeds.some(breed => breed.id === subject.breedId)
      );
    }).length;
  };

  const getLowestPriceForBreed = (breedId: string) => {
    const breedImages = images.filter(img => {
      // Check primary breed_id
      if (img.breed_id === breedId) return true;

      // Check subjects in generation_parameters
      const subjects = img.generation_parameters?.subjects || [];
      return subjects.some((subject: any) => subject.breedId === breedId);
    });
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

  const getSelectedBreed = () => {
    if (!selectedBreedId) return null;
    const allBreeds = [...dogBreeds, ...catBreeds];
    return allBreeds.find(breed => breed.id === selectedBreedId) || null;
  };

  const getSelectedTheme = () => {
    if (!selectedThemeId) return null;
    return themes.find(theme => theme.id === selectedThemeId) || null;
  };

  const getFilteredImages = () => {
    let filteredImages = [...images];

    // Filter by breed - check both primary breed_id AND subjects array
    if (selectedBreedId) {
      filteredImages = filteredImages.filter(img => {
        // Check primary breed_id
        if (img.breed_id === selectedBreedId) return true;

        // Check subjects in generation_parameters
        const subjects = img.generation_parameters?.subjects || [];
        return subjects.some((subject: any) => subject.breedId === selectedBreedId);
      });
    }

    // Filter by theme
    if (selectedThemeId) {
      filteredImages = filteredImages.filter(img => img.theme_id === selectedThemeId);

      // Additional theme-specific filtering
      if (themeAnimalFilter !== 'all') {
        const animalType = themeAnimalFilter === 'dogs' ? 'dog' : 'cat';
        filteredImages = filteredImages.filter(img =>
          img.breed?.animal_type === animalType ||
          img.tags?.includes(animalType) ||
          (!img.breed?.animal_type && !img.tags?.includes('cat') && animalType === 'dog')
        );
      }

      // Theme breed search
      if (themeBreedSearch) {
        filteredImages = filteredImages.filter(img =>
          img.breed_name?.toLowerCase().includes(themeBreedSearch.toLowerCase())
        );
      }
    }

    // Filter by animal type based on active tab (if no specific breed/theme selected)
    if (!selectedBreedId && !selectedThemeId && activeTab !== 'themes') {
      const animalType = activeTab === 'dogs' ? 'dog' : 'cat';
      filteredImages = filteredImages.filter(img =>
        img.breed?.animal_type === animalType ||
        img.tags?.includes(animalType) ||
        (!img.breed?.animal_type && !img.tags?.includes('cat') && animalType === 'dog') // Default to dog if unclear
      );
    }

    // Filter by color/coat search when in breed view
    if (selectedBreedId && searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredImages = filteredImages.filter(img => {
        // Search in description (which often contains color information)
        const descriptionMatch = img.description?.toLowerCase().includes(searchLower);

        // Search in coat color/name if available
        const coatMatch = img.coat?.coat_name?.toLowerCase().includes(searchLower) ||
                         img.coat?.color?.toLowerCase().includes(searchLower);

        // Search in image tags if available
        const tagsMatch = img.tags?.some(tag => tag.toLowerCase().includes(searchLower));

        // Search in breed name as well
        const breedMatch = img.breed_name?.toLowerCase().includes(searchLower);

        return descriptionMatch || coatMatch || tagsMatch || breedMatch;
      });
    }

    return filteredImages;
  };

  const handleTabChange = (tab: BrowseTab) => {
    setActiveTab(tab);
    // Clear breed/theme selection when switching tabs
    setSelectedBreedId('');
    setSelectedThemeId('');
    // Clear theme-specific filters
    setThemeAnimalFilter('all');
    setThemeBreedSearch('');
    // Scroll to top smoothly when changing tabs
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBreedClick = (breed: Breed) => {
    const animalType = breed.animal_type as AnimalType;
    setActiveTab(animalType === 'dog' ? 'dogs' : 'cats');
    setSelectedBreedId(breed.id);
    setSelectedThemeId(''); // Clear theme selection
    setSearchTerm(''); // Clear search when selecting specific breed
    // Scroll to top smoothly when viewing breed pawtraits
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleThemeClick = (theme: Theme, animalType?: 'dogs' | 'cats') => {
    const type = animalType || 'dogs';
    setActiveTab(type);
    setSelectedThemeId(theme.id);
    setSelectedBreedId(''); // Clear breed selection
    setSearchTerm(''); // Clear search when selecting specific theme
    // Scroll to top smoothly when viewing theme pawtraits
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToBrowse = () => {
    setSelectedBreedId('');
    setSelectedThemeId('');
    setSearchTerm('');
    // Clear theme-specific filters
    setThemeAnimalFilter('all');
    setThemeBreedSearch('');
  };

  const getImageProductInfo = (imageId: string) => {
    const image = images.find(img => img.id === imageId);

    if (!image || !image.format_id) {
      return { productCount: 0, lowestPrice: null, currency: null, currencySymbol: null };
    }

    const availableProducts = (products || []).filter(p =>
      p.is_active && p.format_id === image.format_id
    );

    if (availableProducts.length === 0) {
      return { productCount: 0, lowestPrice: null, currency: null, currencySymbol: null };
    }

    const countryPricing = getCountryPricing(pricing || []).filter(p =>
      availableProducts.some(product => product.id === p.product_id)
    );

    if (countryPricing.length === 0) {
      return { productCount: availableProducts.length, lowestPrice: null, currency: null, currencySymbol: null };
    }

    const lowestPricing = countryPricing.reduce((lowest, current) =>
      current.sale_price < lowest.sale_price ? current : lowest
    );

    return {
      productCount: availableProducts.length,
      lowestPrice: lowestPricing.sale_price,
      currency: lowestPricing.currency_code,
      currencySymbol: lowestPricing.currency_symbol
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <UserAwareNavigation />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  const currentBreeds = activeTab === 'dogs' ? getFilteredBreeds(dogBreeds) :
                      activeTab === 'cats' ? getFilteredBreeds(catBreeds) :
                      activeTab === 'all' ? getFilteredBreeds([...dogBreeds, ...catBreeds].sort((a, b) => a.name.localeCompare(b.name))) : [];
  const currentThemes = getFilteredThemes();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <UserAwareNavigation />

      {/* Breed/Theme Detail View OR Browse View */}
      {selectedBreedId || selectedThemeId ? (
        // Detailed breed/theme view with filtered images
        <>
          {/* Breed/Theme Header */}
          <section className="py-8 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6">
                <Button
                  onClick={handleBackToBrowse}
                  variant="outline"
                  className="mb-4"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Browse
                </Button>

                {/* Breed Description */}
                {selectedBreedId && (() => {
                  const selectedBreed = getSelectedBreed();
                  if (!selectedBreed) return null;

                  return (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
                      <div className="flex flex-col lg:flex-row gap-6">
                        {selectedBreed.hero_image_url && (
                          <div className="lg:w-1/3 flex-shrink-0">
                            <img
                              src={selectedBreed.hero_image_url}
                              alt={selectedBreed.hero_image_alt || `${selectedBreed.name} hero image`}
                              className="w-full aspect-square object-cover bg-gray-50 rounded-lg shadow-md"
                            />
                          </div>
                        )}

                        <div className="flex-1">
                          <h1 className="text-3xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            {selectedBreed.animal_type === 'dog' ? '🐕' : '🐱'} {selectedBreed.name}
                          </h1>
                          {selectedBreed.description && (
                            <div className="text-gray-700 text-lg leading-relaxed prose prose-gray max-w-none mb-4">
                              <ReactMarkdown>{selectedBreed.description}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Theme Description */}
                {selectedThemeId && (() => {
                  const selectedTheme = getSelectedTheme();
                  if (!selectedTheme) return null;

                  return (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
                      <div className="flex flex-col lg:flex-row gap-6">
                        {selectedTheme.hero_image_url && (
                          <div className="lg:w-1/3 flex-shrink-0">
                            <img
                              src={selectedTheme.hero_image_url}
                              alt={selectedTheme.hero_image_alt || `${selectedTheme.name} theme hero image`}
                              className="w-full aspect-square object-cover rounded-lg shadow-md"
                            />
                          </div>
                        )}

                        <div className="flex-1">
                          <h1 className="text-3xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            🎨 {selectedTheme.name}
                          </h1>
                          {selectedTheme.description && (
                            <div className="text-gray-700 text-lg leading-relaxed prose prose-gray max-w-none mb-4">
                              <ReactMarkdown>{selectedTheme.description}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </section>

          {/* Filtered Images Grid */}
          <section className="py-8 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Available Portraits ({getFilteredImages().length})
              </h2>

              {/* Breed and Theme-specific filtering controls */}
              {(selectedBreedId || selectedThemeId) && (
                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Theme-specific Animal Type Filter */}
                    {selectedThemeId && (
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Animal Type
                        </label>
                        <div className="flex gap-2">
                          <Button
                            variant={themeAnimalFilter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setThemeAnimalFilter('all')}
                          >
                            All
                          </Button>
                          <Button
                            variant={themeAnimalFilter === 'dogs' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setThemeAnimalFilter('dogs')}
                          >
                            <Dog className="w-4 h-4 mr-1" />
                            Dogs
                          </Button>
                          <Button
                            variant={themeAnimalFilter === 'cats' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setThemeAnimalFilter('cats')}
                          >
                            <Cat className="w-4 h-4 mr-1" />
                            Cats
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Breed/Color Search */}
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {selectedThemeId ? 'Search Breeds' : 'Search by Color or Coat'}
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input
                          type="text"
                          placeholder={
                            selectedThemeId
                              ? "What breed are we looking for?"
                              : "Search by color or coat (e.g., golden, fluffy, spotted)..."
                          }
                          value={selectedThemeId ? themeBreedSearch : searchTerm}
                          onChange={(e) => selectedThemeId ? setThemeBreedSearch(e.target.value) : setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Clear Filters */}
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedThemeId) {
                            setThemeAnimalFilter('all');
                            setThemeBreedSearch('');
                          } else {
                            setSearchTerm('');
                          }
                        }}
                        disabled={selectedThemeId ? (themeAnimalFilter === 'all' && !themeBreedSearch) : !searchTerm}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {getFilteredImages().length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 text-gray-300 mx-auto mb-4">🖼️</div>
                  <p className="text-gray-600">
                    {selectedBreedId ? 'This breed is still in the art studio! Try another one or check back soon.' : 'This theme is still being perfected! Try another style or check back soon.'}
                  </p>
                  <p className="text-gray-500 text-sm mt-2">Fresh pawtraits are added regularly - your perfect match is coming!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {getFilteredImages().map((image) => {
                    const isLiked = likedImages.has(image.id);
                    const isShared = sharedImages.has(image.id);
                    const isPurchased = purchasedImages.has(image.id);
                    const productInfo = getImageProductInfo(image.id);

                    return (
                      <Card key={image.id} className="group hover:shadow-lg transition-shadow overflow-hidden">
                        <div
                          className="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer"
                          onClick={() => router.push(`/shop/${image.id}`)}
                        >
                          <CatalogImage
                            imageId={image.id}
                            alt={image.description || 'Generated image'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            fallbackUrl={image.image_url || image.public_url}
                          />

                          {/* Like, Share, Customize, and Purchase status overlay */}
                          <div className="absolute top-2 right-2 flex flex-col gap-2">
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLike(image.id);
                                }}
                                className={`p-2 rounded-full transition-all ${
                                  isLiked
                                    ? 'bg-red-500 text-white'
                                    : 'bg-white bg-opacity-80 text-gray-700 hover:bg-red-500 hover:text-white'
                                }`}
                                title={isLiked ? 'Unlike' : 'Like'}
                              >
                                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShare(image);
                                }}
                                className={`p-2 rounded-full transition-all ${
                                  isShared
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white bg-opacity-80 text-gray-700 hover:bg-blue-500 hover:text-white'
                                }`}
                                title={isShared ? 'Shared' : 'Share'}
                              >
                                <Share2 className="w-4 h-4" />
                              </button>

                              {/* Partner QR Code Sharing Button */}
                              {userProfile?.user_type === 'partner' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQRShare(image);
                                  }}
                                  className="p-2 rounded-full transition-all bg-white bg-opacity-80 text-gray-700 hover:bg-green-500 hover:text-white"
                                  title="Generate QR Code for Client"
                                >
                                  <QrCode className="w-4 h-4" />
                                </button>
                              )}

                              {isPurchased && (
                                <div className="bg-green-500 text-white p-2 rounded-full" title="Purchased">
                                  <ShoppingCart className="w-4 h-4 fill-current" />
                                </div>
                              )}
                            </div>

                            {/* Customize Button - Visible to All, Redirects Non-Customers to Sign Up */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCustomize(image);
                              }}
                              className="p-2 rounded-full transition-all bg-purple-600 text-white hover:bg-purple-700 shadow-lg"
                              title="Customize this image"
                            >
                              <Wand2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                      <CardContent className="p-4">
                        {image.description && (
                          <p className="text-sm text-gray-900 font-medium line-clamp-2 mb-2">
                            {image.description.split('\n')[0].replace(/\*\*(.*?)\*\*/g, '$1')}
                          </p>
                        )}

                        <div className="space-y-1 mb-3">
                          {image.breed_name && image.breed_id && (
                            <div>
                              <Badge
                                variant="secondary"
                                className="text-xs cursor-pointer hover:bg-blue-200 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBreedId(image.breed_id);
                                  setSelectedThemeId('');
                                  setSearchTerm('');
                                }}
                              >
                                {image.breed_name}
                              </Badge>
                            </div>
                          )}
                          {image.theme_name && image.theme_id && (
                            <div>
                              <Badge
                                variant="secondary"
                                className="text-xs cursor-pointer hover:bg-purple-200 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedThemeId(image.theme_id);
                                  setSelectedBreedId('');
                                  setSearchTerm('');
                                  setActiveTab('themes');
                                }}
                              >
                                {image.theme_name}
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* Country-aware pricing */}
                        {productInfo.lowestPrice && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-green-600">
                              from {formatPrice(productInfo.lowestPrice, productInfo.currency || 'GBP', productInfo.currencySymbol)}
                            </p>
                            {productInfo.productCount > 1 && (
                              <p className="text-xs text-gray-500">
                                {productInfo.productCount} size{productInfo.productCount > 1 ? 's' : ''} available
                              </p>
                            )}
                          </div>
                        )}

                        <div className="space-y-2">
                          <Button
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/create?id=${image.id}`);
                            }}
                          >
                            <Camera className="w-4 h-4 mr-2" />
                            Put My Pet in This Pic
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/shop/${image.id}`);
                            }}
                          >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            View & Buy
                          </Button>
                          <DigitalDownloadButton
                            imageId={image.id}
                            imageUrl={image.public_url || image.image_url || ''}
                            imageTitle={image.description?.split('\n')[0].replace(/\*\*(.*?)\*\*/g, '$1') || 'Pet Portrait'}
                            className="w-full"
                            variant="outline"
                          />
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        // Browse view with carousel and cards
        <>
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
                    variant={activeTab === 'all' ? 'default' : 'ghost'}
                    onClick={() => handleTabChange('all')}
                    className={`px-6 py-3 rounded-md transition-all ${
                      activeTab === 'all'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-gray-700 hover:text-purple-600'
                    }`}
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    All ({dogBreeds.length + catBreeds.length})
                  </Button>
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

        {/* Cards Grid Section (default browse view) */}
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">


          {/* Breed Cards (All/Dogs/Cats) */}
          {(activeTab === 'all' || activeTab === 'dogs' || activeTab === 'cats') && (
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
                          {breed.animal_type === 'dog' ? (
                            <Dog className="w-16 h-16 text-purple-400" />
                          ) : (
                            <Cat className="w-16 h-16 text-purple-400" />
                          )}
                        </div>
                      )}

                      {/* Animal type badge for 'all' tab */}
                      {activeTab === 'all' && (
                        <div className="absolute top-2 left-2">
                          <Badge
                            variant="secondary"
                            className="bg-white/90 text-gray-700 text-xs"
                          >
                            {breed.animal_type === 'dog' ? '🐕 Dog' : '🐱 Cat'}
                          </Badge>
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
                        <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                          {(() => {
                            const match = breed.description.match(/\*\*(.*?)\*\*/);
                            return match ? match[1] : breed.description;
                          })()}
                        </p>
                      )}

                      <Button
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        size="sm"
                        disabled={imageCount === 0}
                      >
                        View {imageCount} Pawtraits
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
                const dogImageCount = getThemeDogImageCount(theme.id);
                const catImageCount = getThemeCatImageCount(theme.id);

                return (
                  <Card key={theme.id} className="group hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <div
                      className="relative aspect-square overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 cursor-pointer"
                      onClick={() => handleThemeClick(theme)}
                    >
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
                    </div>

                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg text-gray-900 mb-2">{theme.name}</h3>
                      {theme.description && (
                        <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                          {(() => {
                            const match = theme.description.match(/\*\*(.*?)\*\*/);
                            return match ? match[1] : theme.description;
                          })()}
                        </p>
                      )}

                      {/* Quick navigation buttons */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 text-xs bg-purple-600 hover:bg-purple-700"
                          onClick={() => handleThemeClick(theme, 'dogs')}
                          disabled={dogImageCount === 0}
                        >
                          View {dogImageCount} Dogs
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 text-xs bg-purple-600 hover:bg-purple-700"
                          onClick={() => handleThemeClick(theme, 'cats')}
                          disabled={catImageCount === 0}
                        >
                          View {catImageCount} Cats
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty states */}
          {(activeTab === 'all' || activeTab === 'dogs' || activeTab === 'cats') && currentBreeds.length === 0 && (
            <div className="text-center py-12">
              {activeTab === 'all' ? (
                <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              ) : activeTab === 'dogs' ? (
                <Dog className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              ) : (
                <Cat className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              )}
              <p className="text-gray-600">
                {searchTerm
                  ? `No ${activeTab === 'all' ? 'pet' : activeTab} breeds match your search "${searchTerm}"`
                  : activeTab === 'all' ? 'Pet breeds coming soon...' : `${activeTab === 'dogs' ? 'Dog' : 'Cat'} breeds coming soon...`
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
        </>
      )}

      {/* Modals */}
      {imageToShare && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setImageToShare(null);
          }}
          image={imageToShare as any}
          onShare={handleShareComplete}
        />
      )}

      {/* Partner QR Modal */}
      {imageForQR && userProfile?.user_type === 'partner' && (
        <PartnerQRModal
          isOpen={showQRModal}
          onClose={() => {
            setShowQRModal(false);
            setImageForQR(null);
          }}
          image={imageForQR}
          partnerId={userProfile.id}
          partnerInfo={partnerInfo}
        />
      )}

      {/* Customer Image Customization - Now handled by /customise/[imageId] page */}
      {/* Old modal-based customization removed - navigation happens in handleCustomize() */}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    }>
      <CountryProvider>
        <BrowsePageContent />
      </CountryProvider>
    </Suspense>
  );
}