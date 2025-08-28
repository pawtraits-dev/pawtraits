'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Filter,
  Star
} from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { getSupabaseClient } from '@/lib/supabase-client';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import PublicNavigation from '@/components/PublicNavigation';
import { Input } from '@/components/ui/input';
import type { Breed, Theme, AnimalType, ImageCatalogWithDetails } from '@/lib/types';
import type { Product, ProductPricing } from '@/lib/product-types';
import { formatPrice } from '@/lib/product-types';
import ProductSelectionModal from '@/components/ProductSelectionModal';
import ShareModal from '@/components/share-modal';
import UserInteractionsService from '@/lib/user-interactions';
import { useServerCart } from '@/lib/server-cart-context';
import { CountryProvider, useCountryPricing } from '@/lib/country-context';
import ClickableMetadataTags from '@/components/clickable-metadata-tags';
import ImageModal from '@/components/ImageModal';
import { extractDescriptionTitle } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import EnhancedHeroCarousel from '@/components/EnhancedHeroCarousel';


function DogsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [images, setImages] = useState<ImageCatalogWithDetails[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBreed, setSelectedBreed] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageCatalogWithDetails | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [imageToShare, setImageToShare] = useState<ImageCatalogWithDetails | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState<ImageCatalogWithDetails | null>(null);
  const [likedImages, setLikedImages] = useState<Set<string>>(new Set());
  const [sharedImages, setSharedImages] = useState<Set<string>>(new Set());
  const [purchasedImages, setPurchasedImages] = useState<Set<string>>(new Set());
  
  const supabaseService = new SupabaseService();
  const supabase = getSupabaseClient();
  const { addToCart } = useServerCart();
  const { selectedCountry, selectedCountryData, getCountryPricing, getLowestPrice } = useCountryPricing();

  useEffect(() => {
    loadData();
    initializeFilters();
    loadUserInteractions();
  }, []);

  useEffect(() => {
    loadDogImages();
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
      const [breedsData, themesData, productsData, pricingData] = await Promise.all([
        supabaseService.getBreeds('dog'),
        supabaseService.getThemes(),
        supabaseService.getPublicProducts() || [],  // Use public method to bypass RLS
        supabaseService.getPublicProductPricing() || []  // Use public method to bypass RLS
      ]);
      setBreeds(breedsData);
      setThemes(themesData.filter(theme => theme.is_active));
      setProducts(productsData);
      setPricing(pricingData);
    } catch (error) {
      console.error('Error loading data:', error);
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

  const loadDogImages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/images?public=true');
      if (response.ok) {
        const data = await response.json();
        // Filter for dog images only
        let dogImages = (data.images || []).filter((img: ImageCatalogWithDetails) => 
          img.breed?.animal_type === 'dog' || 
          img.tags?.includes('dog') ||
          (!img.breed?.animal_type && !img.tags?.includes('cat')) // Default to dog if unclear
        );

        // Apply search filter
        if (searchTerm) {
          dogImages = dogImages.filter((img: ImageCatalogWithDetails) =>
            img.prompt_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            img.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            img.breed?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            img.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
          );
        }

        // Apply breed filter
        if (selectedBreed) {
          dogImages = dogImages.filter((img: ImageCatalogWithDetails) => img.breed_id === selectedBreed);
        }

        // Apply theme filter
        if (selectedTheme) {
          dogImages = dogImages.filter((img: ImageCatalogWithDetails) => img.theme_id === selectedTheme);
        }

        // Apply featured filter
        if (featuredOnly) {
          dogImages = dogImages.filter((img: ImageCatalogWithDetails) => img.is_featured);
        }

        setImages(dogImages);
      }
    } catch (error) {
      console.error('Error loading dog images:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImageProductInfo = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    
    if (!image || !image.format_id) {
      return { productCount: 0, lowestPrice: null, currency: null };
    }

    const availableProducts = (products || []).filter(p => 
      p.is_active && p.format_id === image.format_id
    );
    
    if (availableProducts.length === 0) {
      return { productCount: 0, lowestPrice: null, currency: null };
    }

    const countryPricing = getCountryPricing(pricing || []).filter(p => 
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
      imageUrl: selectedImage.image_variants?.thumbnail?.url || selectedImage.image_variants?.mid_size?.url || selectedImage.public_url,
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
    setShowShareModal(true);
  };

  const handleImageClick = (image: ImageCatalogWithDetails) => {
    setModalImage(image);
    setShowImageModal(true);
  };

  const handleShareComplete = (platform: string) => {
    if (imageToShare) {
      UserInteractionsService.recordShare(imageToShare.id, platform, imageToShare);
      setSharedImages(prev => new Set(prev).add(imageToShare.id));
    }
    setShowShareModal(false);
    setImageToShare(null);
  };

  // Get selected breed for description display
  const selectedBreedData = selectedBreed ? breeds.find(b => b.id === selectedBreed) : null;
  
  // Get selected theme for description display
  const selectedThemeData = selectedTheme ? themes.find(t => t.id === selectedTheme) : null;
  
  // Check if only breed filter is selected (and no other filters)
  const showBreedDescription = selectedBreedData && 
    !selectedTheme && 
    !searchTerm.trim() && 
    !featuredOnly;

  // Check if only theme filter is selected (and no other filters)
  const showThemeDescription = selectedThemeData && 
    !selectedBreed && 
    !searchTerm.trim() && 
    !featuredOnly;

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="w-3 h-3 fill-current" />);
    }
    
    if (hasHalfStar) {
      stars.push(<Star key="half" className="w-3 h-3 fill-current opacity-50" />);
    }
    
    return <div className="flex items-center space-x-0.5">{stars}</div>;
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

      {/* Hero Carousel Section */}
      <section className="relative bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <EnhancedHeroCarousel 
            pageType="dogs"
            className="h-[40vh] md:h-[45vh]"
            showControls={true}
          />
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
                  placeholder="Search dog images..."
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
                <option value="">All Dog Breeds</option>
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

      {/* Breed Description */}
      {showBreedDescription && selectedBreedData && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              🐕 {selectedBreedData.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Hero Image */}
              {selectedBreedData.hero_image_url && (
                <div className="lg:w-1/3 flex-shrink-0">
                  <img 
                    src={selectedBreedData.hero_image_url}
                    alt={selectedBreedData.hero_image_alt || `${selectedBreedData.name} hero image`}
                    className="w-full h-48 lg:h-64 object-contain bg-gray-50 rounded-lg shadow-md"
                  />
                </div>
              )}
              
              {/* Content */}
              <div className="flex-1">
                <div className="text-gray-700 text-lg leading-relaxed prose prose-gray max-w-none">
                  <ReactMarkdown>{selectedBreedData.description}</ReactMarkdown>
                </div>
                {selectedBreedData.personality_traits && selectedBreedData.personality_traits.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Personality Traits:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedBreedData.personality_traits.map((trait, index) => (
                        <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Theme Description */}
      {showThemeDescription && selectedThemeData && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              🎨 {selectedThemeData.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Hero Image */}
              {selectedThemeData.hero_image_url && (
                <div className="lg:w-1/3 flex-shrink-0">
                  <img 
                    src={selectedThemeData.hero_image_url}
                    alt={selectedThemeData.hero_image_alt || `${selectedThemeData.name} theme hero image`}
                    className="w-full h-48 lg:h-32 object-cover rounded-lg shadow-md"
                  />
                </div>
              )}
              
              {/* Content */}
              <div className="flex-1">
                <p className="text-gray-700 text-lg leading-relaxed">
                  {selectedThemeData.description}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">Difficulty:</span>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                      {selectedThemeData.difficulty_level}/5
                    </Badge>
                  </div>
                  {selectedThemeData.style_keywords && selectedThemeData.style_keywords.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Keywords:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedThemeData.style_keywords.slice(0, 3).map((keyword, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gallery Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-life-savers)]">
              Beautiful Dog Portraits
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Browse our collection of AI-generated dog portraits in various styles and themes
            </p>
          </div>

          {images.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Dog portraits coming soon...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {images.map((image) => {
                const isLiked = likedImages.has(image.id);
                const isShared = sharedImages.has(image.id);
                const isPurchased = purchasedImages.has(image.id);
                const productInfo = getImageProductInfo(image.id);

                return (
                  <Card key={image.id} className="group hover:shadow-lg transition-shadow overflow-hidden">
                    <div 
                      className="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer"
                      onClick={() => handleImageClick(image)}
                    >
                      <CatalogImage
                        imageId={image.id}
                        alt={image.description || 'Generated image'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        fallbackUrl={image.image_url || image.public_url}
                      />
                      {image.rating && image.rating > 0 && (
                        <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                          {renderStars(image.rating)}
                        </div>
                      )}
                      
                      <div className="absolute top-2 right-2 flex space-x-1">
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
                        
                        {isPurchased && (
                          <div className="bg-green-500 text-white p-2 rounded-full" title="Purchased">
                            <ShoppingCart className="w-4 h-4 fill-current" />
                          </div>
                        )}
                      </div>

                      <div className="absolute bottom-2 left-2">
                        {image.is_featured && (
                          <Badge className="bg-purple-100 text-purple-800">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Featured
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <CardContent className="p-4 space-y-3">
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
                      />
                      
                      {image.description && (
                        <p className="text-sm text-gray-900 font-medium line-clamp-2">
                          {extractDescriptionTitle(image.description)}
                        </p>
                      )}
                      
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
                              'Price TBC'
                            )}
                          </div>
                        </div>
                        <Button 
                          size="sm"
                          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                          disabled={productInfo.productCount === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBuyClick(image);
                          }}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          {productInfo.productCount === 0 ? 'Coming Soon' : 'Add to Cart'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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

      {/* Modals */}
      {selectedImage && (
        <ProductSelectionModal
          image={selectedImage}
          products={products}
          pricing={pricing}
          isOpen={showProductModal}
          onClose={() => {
            setShowProductModal(false);
            setSelectedImage(null);
          }}
          onAddToBasket={handleAddToCart}
        />
      )}

      {imageToShare && (
        <ShareModal
          image={imageToShare}
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setImageToShare(null);
          }}
          onShare={handleShareComplete}
        />
      )}

      {modalImage && (
        <ImageModal
          imageId={modalImage.id}
          imageData={{
            id: modalImage.id,
            description: modalImage.description,
            prompt_text: modalImage.prompt_text,
            breed_name: modalImage.breed_name,
            theme_name: modalImage.theme_name,
            style_name: modalImage.style_name
          }}
          isOpen={showImageModal}
          onClose={() => {
            setShowImageModal(false);
            setModalImage(null);
          }}
        />
      )}
    </div>
  );
}

export default function DogsPage() {
  return (
    <CountryProvider>
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      }>
        <DogsPageContent />
      </Suspense>
    </CountryProvider>
  );
}