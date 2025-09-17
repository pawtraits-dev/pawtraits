'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, Star, Heart, Share2, Tag, MapPin, QrCode, UserPlus } from 'lucide-react';
import { SupabaseService } from '@/lib/supabase';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import type { ImageCatalogWithDetails } from '@/lib/types';
import type { Product, ProductPricing } from '@/lib/product-types';
import { formatPrice } from '@/lib/product-types';
import ProductSelectionModal from '@/components/ProductSelectionModal';
import { useServerCart } from '@/lib/server-cart-context';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import ShareModal from '@/components/share-modal';
import { getSupabaseClient } from '@/lib/supabase-client';
import PublicNavigation from '@/components/PublicNavigation';
import { CountryProvider, useCountryPricing } from '@/lib/country-context';
import ReactMarkdown from 'react-markdown';

function QRLandingPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addToCart } = useServerCart();
  const { getCountryPricing } = useCountryPricing();

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
  const [discountAmount, setDiscountAmount] = useState(10); // 10% default

  const supabaseService = new SupabaseService();
  const adminService = new AdminSupabaseService();
  const supabase = getSupabaseClient();

  useEffect(() => {
    loadData();
  }, [imageId, partnerId]);

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

      // Load image data
      const imageData = await supabaseService.getImage(imageId);
      if (!imageData) {
        router.push('/shop');
        return;
      }
      setImage(imageData);

      // Load partner data if partner ID provided
      if (partnerId) {
        const partnerData = await supabaseService.getPartner(partnerId);
        setPartner(partnerData);
      }

      // Load products and pricing
      const [productsData, pricingData] = await Promise.all([
        adminService.getProducts({ activeOnly: true }),
        adminService.getAllProductPricing()
      ]);
      
      setProducts(productsData || []);
      setPricing(pricingData || []);

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
    const productPricing = pricing.find(p => p.product_id === productId);
    
    if (!product || !productPricing) return;

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Redirect to QR-specific signup with context
      const signupUrl = new URL('/signup/user-qr', window.location.origin);
      signupUrl.searchParams.set('imageId', imageId);
      signupUrl.searchParams.set('productId', productId);
      signupUrl.searchParams.set('quantity', quantity.toString());
      if (partnerId) signupUrl.searchParams.set('partner', partnerId);
      if (referralCode) signupUrl.searchParams.set('ref', referralCode);
      if (discountCode) signupUrl.searchParams.set('discount', discountCode);
      
      router.push(signupUrl.toString());
      return;
    }

    // User is authenticated, proceed with add to cart
    addProductToCart(product, productPricing, productId, quantity);
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

  const addProductToCart = (product: any, productPricing: any, productId: string, quantity: number) => {
    const discountedPrice = partnerId ? productPricing.sale_price * (1 - discountAmount / 100) : productPricing.sale_price;
    const finalPricing = partnerId ? {
      ...productPricing,
      sale_price: discountedPrice,
      original_price: productPricing.sale_price
    } : productPricing;

    addToCart({
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

    // Redirect to customer checkout (protected route)
    router.push('/customer/checkout');
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
      <PublicNavigation />
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
                />
                
                {/* Rating overlay */}
                {image.rating && image.rating > 0 && (
                  <div className="absolute top-4 left-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded-full flex items-center space-x-1">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="text-sm font-medium">{image.rating}</span>
                  </div>
                )}

                {/* Partner discount badge */}
                {partner && (
                  <div className="absolute top-4 right-4 bg-green-600 text-white px-3 py-1 rounded-full">
                    <span className="text-sm font-bold">{discountAmount}% OFF</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Product Details */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex-1">
                    {image.description ? (
                      <ReactMarkdown className="prose prose-sm max-w-none">
                        {image.description}
                      </ReactMarkdown>
                    ) : (
                      <span>Custom Pet Portrait</span>
                    )}
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowShareModal(true)}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Metadata */}
                <div className="flex flex-wrap gap-2">
                  {image.breed_name && (
                    <Badge variant="secondary">{image.breed_name}</Badge>
                  )}
                  {image.theme_name && (
                    <Badge variant="secondary">{image.theme_name}</Badge>
                  )}
                  {image.style_name && (
                    <Badge variant="secondary">{image.style_name}</Badge>
                  )}
                </div>

                <Separator />

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

                {/* Non-partner regular pricing notice */}
                {!partner && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">
                      Premium Pet Portrait
                    </h4>
                    <p className="text-sm text-blue-700">
                      High-quality AI-generated portrait available in multiple formats.
                    </p>
                  </div>
                )}

                {/* Products */}
                <div className="space-y-3">
                  <h4 className="font-semibold">Available Products</h4>
                  {products.filter(product =>
                    product.is_active &&
                    (!image.format_id || product.format_id === image.format_id)
                  ).slice(0, 3).map((product) => {
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
                          Add to Cart
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

        {/* Browse more */}
        <Card className="mt-8">
          <CardContent className="pt-6 text-center">
            <h3 className="text-lg font-semibold mb-2">Love this style?</h3>
            <p className="text-gray-600 mb-4">
              Browse our complete collection of AI-generated pet portraits
            </p>
            <Button 
              variant="outline"
              onClick={() => router.push('/shop')}
            >
              Browse All Portraits
            </Button>
          </CardContent>
        </Card>
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
          image={{
            id: image.id,
            public_url: image.public_url,
            prompt_text: image.prompt_text || '',
            description: image.description || ''
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