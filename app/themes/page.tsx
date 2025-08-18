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
  Star
} from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { getSupabaseClient } from '@/lib/supabase-client';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import PublicNavigation from '@/components/PublicNavigation';
import type { Theme, ImageCatalogWithDetails } from '@/lib/types';
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
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
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
    loadUserInteractions();
  }, []);

  const loadData = async () => {
    try {
      const [themesData, productsData, pricingData] = await Promise.all([
        supabaseService.getThemes(),
        supabaseService.getPublicProducts() || [],  // Use public method to bypass RLS
        supabaseService.getPublicProductPricing() || []  // Use public method to bypass RLS
      ]);
      setThemes(themesData.filter(theme => theme.is_active));
      setProducts(productsData);
      setPricing(pricingData);
      await loadGalleryImages();
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


  const loadGalleryImages = async () => {
    try {
      const response = await fetch('/api/images?public=true');
      if (response.ok) {
        const data = await response.json();
        setImages(data.images || []);
      }
    } catch (error) {
      console.error('Error loading gallery images:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImagesForTheme = (themeId: string) => {
    return images.filter(img => img.theme_id === themeId).slice(0, 3);
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
      <section className="relative">
        <EnhancedHeroCarousel 
          pageType="themes"
          className="h-[400px] md:h-[500px]"
          showControls={true}
        />
      </section>

      {/* Themes Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-life-savers)]">
              Available Themes
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose from our carefully curated collection of artistic themes and styles
            </p>
          </div>

          {themes.length === 0 ? (
            <div className="text-center py-12">
              <Palette className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Themes coming soon...</p>
            </div>
          ) : (
            <div className="space-y-12">
              {themes.map((theme) => {
                const themeImages = getImagesForTheme(theme.id);
                
                return (
                  <div key={theme.id} className="border-b border-gray-200 pb-12 last:border-b-0">
                    <div className="mb-8">
                      <div className="flex items-center space-x-3 mb-4">
                        <Palette className="w-8 h-8 text-purple-600" />
                        <h3 className="text-3xl font-bold text-gray-900 font-[family-name:var(--font-life-savers)]">
                          {theme.name}
                        </h3>
                        <Badge variant="outline" className="ml-2">
                          {theme.animal_type === 'both' ? 'Dogs & Cats' : theme.animal_type?.charAt(0).toUpperCase() + theme.animal_type?.slice(1) || 'Unknown'}
                        </Badge>
                      </div>
                      <p className="text-lg text-gray-600 max-w-3xl">
                        {theme.description}
                      </p>
                    </div>

                    {themeImages.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {themeImages.map((image) => {
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
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <Palette className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No images available for this theme yet</p>
                      </div>
                    )}

                    <div className="text-center mt-6">
                      <Button 
                        variant="outline"
                        onClick={() => router.push(`/customer/shop?theme=${theme.id}`)}
                      >
                        Create with {theme.name} Theme
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
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

export default function ThemesPage() {
  return (
    <CountryProvider>
      <ThemesPageContent />
    </CountryProvider>
  );
}