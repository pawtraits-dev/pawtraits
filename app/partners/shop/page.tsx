'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Star, ShoppingCart, Heart, Share2, Users, ShoppingBag } from 'lucide-react';
import { PawSpinner } from '@/components/ui/paw-spinner';
import { SupabaseService } from '@/lib/supabase';
import FeaturedCard from '@/components/FeaturedCard';
// Removed AdminSupabaseService - using SupabaseService for partner access
import type { ImageCatalogWithDetails, Breed, Theme, AnimalType, Coat } from '@/lib/types';
import type { Product, ProductPricing } from '@/lib/product-types';
import { formatPrice } from '@/lib/product-types';
import ProductSelectionModal from '@/components/ProductSelectionModal';
import CartIcon from '@/components/cart-icon';
import { useServerCart } from '@/lib/server-cart-context';
import UserInteractionsService from '@/lib/user-interactions';
import { useCountryPricing } from '@/lib/country-context';
import ShareModal from '@/components/share-modal';
import PartnerQRModal from '@/components/PartnerQRModal';
import ClickableMetadataTags from '@/components/clickable-metadata-tags';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import { extractDescriptionTitle } from '@/lib/utils';
import StickyFilterHeader from '@/components/StickyFilterHeader';

export const dynamic = 'force-dynamic';

