'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Share2, ShoppingCart, Heart, Star, Copy, Wand2 } from 'lucide-react';
import { PawSpinner } from '@/components/ui/paw-spinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CloudinaryImageDisplay } from '@/components/CloudinaryImageDisplay';
import ProductSelectionModal from '@/components/ProductSelectionModal';
import { SupabaseService } from '@/lib/supabase';
import UserInteractionsService from '@/lib/user-interactions';
import { useServerCart } from '@/lib/server-cart-context';
import { useCountryPricing } from '@/lib/country-context';
import ReactMarkdown from 'react-markdown';
import ShareModal from '@/components/share-modal';
import PartnerQRModal from '@/components/PartnerQRModal';
import type { ImageCatalogWithDetails, Product, ProductPricing } from '@/lib/types';

interface ImagePageProps {}

export default function ImagePage({}: ImagePageProps) {
  const params = useParams();
  const router = useRouter();
  const imageId = params.id as string;
  
  const [imageData, setImageData] = useState<ImageCatalogWithDetails | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [userType, setUserType] = useState<'customer' | 'partner' | null>(null);

  const supabaseService = new SupabaseService();
  const { addToCart } = useServerCart();
  const { selectedCountry, selectedCountryData, getCountryPricing } = useCountryPricing();

  useEffect(() => {
    if (imageId) {
      loadData();
    }
  }, [imageId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load image data and other required data in parallel
      const [imageResult, productsData, pricingData, userData, partnerData] = await Promise.all([
        supabaseService.getImageById(imageId),
        supabaseService.getPublicProducts(),
        supabaseService.getPublicProductPricing(),
        supabaseService.getCurrentUser(),
        supabaseService.getCurrentPartner().catch(() => null) // Partner might not exist
      ]);

      if (!imageResult) {
        throw new Error('Image not found');
      }

      setImageData(imageResult);
      setProducts(productsData?.filter((p: any) => p.is_active) || []);
      setPricing(pricingData || []);
      setCurrentUser(userData);
      setPartnerInfo(partnerData);
      
      // Determine user type based on current path or user data
      const currentPath = window.location.pathname;
      if (currentPath.includes('/partners/') || partnerData) {
        setUserType('partner');
      } else {
        setUserType('customer');
      }

      // Load user interaction states
      const likedImageIds = UserInteractionsService.getLikedImageIds();
      const sharedImageIds = UserInteractionsService.getSharedImageIds();
      setIsLiked(likedImageIds.has(imageId));
      setIsShared(sharedImageIds.has(imageId));
      
      // Check if user has purchased this image
      if (userData?.email) {
        await checkIfPurchased(userData.email);
      }

    } catch (error) {
      console.error('Error loading image data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkIfPurchased = async (userEmail: string) => {
    try {
      const response = await fetch(`/api/shop/orders?email=${encodeURIComponent(userEmail)}`);
      if (!response.ok) return;
      
      const orders = await response.json();
      const purchased = orders.some((order: any) => 
        order.order_items?.some((item: any) => item.image_id === imageId)
      );
      setIsPurchased(purchased);
    } catch (error) {
      console.error('Error checking purchase status:', error);
    }
  };

  const handleBuyClick = () => {
    setShowProductModal(true);
  };

  const handleAddToCart = (productId: string, quantity: number) => {
    if (!imageData) return;

    const product = products.find(p => p.id === productId);
    const productPricing = pricing.find(p => p.product_id === productId && p.country_code === selectedCountry);
    
    if (!product || !productPricing) {
      alert('Product information not found');
      return;
    }

    addToCart({
      imageId: imageData.id,
      productId: productId,
      imageUrl: imageData.public_url,
      imageTitle: imageData.description || 'Pet Portrait',
      product: product,
      pricing: productPricing,
      quantity: quantity
    });

    setShowProductModal(false);
  };

  const handleLike = () => {
    if (!imageData) return;
    
    const isNowLiked = UserInteractionsService.toggleLikeSync(imageId, imageData);
    setIsLiked(isNowLiked);
  };

  const handleShare = () => {
    if (userType === 'partner' && partnerInfo) {
      setShowQRModal(true);
    } else {
      setShowShareModal(true);
    }
  };

  const handleShareComplete = (platform: string) => {
    if (imageData) {
      UserInteractionsService.recordShare(imageData.id, platform, imageData);
      setIsShared(true);
      console.log(`Image shared on ${platform}:`, imageData.id);
    }
  };

  const copyPromptToClipboard = () => {
    if (imageData?.prompt_text) {
      navigator.clipboard.writeText(imageData.prompt_text);
      alert('Prompt copied to clipboard!');
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'text-yellow-500 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const getReturnPath = () => {
    // Determine return path based on referrer or user type
    const referrer = document.referrer;
    if (referrer.includes('/partners/shop')) return '/partners/shop';
    if (referrer.includes('/customer/shop')) return '/customer/shop';
    return userType === 'partner' ? '/partners/shop' : '/customer/shop';
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${userType === 'partner' ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-purple-50 to-blue-50'} p-8`}>
        <div className="flex items-center justify-center h-64">
          <PawSpinner size="xl" />
        </div>
      </div>
    );
  }

  if (!imageData) {
    return (
      <div className={`min-h-screen ${userType === 'partner' ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-purple-50 to-blue-50'} p-8`}>
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Image Not Found</h1>
          <p className="text-gray-600 mb-6">The image you're looking for could not be found.</p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${userType === 'partner' ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-purple-50 to-blue-50'} p-4 md:p-8`}>
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <Button 
            onClick={() => router.push(getReturnPath())} 
            variant="outline"
            className="bg-white/80 backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Shop
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            {/* Image Section */}
            <div className="flex-1 bg-gray-100 flex items-center justify-center relative min-h-[60vh] lg:min-h-[80vh]">
              <div className="w-full h-full flex items-center justify-center p-4">
                <CloudinaryImageDisplay
                  imageId={imageData.id}
                  variant="full_size"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  alt={imageData.description || imageData.prompt_text || 'Pet portrait'}
                  fallbackUrl={imageData.public_url || imageData.image_url}
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
              
              {/* Loading overlay */}
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <PawSpinner size="lg" />
                    <div className="text-gray-500">Loading high resolution image...</div>
                  </div>
                </div>
              )}

              {/* Image badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {imageData.is_featured && (
                  <Badge className="bg-yellow-500 text-white">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    Featured
                  </Badge>
                )}
                {isPurchased && (
                  <Badge className="bg-green-500 text-white">
                    Purchased
                  </Badge>
                )}
                {imageData.rating && imageData.rating > 0 && (
                  <div className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
                    {renderStars(imageData.rating)}
                  </div>
                )}
              </div>
            </div>

            {/* Info Panel */}
            <div className="lg:w-96 bg-white p-6 overflow-y-auto max-h-[80vh]">
              <div className="space-y-6">
                {/* AI Description */}
                <div>
                  {imageData.description ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          h1: ({children}) => <h2 className="text-xl font-bold text-gray-900 mb-2">{children}</h2>,
                          h2: ({children}) => <h3 className="text-lg font-semibold text-gray-800 mb-2">{children}</h3>,
                          p: ({children}) => <p className="text-sm text-gray-600 mb-2">{children}</p>,
                          strong: ({children}) => <strong className="font-bold text-gray-900">{children}</strong>,
                          em: ({children}) => <em className="italic text-gray-700">{children}</em>,
                        }}
                      >
                        {imageData.description}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Pet Portrait</h2>
                  )}
                </div>

                {/* Metadata */}
                <div className="space-y-2">
                  {imageData.breed_name && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Breed</Badge>
                      <span className="text-sm text-gray-700">{imageData.breed_name}</span>
                    </div>
                  )}
                  {imageData.theme_name && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Theme</Badge>
                      <span className="text-sm text-gray-700">{imageData.theme_name}</span>
                    </div>
                  )}
                  {imageData.style_name && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Style</Badge>
                      <span className="text-sm text-gray-700">{imageData.style_name}</span>
                    </div>
                  )}
                  {imageData.coat_name && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Coat</Badge>
                      <span className="text-sm text-gray-700">{imageData.coat_name}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t space-y-3">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLike}
                      className={isLiked ? 'bg-red-50 border-red-200 text-red-700' : ''}
                    >
                      <Heart className={`w-4 h-4 mr-2 ${isLiked ? 'fill-current' : ''}`} />
                      {isLiked ? 'Liked' : 'Like'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShare}
                      className={isShared ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      {userType === 'partner' ? 'Share with Client' : 'Share'}
                    </Button>
                  </div>

                  {isPurchased ? (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => {/* TODO: Download functionality */}}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download High Resolution
                    </Button>
                  ) : (
                    <Button
                      className={`w-full ${userType === 'partner' 
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' 
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                      }`}
                      onClick={handleBuyClick}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {userType === 'partner' ? 'Order for Client' : 'Buy Now'}
                    </Button>
                  )}

                  {userType === 'partner' && (
                    <p className="text-xs text-center text-green-700">
                      Partner discount applied at checkout
                    </p>
                  )}
                </div>

                {/* Image Info */}
                <div className="pt-4 border-t text-xs text-gray-500">
                  <p>This is a watermarked preview.</p>
                  {!isPurchased && (
                    <p>Purchase to get the full resolution version without watermarks.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Selection Modal */}
        {showProductModal && imageData && (
          <ProductSelectionModal
            isOpen={showProductModal}
            onClose={() => setShowProductModal(false)}
            image={imageData}
            products={products}
            pricing={pricing}
            onAddToBasket={handleAddToCart}
          />
        )}

        {/* QR Modal for Partners */}
        {showQRModal && imageData && partnerInfo && (
          <PartnerQRModal
            isOpen={showQRModal}
            onClose={() => setShowQRModal(false)}
            image={imageData}
            partnerId={partnerInfo.id}
            partnerInfo={partnerInfo}
          />
        )}

        {/* Share Modal for Customers */}
        {showShareModal && imageData && (
          <ShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            image={imageData as any}
            onShare={handleShareComplete}
          />
        )}
      </div>
    </div>
  );
}