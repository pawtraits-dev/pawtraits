'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download, ShoppingCart, Check, Printer } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useHybridCart } from '@/lib/hybrid-cart-context';
import type { Product, ProductPricing } from '@/lib/product-types';
import { formatPrice } from '@/lib/product-types';

interface CustomImage {
  id: string;
  generated_image_url: string;
  share_token: string;
  status: string;
  catalog_image_id: string;
  pet_id: string | null;
}

interface CatalogImage {
  id: string;
  description: string;
  imageUrl: string;
  format?: { id: string; name: string; aspectRatio: string };
}

export default function CustomPortraitPurchasePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { addToCart } = useHybridCart();
  const customImageId = params.id as string;

  const [customImage, setCustomImage] = useState<CustomImage | null>(null);
  const [catalogImage, setCatalogImage] = useState<CatalogImage | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [purchasingDigital, setPurchasingDigital] = useState(false);

  useEffect(() => {
    loadData();
  }, [customImageId]);

  async function loadData() {
    try {
      setLoading(true);

      // Load custom image
      const customRes = await fetch(`/api/customers/custom-images/${customImageId}`, {
        credentials: 'include'
      });

      if (!customRes.ok) {
        throw new Error('Custom portrait not found');
      }

      const customData = await customRes.json();
      setCustomImage(customData);

      // Load catalog image to get format
      const catalogRes = await fetch(`/api/public/catalog-images/${customData.catalog_image_id}`);
      if (catalogRes.ok) {
        const catalogData = await catalogRes.json();
        setCatalogImage(catalogData);

        // Load products for this format
        if (catalogData.format?.id) {
          await loadProducts(catalogData.format.id);
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts(formatId: string) {
    try {
      const productsRes = await fetch(`/api/shop/products?formatId=${formatId}`);
      const pricingRes = await fetch(`/api/shop/pricing?formatId=${formatId}`);

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData.products || []);
      }

      if (pricingRes.ok) {
        const pricingData = await pricingRes.json();
        setPricing(pricingData.pricing || []);
      }
    } catch (err) {
      console.error('Error loading products:', err);
    }
  }

  function getProductPricing(product: Product): ProductPricing | null {
    return pricing.find(p => p.product_id === product.id) || null;
  }

  async function handleAddToCart(product: Product) {
    if (!customImage || !catalogImage) return;

    const productPricing = getProductPricing(product);
    if (!productPricing) {
      toast({
        title: 'Pricing error',
        description: 'Could not load pricing for this product',
        variant: 'destructive'
      });
      return;
    }

    setAddingToCart(true);

    try {
      // CRITICAL: Use custom image URL and ID, not catalog image
      await addToCart({
        productId: product.id,
        imageId: customImage.id, // Custom image ID
        imageUrl: customImage.generated_image_url, // Custom image URL
        imageTitle: catalogImage.description + ' (Custom Portrait)',
        product,
        pricing: productPricing,
        quantity: 1,
      });

      toast({
        title: 'Added to cart!',
        description: `${product.media_name} ${product.width_cm}×${product.height_cm}cm added to cart`
      });

      // Navigate to cart
      router.push('/shop/cart');
    } catch (err) {
      console.error('Add to cart error:', err);
      toast({
        title: 'Failed to add to cart',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setAddingToCart(false);
    }
  }

  async function handlePurchaseDigital() {
    if (!customImage) return;

    setPurchasingDigital(true);

    try {
      const response = await fetch('/api/shop/custom-portrait/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customImageId: customImage.id,
          catalogImageId: customImage.catalog_image_id
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create checkout');
      }

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error('Purchase error:', err);
      toast({
        title: 'Purchase failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive'
      });
      setPurchasingDigital(false);
    }
  }

  const getAspectRatioStyle = (aspectRatio?: string) => {
    if (!aspectRatio) return { aspectRatio: '1 / 1' };
    return { aspectRatio: aspectRatio.replace(':', ' / ') };
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error || !customImage) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>{error || 'Custom portrait not found'}</AlertDescription>
        </Alert>
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  // Group products by media type
  const productsByMedia = products.reduce((acc, product) => {
    const media = product.media_name || 'Other';
    if (!acc[media]) acc[media] = [];
    acc[media].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Purchase Your Custom Portrait</h1>
          <p className="text-gray-600 mt-1">
            Choose digital download or select a print product
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Portrait Preview */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Your Custom Portrait</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="relative w-full rounded-lg overflow-hidden bg-gray-100"
                style={getAspectRatioStyle(catalogImage?.format?.aspectRatio)}
              >
                <Image
                  src={customImage.generated_image_url}
                  alt="Custom portrait"
                  fill
                  className="object-contain"
                />
                <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-xs">
                  Preview • Watermarked
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Purchase Options */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="digital" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="digital">
                <Download className="w-4 h-4 mr-2" />
                Digital Download
              </TabsTrigger>
              <TabsTrigger value="prints">
                <Printer className="w-4 h-4 mr-2" />
                Physical Prints
              </TabsTrigger>
            </TabsList>

            <TabsContent value="digital" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Digital Download - High Resolution</CardTitle>
                  <p className="text-sm text-gray-600 mt-2">
                    Perfect for sharing online or printing at home
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-semibold text-gray-900">Custom Portrait</span>
                      <span className="text-2xl font-bold text-blue-600">£9.99</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      One-time purchase • Instant download
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900">What's included:</h4>
                    <ul className="space-y-2">
                      {[
                        'High-resolution image (4K quality)',
                        'No watermark',
                        'Instant download after purchase',
                        'Perfect for printing or sharing',
                        'Lifetime access to your download'
                      ].map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    onClick={handlePurchaseDigital}
                    disabled={purchasingDigital}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    size="lg"
                  >
                    {purchasingDigital ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Buy Digital Download - £9.99
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-gray-500 text-center">
                    Secure checkout powered by Stripe
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prints" className="space-y-4 mt-6">
              {Object.keys(productsByMedia).length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(productsByMedia).map(([media, mediaProducts]) => (
                    <Card key={media}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Printer className="w-5 h-5" />
                          {media}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {mediaProducts.map((product) => {
                            const productPricing = getProductPricing(product);
                            return (
                              <div
                                key={product.id}
                                className="border rounded-lg p-4 hover:border-purple-300 transition-colors"
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <h4 className="font-semibold text-gray-900">
                                      {product.width_cm} × {product.height_cm} cm
                                    </h4>
                                    <p className="text-sm text-gray-600">{product.media_description}</p>
                                  </div>
                                  {productPricing && (
                                    <span className="text-lg font-bold text-purple-600">
                                      {formatPrice(productPricing.retail_price, productPricing.currency_code)}
                                    </span>
                                  )}
                                </div>
                                <Button
                                  onClick={() => handleAddToCart(product)}
                                  disabled={!productPricing || addingToCart}
                                  className="w-full mt-2"
                                  variant="outline"
                                >
                                  {addingToCart ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                                      Adding...
                                    </>
                                  ) : (
                                    <>
                                      <ShoppingCart className="w-4 h-4 mr-2" />
                                      Add to Cart
                                    </>
                                  )}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    No print products available for this format yet. Choose digital download or contact support.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