export default function PartnerShopPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [images, setImages] = useState<ImageCatalogWithDetails[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [coats, setCoats] = useState<Coat[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [animalType, setAnimalType] = useState<AnimalType | ''>('');
  const [selectedBreed, setSelectedBreed] = useState('');
  const [selectedCoat, setSelectedCoat] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageCatalogWithDetails | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [likedImages, setLikedImages] = useState<Set<string>>(new Set());
  const [sharedImages, setSharedImages] = useState<Set<string>>(new Set());
  const [purchasedImages, setPurchasedImages] = useState<Set<string>>(new Set());
  const [showShareModal, setShowShareModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [imageToShare, setImageToShare] = useState<ImageCatalogWithDetails | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const supabaseService = new SupabaseService();
  // Using SupabaseService for partner access
  const { addToCart } = useServerCart();
  const { selectedCountry, selectedCountryData, getCountryPricing, getLowestPrice } = useCountryPricing();

  useEffect(() => {
    const initializeData = async () => {
      await loadData(); // Wait for products/pricing to load first
      loadLikedImages();
      loadSharedImages();
      loadPurchasedImages();
      loadImages(); // Then load images
    };
    initializeData();
  }, []);

  // Watch for URL parameter changes and update filters accordingly
  useEffect(() => {
    if (!isInitialLoad) {
      // Apply new filters from URL parameters when they change
      applyFiltersFromUrl();
    }
  }, [searchParams, isInitialLoad]);

  const loadInitialFilters = () => {
    // Load filter values from URL parameters
    const animalParam = searchParams.get('animal');
    const breedParam = searchParams.get('breed');
    const themeParam = searchParams.get('theme');
    const searchParam = searchParams.get('search');
    const featuredParam = searchParams.get('featured');
    
    if (animalParam) setAnimalType(animalParam as AnimalType);
    if (breedParam) setSelectedBreed(breedParam);
    if (themeParam) setSelectedTheme(themeParam);
    if (searchParam) setSearchTerm(searchParam);
    if (featuredParam === 'true') setFeaturedOnly(true);
    
    // Mark initial load as complete
    setIsInitialLoad(false);
  };

  const applyFiltersFromUrl = () => {
    const animalParam = searchParams.get('animal');
    const breedParam = searchParams.get('breed');
    const themeParam = searchParams.get('theme');
    const searchParam = searchParams.get('search');
    const featuredParam = searchParams.get('featured');
    
    // Update filter states based on URL parameters
    setAnimalType((animalParam as AnimalType) || '');
    setSelectedBreed(breedParam || '');
    setSelectedTheme(themeParam || '');
    setSearchTerm(searchParam || '');
    setFeaturedOnly(featuredParam === 'true');
  };

  const loadLikedImages = () => {
    // Load liked images from localStorage
    const likedImageIds = UserInteractionsService.getLikedImageIds();
    setLikedImages(likedImageIds);
  };

  const loadSharedImages = () => {
    // Load shared images from localStorage
    const sharedImageIds = UserInteractionsService.getSharedImageIds();
    setSharedImages(sharedImageIds);
  };

  const loadPurchasedImages = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabaseService.getClient().auth.getUser();
      if (!user?.email) {
        return;
      }

      // Fetch orders from the shop orders API
      const response = await fetch(`/api/shop/orders?email=${encodeURIComponent(user.email)}`);
      
      if (!response.ok) {
        console.error('Failed to fetch orders:', response.status);
        return;
      }
      
      const orders = await response.json();
      
      // Extract image IDs from order items
      const purchasedImageIds = new Set<string>();
      if (Array.isArray(orders) && orders.length > 0) {
        orders.forEach((order: any) => {
          if (order.order_items && Array.isArray(order.order_items)) {
            order.order_items.forEach((item: any) => {
              if (item.image_id) {
                purchasedImageIds.add(item.image_id);
              }
            });
          }
        });
      }
      
      setPurchasedImages(purchasedImageIds);
    } catch (error) {
      console.error('Error loading purchased images:', error);
    }
  };

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change and update URL
  useEffect(() => {
    setPage(1);
    // Only update URL after initial load to prevent overwriting incoming URL parameters
    if (!isInitialLoad) {
      updateUrlWithFilters();
    }
  }, [animalType, selectedBreed, selectedCoat, selectedTheme, featuredOnly, debouncedSearchTerm, isInitialLoad]);

  // Reset breed and coat when animal type changes
  useEffect(() => {
    if (animalType) {
      setSelectedBreed('');
      setSelectedCoat('');
    }
  }, [animalType]);

  const updateUrlWithFilters = () => {
    const params = new URLSearchParams();
    
    if (animalType) params.set('animal', animalType);
    if (selectedBreed) params.set('breed', selectedBreed);
    if (selectedTheme) params.set('theme', selectedTheme);
    if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
    if (featuredOnly) params.set('featured', 'true');
    
    const queryString = params.toString();
    const newUrl = queryString ? `/partners/shop?${queryString}` : '/partners/shop';
    
    // Update URL without triggering a navigation
    window.history.replaceState(null, '', newUrl);
  };

  useEffect(() => {
    // Load images when filters change, regardless of products status for now  
    loadImages();
  }, [page, pageSize, animalType, selectedBreed, selectedCoat, selectedTheme, featuredOnly, debouncedSearchTerm]);

  const getBreedsWithImages = async (allBreeds: any[]) => {
    const { data: breedImages } = await supabaseService.supabase
      .from('image_catalog')
      .select('breed_id')
      .not('breed_id', 'is', null);

    const breedIdsWithImages = new Set(breedImages?.map(img => img.breed_id) || []);
    return allBreeds.filter(breed => breedIdsWithImages.has(breed.id));
  };

  const getThemesWithImages = async (allThemes: any[]) => {
    const { data: themeImages } = await supabaseService.supabase
      .from('image_catalog')
      .select('theme_id')
      .not('theme_id', 'is', null);

    const themeIdsWithImages = new Set(themeImages?.map(img => img.theme_id) || []);
    return allThemes.filter(theme => themeIdsWithImages.has(theme.id));
  };

  const loadData = async () => {
    try {
      const [breedsData, coatsData, themesData, productsData, pricingData, currentUserData, partnerData] = await Promise.all([
        supabaseService.getBreeds(),
        supabaseService.getCoats(),
        supabaseService.getThemes(),
        supabaseService.getPublicProducts(),  // Use public method to bypass RLS
        supabaseService.getPublicProductPricing(),  // Use public method to bypass RLS
        supabaseService.getCurrentUser(),
        supabaseService.getCurrentPartner()
      ]);

      const activeBreeds = breedsData?.filter((b: any) => b.is_active) || [];
      const activeThemes = themesData?.filter((t: any) => t.is_active) || [];
      
      // Filter breeds and themes to only include those with images
      const breedsWithImages = await getBreedsWithImages(activeBreeds);
      const themesWithImages = await getThemesWithImages(activeThemes);

      console.log(`Filtered breeds: ${breedsWithImages.length} out of ${activeBreeds.length} have images`);
      console.log(`Filtered themes: ${themesWithImages.length} out of ${activeThemes.length} have images`);

      setBreeds(breedsWithImages.sort((a, b) => a.name.localeCompare(b.name)));
      setCoats((coatsData?.filter((c: any) => c.is_active) || []).sort((a, b) => a.name.localeCompare(b.name)));
      setThemes(themesWithImages.sort((a, b) => a.name.localeCompare(b.name)));
      setProducts(productsData?.filter((p: any) => p.is_active) || []);
      setPricing(pricingData || []);
      setCurrentUser(currentUserData);
      setPartnerInfo(partnerData);
      
      // Load initial filters after reference data is loaded
      loadInitialFilters();
    } catch (error) {
      console.error('Error loading filter data:', error);
    }
  };

  const loadImages = async () => {
    try {
      setLoading(true);
      const imageData = await supabaseService.getImages({
        page,
        limit: pageSize,
        breedId: selectedBreed || null,
        coatId: selectedCoat || null,
        themeId: selectedTheme || null,
        featured: featuredOnly,
        publicOnly: true,
        search: debouncedSearchTerm || undefined
      });

      let filteredImages = imageData;

      // Client-side filtering for animal type
      if (animalType) {
        filteredImages = filteredImages.filter(img => img.breed_animal_type === animalType);
      }

      setImages(filteredImages);
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAnimalType('');
    setSelectedBreed('');
    setSelectedCoat('');
    setSelectedTheme('');
    setFeaturedOnly(false);
    setPage(1);
  };

  // Get filtered breeds and coats based on animal type
  const filteredBreeds = animalType ? breeds.filter(b => b.animal_type === animalType) : breeds;
  const filteredCoats = animalType ? coats.filter(c => c.animal_type === animalType) : coats;

  // Get selected breed for description display
  const selectedBreedData = selectedBreed ? breeds.find(b => b.id === selectedBreed) : null;
  
  // Get selected coat for description display
  const selectedCoatData = selectedCoat ? coats.find(c => c.id === selectedCoat) : null;
  
  // Check if only breed filter is selected (and no other filters)
  const showBreedDescription = selectedBreedData && 
    !selectedCoat && 
    !selectedTheme && 
    !searchTerm.trim() && 
    !featuredOnly;

  // Check if only coat filter is selected (and no other filters)
  const showCoatDescription = selectedCoatData && 
    !selectedBreed && 
    !selectedTheme && 
    !searchTerm.trim() && 
    !featuredOnly;

  // Get selected theme for description display
  const selectedThemeData = selectedTheme ? themes.find(t => t.id === selectedTheme) : null;
  
  // Check if only theme filter is selected (and no other filters)
  const showThemeDescription = selectedThemeData && 
    !selectedBreed && 
    !selectedCoat && 
    !searchTerm.trim() && 
    !featuredOnly;

  // Check if only animal type is selected (and no other filters)
  const showAnimalDescription = animalType && 
    !selectedBreed && 
    !selectedCoat && 
    !selectedTheme && 
    !searchTerm.trim() && 
    !featuredOnly;

  const getImageProductInfo = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    
    if (!image || !image.format_id) {
      return { productCount: 0, lowestPrice: null, currency: null };
    }

    const availableProducts = products.filter(p => 
      p.is_active && p.format_id === image.format_id
    );
    
    if (availableProducts.length === 0) {
      return { productCount: 0, lowestPrice: null, currency: null };
    }

    const countryPricing = getCountryPricing(pricing).filter(p => 
      availableProducts.some(product => product.id === p.product_id)
    );

    if (countryPricing.length === 0) {
      return { productCount: availableProducts.length, lowestPrice: null, currency: null };
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

  const handleBuyClick = (image: ImageCatalogWithDetails) => {
    setSelectedImage(image);
    setShowProductModal(true);
  };

  const handleAddToCart = (productId: string, quantity: number) => {
    if (!selectedImage) return;

    const product = products.find(p => p.id === productId);
    const productPricing = pricing.find(p => p.product_id === productId && p.country_code === selectedCountry);
    
    if (!product || !productPricing) {
      alert('Product information not found');
      return;
    }

    addToCart({
      imageId: selectedImage.id,
      productId: productId,
      imageUrl: selectedImage.public_url,
      imageTitle: selectedImage.description || 'Pet Portrait',
      product: product,
      pricing: productPricing,
      quantity: quantity
    });

    setShowProductModal(false);
    setSelectedImage(null);
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
    setShowQRModal(true);
  };

  const handleImageClick = (image: ImageCatalogWithDetails) => {
    router.push(`/image/${image.id}`);
  };

  const handleShareComplete = (platform: string) => {
    if (imageToShare) {
      UserInteractionsService.recordShare(imageToShare.id, platform, imageToShare);
      setSharedImages(prev => new Set(prev).add(imageToShare.id));
      console.log(`Image shared on ${platform}:`, imageToShare.id);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${
              star <= rating ? 'text-yellow-500 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading && page === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-8">
        <div className="flex items-center justify-center h-64">
          <PawSpinner size="xl" />
        </div>
      </div>
    );
  }

  // Configure sticky header filters
  const stickyHeaderFilters = [
    {
      value: animalType,
      onChange: setAnimalType,
      options: [
        { value: 'dog', label: '🐕 Dogs' },
        { value: 'cat', label: '🐱 Cats' }
      ],
      placeholder: 'All Animals'
    },
    {
      value: selectedBreed,
      onChange: setSelectedBreed,
      options: filteredBreeds.map(breed => ({ value: breed.id, label: breed.name })),
      placeholder: 'All Breeds'
    },
    {
      value: selectedCoat,
      onChange: setSelectedCoat,
      options: filteredCoats.map(coat => ({ value: coat.id, label: coat.name })),
      placeholder: 'All Coats'
    },
    {
      value: selectedTheme,
      onChange: setSelectedTheme,
      options: themes.map(theme => ({ value: theme.id, label: theme.name })),
      placeholder: 'All Themes'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-8">
      {/* Sticky Filter Header */}
      <StickyFilterHeader
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearchSubmit={loadImages}
        searchPlaceholder="Search images, tags, descriptions..."
        filters={stickyHeaderFilters}
        onClearFilters={() => {
          setSearchTerm('');
          setAnimalType('');
          setSelectedBreed('');
          setSelectedCoat('');
          setSelectedTheme('');
          setFeaturedOnly(false);
          loadImages();
        }}
      />
      
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              🏪 Partner Shop
            </h1>
            <p className="text-lg text-gray-600">
              Browse portraits to recommend to your clients
            </p>
            <div className="mt-2 flex items-center justify-center text-sm text-green-700 bg-green-100 rounded-full px-4 py-2 w-fit mx-auto">
              <Users className="w-4 h-4 mr-2" />
              Partner Account - Special pricing available
            </div>
          </div>
          <div className="hidden md:block">
            <CartIcon />
          </div>
        </div>
        
        {/* Mobile Cart Icon */}
        <div className="md:hidden mb-4 flex justify-end">
          <CartIcon />
        </div>


        {/* Breed Description */}
        {showBreedDescription && selectedBreedData && (
          <FeaturedCard
            title={selectedBreedData.name}
            description={selectedBreedData.description}
            heroImageUrl={selectedBreedData.hero_image_url}
            heroImageAlt={selectedBreedData.hero_image_alt}
            gradientFrom="blue-50"
            gradientTo="purple-50"
            borderColor="blue-200"
            icon={selectedBreedData.animal_type === 'dog' ? '🐕' : '🐱'}
            metadata={[
              { label: 'Animal Type', value: selectedBreedData.animal_type, className: 'capitalize' },
              ...(selectedBreedData.popularity_rank ? [{ label: 'Popularity Rank', value: `#${selectedBreedData.popularity_rank}` }] : [])
            ]}
          />
        )}

        {/* Coat Description */}
        {showCoatDescription && selectedCoatData && (
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded-full border-2 border-gray-300"
                  style={{ backgroundColor: selectedCoatData.hex_color }}
                  title={selectedCoatData.hex_color}
                ></div>
                {selectedCoatData.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Hero Image */}
                {selectedCoatData.hero_image_url && (
                  <div className="lg:w-1/3 flex-shrink-0">
                    <img 
                      src={selectedCoatData.hero_image_url}
                      alt={selectedCoatData.hero_image_alt || `${selectedCoatData.name} coat hero image`}
                      className="w-full h-48 lg:h-32 object-cover rounded-lg shadow-md"
                    />
                  </div>
                )}
                
                {/* Content */}
                <div className="flex-1">
                  <p className="text-gray-700 text-lg leading-relaxed">
                    {selectedCoatData.description}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Pattern:</span>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                        {selectedCoatData.pattern_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Rarity:</span>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                        {selectedCoatData.rarity}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Color:</span>
                      <span className="text-sm text-gray-600">{selectedCoatData.hex_color}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Theme Description */}
        {showThemeDescription && selectedThemeData && (
          <FeaturedCard
            title={selectedThemeData.name}
            description={selectedThemeData.description}
            heroImageUrl={selectedThemeData.hero_image_url}
            heroImageAlt={selectedThemeData.hero_image_alt}
            gradientFrom="purple-50"
            gradientTo="pink-50"
            borderColor="purple-200"
            icon="🎨"
            metadata={[
              { label: 'Difficulty', value: `${selectedThemeData.difficulty_level}/5` },
              ...(selectedThemeData.style_keywords?.length ? [{ label: 'Keywords', value: `${selectedThemeData.style_keywords.length} available` }] : [])
            ]}
          />
        )}

        {/* Animal Type Description */}
        {showAnimalDescription && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {animalType === 'dog' ? '🐕' : '🐱'} {animalType === 'dog' ? 'Dogs' : 'Cats'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 text-lg leading-relaxed">
                {animalType === 'dog' 
                  ? "Man's best friend and professional treat inspectors! Dogs have mastered the art of looking adorable while simultaneously plotting to steal your sandwich. From tiny ankle-biters who think they're lions to gentle giants who believe they're lap dogs, every dog is convinced they're the main character in your life story - and honestly, they're probably right!"
                  : "Independent contractors and professional nap specialists! Cats have perfected the balance between regal aloofness and demanding attention exactly when you're busiest. Masters of selective hearing who can ignore their name for hours but appear instantly at the sound of a can opener, cats graciously allow humans to share their homes while providing occasional purrs as payment."
                }
              </p>
              <div className="mt-4">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {filteredBreeds.length} available breeds
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Images Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {images.map((image) => {
            // Show all images temporarily - debugging sequential loading
            const productInfo = getImageProductInfo(image.id);
            const isLiked = likedImages.has(image.id);
            const isShared = sharedImages.has(image.id);
            const isPurchased = purchasedImages.has(image.id);
            
            return (
            <Card key={image.id} className="group hover:shadow-lg transition-shadow overflow-hidden">
              {/* Image */}
              <div 
                className="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer"
                onClick={() => handleImageClick(image)}
              >
                <CatalogImage
                  imageId={image.id}
                  alt={image.description || 'Generated image'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {image.rating && image.rating > 0 && (
                  <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                    {renderStars(image.rating)}
                  </div>
                )}
                
                {/* Top right action buttons */}
                <div className="absolute top-2 right-2 flex space-x-1">
                  <button
                    onClick={() => handleLike(image.id)}
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
                    onClick={() => handleShare(image)}
                    className={`p-2 rounded-full transition-all ${
                      isShared 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-white bg-opacity-80 text-gray-700 hover:bg-blue-500 hover:text-white'
                    }`}
                    title={isShared ? 'Shared with client' : 'Share with client'}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  
                  {isPurchased && (
                    <div className="bg-green-500 text-white p-2 rounded-full" title="Purchased">
                      <ShoppingBag className="w-4 h-4 fill-current" />
                    </div>
                  )}

                  {image.is_featured && (
                    <div className="bg-yellow-500 text-white p-2 rounded-full">
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                  )}
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                {/* Metadata Tags - Clickable */}
                <ClickableMetadataTags
                  breed_id={image.breed_id}
                  breed_name={image.breed_name}
                  breed_animal_type={image.breed_animal_type}
                  theme_id={image.theme_id}
                  theme_name={image.theme_name}
                  style_id={image.style_id}
                  style_name={image.style_name}
                  coat_id={image.coat_id}
                  coat_name={image.coat_name}
                  coat_hex_color={image.coat_hex_color}
                  coat_animal_type={image.coat_animal_type}
                  targetShopPage="/partners/shop"
                />

                {/* Description Title */}
                {image.description && (
                  <p className="text-sm text-gray-900 font-medium line-clamp-2">
                    {extractDescriptionTitle(image.description)}
                  </p>
                )}

                {/* Buy Section */}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600">
                      {productInfo.productCount > 0 ? (
                        <>
                          {productInfo.productCount} product{productInfo.productCount > 1 ? 's' : ''} from{' '}
                          {productInfo.lowestPrice && productInfo.currencySymbol ? 
                            formatPrice(productInfo.lowestPrice, productInfo.currency || 'GBP', productInfo.currencySymbol) : 
                            'Price TBC'
                          }
                        </>
                      ) : (
                        'No products available'
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button 
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      disabled={productInfo.productCount === 0}
                      onClick={() => handleBuyClick(image)}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Order for Client
                    </Button>
                    <p className="text-xs text-center text-green-700">
                      Partner discount applied at checkout
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {images.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No images found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
            <Button onClick={clearFilters} variant="outline">
              Clear all filters
            </Button>
          </div>
        )}

        {/* Pagination Controls */}
        {images.length > 0 && (
          <div className="flex justify-between items-center pt-6 border-t bg-white p-4 rounded-lg">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Page {page} • {images.length} images
              </span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded px-3 py-1"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
                <option value={1000}>Load All</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1 || loading}
                variant="outline"
                size="sm"
              >
                ← Previous
              </Button>
              
              <Button
                onClick={() => setPage(page + 1)}
                disabled={loading || images.length < pageSize}
                variant="outline"
                size="sm"
              >
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* Product Selection Modal */}
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
            onAddToBasket={handleAddToCart}
          />
        )}

        {/* QR Modal */}
        {imageToShare && partnerInfo && (
          <PartnerQRModal
            isOpen={showQRModal}
            onClose={() => {
              setShowQRModal(false);
              setImageToShare(null);
            }}
            image={imageToShare}
            partnerId={partnerInfo.id}
            partnerInfo={partnerInfo}
          />
        )}

        {/* Share Modal */}
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

      </div>
    </div>
  );
}