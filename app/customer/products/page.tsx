'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Package, Loader2 } from 'lucide-react';
import { SupabaseService } from '@/lib/supabase';
import type { Product, ProductPricing, Format, Media } from '@/lib/product-types';
import { formatPrice } from '@/lib/product-types';
import { useCountryPricing } from '@/lib/country-context';

interface ExtendedMedia extends Media {
  description?: string;
  material_type?: string;
  finish_type?: string;
  thickness_mm?: number;
  indoor_outdoor?: 'indoor' | 'outdoor' | 'both';
  uv_resistant?: boolean;
  water_resistant?: boolean;
  care_instructions?: string;
}

interface ProductWithDetails extends Product {
  media: ExtendedMedia;
  formats: Format;
  pricing?: ProductPricing[];
}

export default function CustomerProductsPage() {
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mediumFilter, setMediumFilter] = useState('all-mediums');
  const [formatFilter, setFormatFilter] = useState('all-formats');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const supabaseService = new SupabaseService();
  const { selectedCountry, getCountryPricing, selectedCountryData } = useCountryPricing();

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user for API authentication
      const { data: { user } } = await supabaseService.getClient().auth.getUser();
      if (!user?.email) {
        setError('Authentication required. Please log in.');
        return;
      }

      // First, get all products using existing SupabaseService method
      const allProducts = await supabaseService.getPublicProducts();
      const allPricing = await supabaseService.getPublicProductPricing();
      
      if (!allProducts || allProducts.length === 0) {
        setProducts([]);
        return;
      }

      // Filter for active products only
      const activeProducts = allProducts.filter(p => p.is_active);
      
      // For each product, fetch detailed information using our new API endpoint
      const detailedProducts: ProductWithDetails[] = [];
      
      for (const product of activeProducts) {
        try {
          const response = await fetch(`/api/shop/products/${product.id}?email=${encodeURIComponent(user.email)}`);
          
          if (response.ok) {
            const detailedProduct = await response.json();
            
            // Add pricing information
            const productPricing = allPricing?.filter(p => p.product_id === product.id) || [];
            
            detailedProducts.push({
              ...detailedProduct,
              pricing: productPricing
            });
          } else {
            // Fallback: use original product data without detailed media info
            console.warn(`Failed to fetch details for product ${product.id}, using basic product data`);
            
            // Add pricing information to basic product
            const productPricing = allPricing?.filter(p => p.product_id === product.id) || [];
            
            // Use basic product data with empty media object
            detailedProducts.push({
              ...product,
              media: {
                id: '',
                name: 'Unknown Medium',
                category: '',
              },
              formats: {
                id: '',
                name: 'Unknown Format',
              },
              pricing: productPricing
            });
          }
        } catch (error) {
          console.error(`Error fetching product details for ${product.id}:`, error);
          
          // Fallback: use original product data
          const productPricing = allPricing?.filter(p => p.product_id === product.id) || [];
          
          detailedProducts.push({
            ...product,
            media: {
              id: '',
              name: 'Unknown Medium', 
              category: '',
            },
            formats: {
              id: '',
              name: 'Unknown Format',
            },
            pricing: productPricing
          });
        }
      }

      setProducts(detailedProducts);
    } catch (error) {
      console.error('Error loading products:', error);
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getProductPrice = (product: ProductWithDetails) => {
    if (!product.pricing || product.pricing.length === 0) {
      return { price: null, currency: null, symbol: null };
    }

    const countryPricing = getCountryPricing(product.pricing);
    if (countryPricing.length === 0) {
      // Fallback to first available pricing
      const fallbackPricing = product.pricing[0];
      return {
        price: fallbackPricing.sale_price,
        currency: fallbackPricing.currency_code,
        symbol: fallbackPricing.currency_symbol
      };
    }

    const pricing = countryPricing[0];
    return {
      price: pricing.sale_price,
      currency: pricing.currency_code,
      symbol: pricing.currency_symbol
    };
  };

  // Filter and sort products
  const filteredAndSortedProducts = products
    .filter(product => {
      // Search filter
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        return (
          product.name?.toLowerCase().includes(searchLower) ||
          product.sku?.toLowerCase().includes(searchLower) ||
          product.media?.name?.toLowerCase().includes(searchLower) ||
          product.formats?.name?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .filter(product => {
      // Medium filter
      if (mediumFilter && mediumFilter !== 'all-mediums' && product.media?.id !== mediumFilter) return false;
      // Format filter
      if (formatFilter && formatFilter !== 'all-formats' && product.formats?.id !== formatFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'price':
          const aPricing = getProductPrice(a);
          const bPricing = getProductPrice(b);
          aVal = aPricing.price || 0;
          bVal = bPricing.price || 0;
          break;
        case 'medium':
          aVal = a.media?.name || '';
          bVal = b.media?.name || '';
          break;
        case 'size':
          aVal = `${a.width_cm}x${a.height_cm}`;
          bVal = `${b.width_cm}x${b.height_cm}`;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

  // Get unique media and format options for filters
  const availableMedia = [...new Map(products.map(p => [p.media?.id, p.media]).filter(([id, media]) => id && media)).values()];
  const availableFormats = [...new Map(products.map(p => [p.formats?.id, p.formats]).filter(([id, format]) => id && format)).values()];

  const clearFilters = () => {
    setSearchTerm('');
    setMediumFilter('all-mediums');
    setFormatFilter('all-formats');
    setSortBy('name');
    setSortOrder('asc');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Products</h1>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
              <p className="text-gray-600">Loading products...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Products</h1>
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Package className="w-12 h-12 text-red-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Error Loading Products</h2>
              <p className="text-gray-600 mb-8">{error}</p>
              <Button 
                onClick={loadProducts}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600 mt-1">
              Browse our available print products for your AI pet portraits
            </p>
            {selectedCountryData && (
              <p className="text-sm text-gray-500 mt-1">
                Showing prices for {selectedCountryData.name} ({selectedCountryData.currency_code})
              </p>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Medium Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Medium Type</label>
                <Select value={mediumFilter} onValueChange={setMediumFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All mediums" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-mediums">All mediums</SelectItem>
                    {availableMedia.map(medium => (
                      <SelectItem key={medium.id} value={medium.id}>
                        {medium.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Format Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Format</label>
                <Select value={formatFilter} onValueChange={setFormatFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All formats" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-formats">All formats</SelectItem>
                    {availableFormats.map(format => (
                      <SelectItem key={format.id} value={format.id}>
                        {format.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium mb-2">Sort By</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Sort Order Toggle */}
            <div className="mt-4 flex items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="flex items-center"
              >
                Sort {sortOrder === 'asc' ? '↑' : '↓'} {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {filteredAndSortedProducts.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Package className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Products Found</h2>
              <p className="text-gray-600 mb-8">
                {searchTerm || (mediumFilter && mediumFilter !== 'all-mediums') || (formatFilter && formatFilter !== 'all-formats') 
                  ? 'Try adjusting your search or filter criteria'
                  : 'No products are currently available'
                }
              </p>
              {(searchTerm || (mediumFilter && mediumFilter !== 'all-mediums') || (formatFilter && formatFilter !== 'all-formats')) && (
                <Button onClick={clearFilters} variant="outline">
                  Clear all filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Results count */}
            <div className="text-center text-gray-600">
              Showing {filteredAndSortedProducts.length} of {products.length} products
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedProducts.map((product) => {
                const pricing = getProductPrice(product);
                
                return (
                  <Card key={product.id} className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
                    <CardContent className="p-6 space-y-4">{/* Added more padding and spacing */}
                      {/* Featured badge at top */}
                      {product.is_featured && (
                        <div className="flex justify-end">
                          <Badge className="bg-yellow-500 text-white">
                            Featured
                          </Badge>
                        </div>
                      )}
                      {/* Product Info */}
                      <div>
                        <h3 className="font-semibold text-gray-900 line-clamp-2">
                          {product.name || `${product.size_name} ${product.formats?.name} ${product.media?.name}`.trim()}
                        </h3>
                        
                        {/* Media Description */}
                        {product.media?.description && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                            {product.media.description}
                          </p>
                        )}
                        
                        <div className="mt-3 space-y-2 text-sm text-gray-600">
                          {/* Basic Product Info */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-gray-500">Size:</span>
                              <span className="ml-1 font-medium">
                                {product.size_name || `${product.width_cm}×${product.height_cm}cm`}
                              </span>
                            </div>
                            
                            <div>
                              <span className="text-gray-500">Format:</span>
                              <span className="ml-1 font-medium">{product.formats?.name}</span>
                            </div>
                          </div>

                          {/* Material Properties */}
                          <div className="pt-2 border-t border-gray-100">
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">MATERIAL DETAILS</h4>
                            <div className="grid grid-cols-1 gap-1">
                              {product.media?.material_type && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Material:</span>
                                  <span className="font-medium capitalize">{product.media.material_type}</span>
                                </div>
                              )}
                              
                              {product.media?.finish_type && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Finish:</span>
                                  <span className="font-medium capitalize">{product.media.finish_type}</span>
                                </div>
                              )}
                              
                              {product.media?.thickness_mm && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Thickness:</span>
                                  <span className="font-medium">{product.media.thickness_mm}mm</span>
                                </div>
                              )}
                              
                              {product.media?.indoor_outdoor && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Use:</span>
                                  <span className="font-medium capitalize">
                                    {product.media.indoor_outdoor === 'both' ? 'Indoor & Outdoor' : product.media.indoor_outdoor}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Durability Features */}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {product.media?.uv_resistant && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                  UV Resistant
                                </Badge>
                              )}
                              {product.media?.water_resistant && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                                  Water Resistant
                                </Badge>
                              )}
                              {product.media?.indoor_outdoor === 'both' && (
                                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                                  Indoor & Outdoor
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Care Instructions */}
                          {product.media?.care_instructions && (
                            <div className="pt-2 border-t border-gray-100">
                              <h4 className="text-xs font-semibold text-gray-700 mb-1">CARE INSTRUCTIONS</h4>
                              <p className="text-xs text-gray-600 leading-relaxed">
                                {product.media.care_instructions}
                              </p>
                            </div>
                          )}
                          
                        </div>
                      </div>

                      {/* Pricing */}
                      <div className="pt-3 border-t">
                        {pricing.price ? (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">
                              {formatPrice(pricing.price, pricing.currency || 'GBP', pricing.symbol)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {pricing.currency || 'GBP'}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-gray-500">
                            <div className="text-lg font-semibold">Price TBC</div>
                            <div className="text-sm">Contact for pricing</div>
                          </div>
                        )}
                      </div>

                      {/* Stock status */}
                      <div className="flex justify-center">
                        <Badge className={
                          product.stock_status === 'in_stock' ? 'bg-green-100 text-green-800' :
                          product.stock_status === 'low_stock' ? 'bg-yellow-100 text-yellow-800' :
                          product.stock_status === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {product.stock_status?.replace('_', ' ') || 'Available'}
                        </Badge>
                      </div>

                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}