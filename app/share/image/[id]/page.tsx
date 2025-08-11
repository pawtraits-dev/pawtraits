'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Heart, Share2, ShoppingCart, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import type { Product, ProductPricing } from '@/lib/product-types';
import { formatPrice } from '@/lib/product-types';
import ProductSelectionModal from '@/components/ProductSelectionModal';
import ShareModal from '@/components/share-modal';

interface CatalogImage {
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

export default async function SharedImagePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  return <SharedImagePageClient id={id} />;
}

function SharedImagePageClient({ id }: { id: string }) {
  const [image, setImage] = useState<CatalogImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [liked, setLiked] = useState(false);

  const supabaseService = new SupabaseService();
  const adminSupabaseService = new AdminSupabaseService();

  useEffect(() => {
    loadImageData(id);
  }, [id]);

  const loadImageData = async (id: string) => {
    try {
      setLoading(true);
      
      // Load image data
      const imageData = await supabaseService.getImage(id);
      
      if (imageData) {
        setImage({
          ...imageData,
          description: imageData.description || ''
        });
        
        // Load product data for this image's format
        if (imageData.format_id) {
          const [productsData, pricingData] = await Promise.all([
            adminSupabaseService.getProducts(),
            adminSupabaseService.getAllProductPricing()
          ]);
          
          setProducts(productsData?.filter(p => p.is_active && p.format_id === imageData.format_id) || []);
          setPricing(pricingData || []);
        }
      }
    } catch (error) {
      console.error('Error loading image data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImageProductInfo = () => {
    if (!image || !image.format_id) {
      return { productCount: 0, lowestPrice: null, currency: null };
    }

    // Get products that match this image's format and are active
    const availableProducts = products.filter(p => 
      p.is_active && p.format_id === image.format_id
    );
    
    if (availableProducts.length === 0) {
      return { productCount: 0, lowestPrice: null, currency: null };
    }

    // Get pricing for matching products in GB (default country)
    const gbPricing = pricing.filter(p => 
      p.country_code === 'GB' && 
      availableProducts.some(product => product.id === p.product_id)
    );

    if (gbPricing.length === 0) {
      return { productCount: availableProducts.length, lowestPrice: null, currency: null };
    }

    // Find the lowest price
    const lowestPricing = gbPricing.reduce((lowest, current) => 
      current.sale_price < lowest.sale_price ? current : lowest
    );

    return {
      productCount: availableProducts.length,
      lowestPrice: lowestPricing.sale_price,
      currency: lowestPricing.currency_code,
      currencySymbol: lowestPricing.currency_symbol
    };
  };

  const handleBuyClick = () => {
    if (image) {
      setShowProductModal(true);
    }
  };

  const handleShare = () => {
    if (image) {
      setShowShareModal(true);
    }
  };

  const handleLike = () => {
    setLiked(!liked);
    // TODO: In a real implementation, save this to user preferences
  };

  const handleShareComplete = (platform: string) => {
    console.log(`Image shared on ${platform}:`, image?.id);
  };

  const handleAddToBasket = (productId: string, quantity: number) => {
    // TODO: Implement actual basket/cart functionality
    console.log(`Adding ${quantity} of product ${productId} to basket`);
    const product = products.find(p => p.id === productId);
    alert(`Added ${quantity} x ${product?.name || 'Product'} to basket!`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!image) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <CardContent>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Portrait Not Found</h1>
            <p className="text-gray-600 mb-6">
              The portrait you're looking for doesn't exist or has been removed.
            </p>
            <Link href="/">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                Explore Our Gallery
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const productInfo = getImageProductInfo();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2 text-purple-600 hover:text-purple-700">
                <ArrowLeft className="w-4 h-4" />
                <span className="font-medium">Back to Gallery</span>
              </Link>
            </div>
            <div className="flex items-center space-x-2">
              <Heart className="w-6 h-6 text-purple-600" />
              <span className="text-xl font-bold text-gray-900">Pawtraits</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image */}
          <div className="space-y-4">
            <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg relative overflow-hidden">
              <Image
                src={image.public_url}
                alt={image.description || image.prompt_text}
                width={600}
                height={600}
                className="w-full h-full object-cover"
              />
              
              {/* Featured badge */}
              {image.is_featured && (
                <Badge className="absolute top-4 left-4 bg-yellow-500 text-white">
                  Featured
                </Badge>
              )}
              
              {/* Rating badge */}
              {image.rating && image.rating > 0 && (
                <Badge className="absolute top-4 right-4 bg-white/90 text-gray-700">
                  ⭐ {image.rating}
                </Badge>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between mb-4">
                <h1 className="text-3xl font-bold text-gray-900">{image.prompt_text}</h1>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLike}
                    className="flex items-center space-x-1"
                  >
                    <Heart className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                    <span className="text-sm">Like</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleShare}
                    className="flex items-center space-x-1"
                  >
                    <Share2 className="w-4 h-4 text-gray-600" />
                    <span className="text-sm">Share</span>
                  </Button>
                </div>
              </div>

              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                {image.description}
              </p>

              {/* Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600 mb-6">
                {image.breed && (
                  <div>
                    <span className="font-medium">Breed:</span> {image.breed.name}
                  </div>
                )}
                {image.theme && (
                  <div>
                    <span className="font-medium">Theme:</span> {image.theme.name}
                  </div>
                )}
                {image.style && (
                  <div>
                    <span className="font-medium">Style:</span> {image.style.name}
                  </div>
                )}
                <div>
                  <span className="font-medium">Created:</span> {new Date(image.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Tags */}
              {image.tags && image.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {image.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Purchase Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Get This Portrait</h3>
              
              <div className="bg-purple-50 p-4 rounded-lg mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Available Products:</span>
                  <span className="font-medium">
                    {productInfo.productCount > 0 ? (
                      <>
                        {productInfo.productCount} option{productInfo.productCount > 1 ? 's' : ''} from{' '}
                        {productInfo.lowestPrice && productInfo.currencySymbol ? 
                          formatPrice(productInfo.lowestPrice, productInfo.currency || 'GBP', productInfo.currencySymbol) : 
                          'Price TBC'
                        }
                      </>
                    ) : (
                      'No products available'
                    )}
                  </span>
                </div>
              </div>

              <Button 
                size="lg"
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                disabled={productInfo.productCount === 0}
                onClick={handleBuyClick}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Buy This Portrait
              </Button>

              <p className="text-xs text-gray-500 mt-2 text-center">
                High-quality prints • Fast shipping • 30-day guarantee
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProductSelectionModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        image={image}
        products={products}
        pricing={pricing}
        onAddToBasket={handleAddToBasket}
      />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        image={image}
        onShare={handleShareComplete}
      />
    </div>
  );
}