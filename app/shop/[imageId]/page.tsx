'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, Star, Heart, Share2, Tag, MapPin, QrCode, UserPlus, Wand2, Sparkles, Camera } from 'lucide-react';
// Removed direct database service imports - using API endpoints instead
import type { ImageCatalogWithDetails } from '@/lib/types';
import type { Product, ProductPricing } from '@/lib/product-types';
import { formatPrice } from '@/lib/product-types';
import ProductSelectionModal from '@/components/ProductSelectionModal';
import CustomerImageCustomizationModal from '@/components/CustomerImageCustomizationModal';
import { useHybridCart } from '@/lib/hybrid-cart-context';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import ShareModal from '@/components/share-modal';
import UserInteractionsService from '@/lib/user-interactions';
import { getSupabaseClient } from '@/lib/supabase-client';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider, useCountryPricing } from '@/lib/country-context';
import { useUserRouting } from '@/hooks/use-user-routing';
import ReactMarkdown from 'react-markdown';

function QRLandingPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addToCart } = useHybridCart();
  const { getCountryPricing } = useCountryPricing();
  const { userProfile } = useUserRouting();

  const imageId = params.imageId as string;
  const partnerId = searchParams.get('partner');
  const referralCode = searchParams.get('ref'); // Method 2 referral code
  const discountCode = searchParams.get('discount') || 'PARTNER10';
  const autoAdd = searchParams.get('autoAdd');
  const autoProductId = searchParams.get('productId');
  const autoQuantity = parseInt(searchParams.get('quantity') || '1');

  const [image, setImage] = useState<ImageCatalogWithDetails | null>(null);
  const [partner, setPartner] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingComplete, setTrackingComplete] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(10); // 10% default
  const [likedImage, setLikedImage] = useState(false);

  // Using API endpoints instead of direct database access
  const supabase = getSupabaseClient();

  useEffect(() => {
    loadData();
  }, [imageId, partnerId]);

  // Load interaction state
  useEffect(() => {
    if (image) {
      const likedImageIds = UserInteractionsService.getLikedImageIds();
      setLikedImage(likedImageIds.has(image.id));
    }
  }, [image]);

  // Auto-add to cart after successful signup
  useEffect(() => {
    if (autoAdd && autoProductId && image && products.length > 0) {
      // Add a delay to ensure user session is fully established after signup
      const timer = setTimeout(() => {
        // Auto-add to cart now that user should be authenticated
        handleAutoAddToCart(autoProductId, autoQuantity);
      }, 1500); // 1.5s delay to allow signup and authentication to complete
      
      return () => clearTimeout(timer);
    }
  }, [autoAdd, autoProductId, autoQuantity, image, products]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Track QR scan first
      if (partnerId && !trackingComplete) {
        await trackQRScan();
        setTrackingComplete(true);
      }

      // Load image data using API endpoint
      const imageResponse = await fetch(`/api/images/${imageId}`);
      if (!imageResponse.ok) {
        router.push('/shop');
        return;
      }
      const imageData = await imageResponse.json();
      setImage(imageData);

      // Load partner data if partner ID provided using API endpoint
      if (partnerId) {
        try {
          const partnerResponse = await fetch(`/api/public/partners/${partnerId}`);
          if (partnerResponse.ok) {
            const partnerData = await partnerResponse.json();
            setPartner(partnerData);
          }
        } catch (error) {
          console.warn('Could not load partner data:', error);
        }
      }

      // Load products and pricing using public API endpoints
      const [productsResponse, pricingResponse] = await Promise.all([
        fetch('/api/public/products'),
        fetch('/api/public/pricing')
      ]);

      if (productsResponse.ok && pricingResponse.ok) {
        const [productsData, pricingData] = await Promise.all([
          productsResponse.json(),
          pricingResponse.json()
        ]);

        setProducts(productsData || []);
        setPricing(pricingData || []);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const trackQRScan = async () => {
    try {
      const response = await fetch('/api/qr/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageId: imageId,
          partnerId: partnerId,
          userAgent: navigator.userAgent,
          referer: document.referrer || 'direct'
        })
      });

      if (!response.ok) {
        console.warn('QR tracking failed:', await response.text());
      }
    } catch (error) {
      console.warn('QR tracking error:', error);
    }
  };

  const handleAddToCart = async (productId: string, quantity: number = 1) => {
    if (!image) return;

    const product = products.find(p => p.id === productId);
    const countryPricing = getCountryPricing(pricing);
    const productPricing = countryPricing.find(p => p.product_id === productId);

    if (!product || !productPricing) return;

    try {
      // Use hybrid cart - will work for both guest and authenticated users
      await addProductToCart(product, productPricing, productId, quantity);
    } catch (error) {
      console.error('Error adding to cart:', error);
      // Handle error (could show toast notification)
    }
  };

  const handleAutoAddToCart = async (productId: string, quantity: number = 1) => {
    if (!image) return;

    const product = products.find(p => p.id === productId);
    const productPricing = pricing.find(p => p.product_id === productId);
    
    if (!product || !productPricing) return;

    // Wait for user to be authenticated after signup
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('Auto-add failed: User not authenticated after signup');
      // Fallback to regular add to cart flow
      return handleAddToCart(productId, quantity);
    }

    console.log('Auto-add proceeding for authenticated user:', user.email);
    addProductToCart(product, productPricing, productId, quantity);
  };

  const addProductToCart = async (product: any, productPricing: any, productId: string, quantity: number) => {
    const discountedPrice = partnerId ? productPricing.sale_price * (1 - discountAmount / 100) : productPricing.sale_price;
    const finalPricing = partnerId ? {
      ...productPricing,
      sale_price: discountedPrice,
      original_price: productPricing.sale_price
    } : productPricing;

    await addToCart({
      imageId: image.id,
      productId: productId,
      imageUrl: image.image_variants?.catalog_watermarked?.url || image.public_url,
      imageTitle: image.description || 'Pet Portrait',
      product: product,
      pricing: finalPricing,
      quantity: quantity,
      partnerId: partnerId || undefined,
      discountCode: partnerId ? discountCode : undefined
    });

    // After adding to cart, always redirect to cart page first
    router.push('/shop/cart');
  };

  const handleCustomize = () => {
    // Check if user is authenticated and is a customer
    if (!userProfile || userProfile.user_type !== 'customer') {
      router.push('/signup/user');
      return;
    }
    setShowCustomizeModal(true);
  };

  const handleLike = () => {
    if (!image) return;
    const isNowLiked = UserInteractionsService.toggleLikeSync(image.id, {
      id: image.id,
      public_url: image.public_url,
      breed_name: image.breed_name,
      theme_name: image.theme_name
    });
    setLikedImage(isNowLiked);
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleShareComplete = (platform: string) => {
    if (image) {
      UserInteractionsService.recordShare(image.id, platform, {
        id: image.id,
        public_url: image.public_url
      });
    }
    setShowShareModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your portrait...</p>
        </div>
      </div>
    );
  }

  if (!image) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto text-center">
          <CardContent className="pt-6">
            <p className="text-gray-600 mb-4">Portrait not found</p>
            <Button onClick={() => router.push('/shop')}>
              Browse All Portraits
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <UserAwareNavigation />
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="container mx-auto px-4 py-8">
        
        {/* Partner Header */}
        {partner && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="flex items-center space-x-3">
                <QrCode className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">
                    Recommended by {partner.business_name}
                  </p>
                  <p className="text-sm text-green-600">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    {partner.address}
                  </p>
                </div>
                <div className="ml-auto">
                  <Badge variant="secondary" className="bg-green-200 text-green-800">
                    <Tag className="w-3 h-3 mr-1" />
                    {discountAmount}% OFF
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Image Display */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 relative">
                <CatalogImage
                  imageId={image.id}
                  alt={image.description || 'Pet portrait'}
                  className="w-full h-full object-cover"
                  variant="catalog_watermarked"
                />

                {/* Partner discount badge */}
                {partner && (
                  <div className="absolute top-4 right-4 bg-green-600 text-white px-3 py-1 rounded-full">
                    <span className="text-sm font-bold">{discountAmount}% OFF</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Description, Customize, Products */}
          <div className="space-y-6">
            {/* Image Description */}
            {image.description && (
              <Card>
                <CardContent className="pt-6">
                  <ReactMarkdown className="prose prose-sm max-w-none">
                    {image.description}
                  </ReactMarkdown>
                </CardContent>
              </Card>
            )}

            {/* Put My Pet in This Pic CTA */}
            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-blue-600 rounded-lg flex-shrink-0">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      Put My Pet in This Pic!
                    </h3>
                    <p className="text-gray-700 mb-4">
                      Love this style? Upload a photo of your pet and we'll transform it to match this artistic portrait! Our AI will recreate this exact look with your pet's unique features.
                    </p>
                    <Button
                      onClick={() => router.push(`/create?id=${image.id}`)}
                      className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                      size="lg"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Create My Pet's Portrait
                    </Button>
                    <p className="text-xs text-gray-500 mt-2">
                      Free to try • 3 generations per hour
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customize Section - Visible to All, Redirects Non-Customers to Sign Up */}
            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-purple-600 rounded-lg">
                    <Wand2 className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      Not quite right?
                    </h3>
                    <p className="text-gray-700 mb-4">
                      If this beautiful {image.breed_name || 'portrait'} isn't perfect in every way (hard to believe, but who are we to judge), why not let Pawcasso get creative:
                    </p>
                    <ul className="space-y-2 mb-4">
                      <li className="flex items-center text-sm text-gray-600">
                        <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
                        Choose another breed
                      </li>
                      <li className="flex items-center text-sm text-gray-600">
                        <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
                        Try another colour coat
                      </li>
                      <li className="flex items-center text-sm text-gray-600">
                        <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
                        Pull another outfit from our extensive wardrobe
                      </li>
                    </ul>
                    <Button
                      onClick={handleCustomize}
                      className="bg-purple-600 hover:bg-purple-700"
                      size="lg"
                    >
                      <Wand2 className="w-5 h-5 mr-2" />
                      Customize This Portrait
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Pawsome Products</span>
                  <div className="flex space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLike}
                      className={likedImage ? 'text-red-500 border-red-500' : ''}
                    >
                      <Heart className={`w-4 h-4 ${likedImage ? 'fill-red-500' : ''}`} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShare}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Partner discount info */}
                {partner && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">
                      Partner Discount Applied!
                    </h4>
                    <p className="text-sm text-green-700">
                      Get {discountAmount}% off all products when you purchase this portrait through {partner.business_name}.
                    </p>
                    <div className="mt-2 flex items-center text-sm text-green-600">
                      <UserPlus className="w-4 h-4 mr-1" />
                      Create account to complete purchase
                    </div>
                  </div>
                )}


                {/* Products */}
                <div className="space-y-3">
                  <h4 className="font-semibold">Popular Products</h4>
                  {products
                    .filter(product =>
                      product.is_active &&
                      product.is_featured &&
                      (!image.format_id || product.format_id === image.format_id)
                    )
                    .sort((a, b) => {
                      // Sort by price (low to high)
                      const countryPricing = getCountryPricing(pricing);
                      const priceA = countryPricing.find(p => p.product_id === a.id)?.sale_price || 0;
                      const priceB = countryPricing.find(p => p.product_id === b.id)?.sale_price || 0;
                      return priceA - priceB;
                    })
                    .slice(0, 3)
                    .map((product) => {
                      const countryPricing = getCountryPricing(pricing);
                      const productPricing = countryPricing.find(p => p.product_id === product.id);
                      if (!productPricing) return null;

                    const originalPrice = productPricing.sale_price;
                    const discountedPrice = partner ? originalPrice * (1 - discountAmount / 100) : originalPrice;
                    const showDiscount = partner && discountAmount > 0;

                    return (
                      <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-600">{product.description}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            {showDiscount && (
                              <span className="text-sm text-gray-500 line-through">
                                {formatPrice(originalPrice, productPricing.currency_code, productPricing.currency_symbol)}
                              </span>
                            )}
                            <span className={`font-bold ${showDiscount ? 'text-green-600' : 'text-gray-900'}`}>
                              {formatPrice(discountedPrice, productPricing.currency_code, productPricing.currency_symbol)}
                            </span>
                            {showDiscount && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                                Save {discountAmount}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleAddToCart(product.id)}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Add to Basket
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {/* View all products */}
                <Button
                  variant="outline"
                  onClick={() => setShowProductModal(true)}
                  className="w-full"
                >
                  View All Product Options
                </Button>

              </CardContent>
            </Card>
          </div>
        </div>

      </div>

      {/* Modals */}
      {showProductModal && image && (
        <ProductSelectionModal
          image={image}
          products={products}
          pricing={getCountryPricing(pricing)}
          isOpen={showProductModal}
          onClose={() => setShowProductModal(false)}
          onAddToBasket={handleAddToCart}
        />
      )}

      {showShareModal && image && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          onShare={handleShareComplete}
          image={{
            id: image.id,
            public_url: image.public_url,
            prompt_text: image.prompt_text || '',
            description: image.description || ''
          }}
        />
      )}

      {/* Customer Customization Modal */}
      {image && userProfile?.user_type === 'customer' && (
        <CustomerImageCustomizationModal
          image={image}
          isOpen={showCustomizeModal}
          onClose={() => setShowCustomizeModal(false)}
          onGenerationComplete={(variations) => {
            console.log('Generated variations:', variations);
            setShowCustomizeModal(false);
            // Could show success message or redirect to customer gallery
          }}
        />
      )}
      </div>
    </>
  );
}

export default function QRLandingPage() {
  return (
    <CountryProvider>
      <QRLandingPageContent />
    </CountryProvider>
  );
}