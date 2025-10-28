'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Sparkles, Star, Package } from 'lucide-react';
import Link from 'next/link';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider, useCountryPricing } from '@/lib/country-context';
import type { Product, ProductPricing } from '@/lib/product-types';
import { formatPrice, formatProductDimensions } from '@/lib/product-types';

interface Medium {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  material_type: string | null;
  finish_type: string | null;
  category: string | null;
  display_order: number;
  preview_image_url: string | null;
  is_active: boolean;
}

// Brand-voice product descriptions by medium type
const getMediumDescription = (mediumName: string, mediumDescription?: string | null): string => {
  const descriptions: Record<string, string> = {
    'Canvas': "Museum-quality canvas that makes your walls significantly more interesting. Professional-grade material that'll have guests asking 'Wait, where did you get that?!' Pro tip: It came from your VIP's personal art collection, naturally.",
    'Framed Print': "Classic framed prints ready to hang and impress. Premium frames that say 'Yes, my pet has their own art collection' without you having to say a word. Because your furry friend deserves gallery-level presentation.",
    'Framed Canvas': "The best of both worlds—canvas texture meets ready-to-hang convenience. Think luxury spa vibes meets contemporary art gallery. Your pet's masterpiece deserves this level of sophistication.",
    'Acrylic': "Sleek, modern acrylic prints with a gallery-worthy glossy finish. The kind of high-end look that makes people think you have an interior designer (you do—it's your pet). Ultra-contemporary and seriously impressive.",
    'Metal Print': "Bold, durable metal prints that bring serious wow-factor. Industrial-chic meets fine art. Perfect for pet parents who appreciate modern aesthetics and want something truly unique on their walls.",
    'Poster': "High-quality paper prints that are budget-friendly but never cheap-looking. Perfect for trying out different looks or filling multiple rooms with your pet's artistic portfolio. Pawcasso approves this economical choice.",
    'Wood Print': "Rustic charm meets modern printing technology. Each piece is unique thanks to natural wood grain variations. Your pet's portrait gets that warm, organic feel that makes any space cozier."
  };

  // Check for exact match
  if (descriptions[mediumName]) {
    return descriptions[mediumName];
  }

  // Check for partial match
  for (const [key, desc] of Object.entries(descriptions)) {
    if (mediumName.toLowerCase().includes(key.toLowerCase())) {
      return desc;
    }
  }

  // Fallback to database description or generic
  return mediumDescription || `Premium ${mediumName.toLowerCase()} prints that bring your pet's portrait to life. Professional quality that'll make your walls proud and your pet even prouder.`;
};

function ProductsPageContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [media, setMedia] = useState<Medium[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedCountry, getCountryPricing } = useCountryPricing();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [productsRes, pricingRes, mediaRes] = await Promise.all([
        fetch('/api/public/products'),
        fetch('/api/public/pricing'),
        fetch('/api/public/media')
      ]);

      if (productsRes.ok && pricingRes.ok && mediaRes.ok) {
        const [productsData, pricingData, mediaData] = await Promise.all([
          productsRes.json(),
          pricingRes.json(),
          mediaRes.json()
        ]);

        setProducts(productsData || []);
        setPricing(pricingData || []);
        setMedia((mediaData || []).sort((a: Medium, b: Medium) => a.display_order - b.display_order));
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group products by medium
  const groupedProducts = media
    .filter(medium => medium.is_active)
    .map(medium => ({
      medium,
      products: products
        .filter(p => p.medium.id === medium.id && p.is_active)
        .sort((a, b) => {
          // Sort featured first, then by price
          if (a.is_featured && !b.is_featured) return -1;
          if (!a.is_featured && b.is_featured) return 1;

          const countryPricing = getCountryPricing(pricing);
          const priceA = countryPricing.find(p => p.product_id === a.id)?.sale_price || 0;
          const priceB = countryPricing.find(p => p.product_id === b.id)?.sale_price || 0;
          return priceA - priceB;
        })
    }))
    .filter(group => group.products.length > 0);

  const getProductPricing = (productId: string) => {
    return getCountryPricing(pricing).find(p => p.product_id === productId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading our premium collection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <UserAwareNavigation />

      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-r from-purple-600 to-blue-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <Package className="w-16 h-16" />
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 font-[family-name:var(--font-life-savers)]">
              Our Premium Print Collection
            </h1>
            <p className="text-xl lg:text-2xl mb-8 max-w-3xl mx-auto opacity-90">
              From museum-quality canvas to sleek acrylics, every option is Pawcasso-approved. Choose the perfect medium to showcase your pet's artistic masterpiece.
            </p>
            <Link href="/shop">
              <Button
                size="lg"
                className="bg-white text-purple-600 hover:bg-gray-100 shadow-lg text-lg px-8 py-4"
              >
                <Sparkles className="w-6 h-6 mr-2" />
                Start Shopping
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Products by Medium */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-16">
            {groupedProducts.map(({ medium, products: mediumProducts }) => (
              <div key={medium.id} className="space-y-6">
                {/* Medium Header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                    <Star className="w-8 h-8 text-purple-600" />
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-life-savers)]">
                    {medium.name}
                  </h2>
                  <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                    {getMediumDescription(medium.name, medium.description)}
                  </p>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {mediumProducts.map(product => {
                    const productPricing = getProductPricing(product.id);
                    if (!productPricing) return null;

                    return (
                      <Card
                        key={product.id}
                        className="relative overflow-hidden hover:shadow-xl transition-shadow group"
                      >
                        {/* Product Image Placeholder */}
                        <div className="aspect-square bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                          <div className="text-center p-8">
                            <Package className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                            <p className="text-sm text-purple-600 font-medium">
                              {product.format.name} Format
                            </p>
                          </div>
                        </div>

                        <CardContent className="p-6">
                          {/* Product Name & Details */}
                          <div className="mb-4">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-bold text-lg text-gray-900 flex-1">
                                {product.size_name}
                              </h3>
                              {product.is_featured && (
                                <Badge
                                  variant="secondary"
                                  className="bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 text-xs ml-2"
                                >
                                  ⭐ Popular
                                </Badge>
                              )}
                            </div>

                            {/* Dimensions */}
                            <p className="text-sm text-gray-600 mb-2">
                              {formatProductDimensions(product)}
                            </p>

                            {/* Format */}
                            <p className="text-xs text-gray-500">
                              {product.format.name} • {medium.name}
                            </p>
                          </div>

                          {/* Price */}
                          <div className="mb-4">
                            <div className="text-2xl font-bold text-purple-600">
                              {formatPrice(
                                productPricing.sale_price,
                                productPricing.currency_code,
                                productPricing.currency_symbol
                              )}
                            </div>
                            {productPricing.is_on_sale && productPricing.discount_price && (
                              <div className="text-sm text-gray-500 line-through">
                                {formatPrice(
                                  productPricing.discount_price,
                                  productPricing.currency_code,
                                  productPricing.currency_symbol
                                )}
                              </div>
                            )}
                          </div>

                          {/* CTA */}
                          <Link href="/shop">
                            <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              Shop Now
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {groupedProducts.length === 0 && (
            <div className="text-center py-16">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No products available at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6 font-[family-name:var(--font-life-savers)]">
            Ready to Find Your Perfect Portrait?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Browse Pawcasso's gallery of thousands of AI-generated masterpieces, or create your own custom portrait in just 90 seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/shop">
              <Button
                size="lg"
                className="bg-white text-purple-600 hover:bg-gray-100 shadow-lg text-lg px-8 py-4"
              >
                <Sparkles className="w-6 h-6 mr-2" />
                Browse Gallery
              </Button>
            </Link>
            <Link href="/signup/user">
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-purple-600 text-lg px-8 py-4"
              >
                Create Custom Portrait
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <CountryProvider>
      <ProductsPageContent />
    </CountryProvider>
  );
}
