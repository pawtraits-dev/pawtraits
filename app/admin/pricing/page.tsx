'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  PoundSterling,
  TrendingUp,
  Globe,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { createGelatoService } from '@/lib/gelato-service';
import { PawSpinner } from '@/components/ui/paw-spinner';
import type { Product, ProductPricing, ProductPricingCreate, Country } from '@/lib/product-types';
import { formatPrice, calculateProfitMargin, calculateMarkup } from '@/lib/product-types';

interface PricingFormData {
  product_id: string;
  country_code: string;
  currency_code: string;
  product_cost: string;
  shipping_cost: string;
  sale_price: string;
  retail_price: string;
  discount_price: string;
  is_on_sale: boolean;
  sale_start_date: string;
  sale_end_date: string;
}

export default function PricingManagementPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [loadingGelatoPricing, setLoadingGelatoPricing] = useState(false);
  const [selectedPricingIds, setSelectedPricingIds] = useState<string[]>([]);
  const [targetMargin, setTargetMargin] = useState(70);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [editingPrices, setEditingPrices] = useState<{[key: string]: {original: number, current: number}}>({});
  
  const [formData, setFormData] = useState<PricingFormData>({
    product_id: '',
    country_code: 'GB',
    currency_code: 'GBP',
    product_cost: '',
    shipping_cost: '0',
    sale_price: '',
    retail_price: '',
    discount_price: '',
    is_on_sale: false,
    sale_start_date: '',
    sale_end_date: ''
  });

  const supabaseService = new AdminSupabaseService();

  // Pricing calculation functions
  const roundToNearest250 = (price: number): number => {
    return Math.round(price / 2.5) * 2.5;
  };

  const calculateRetailPriceWith70Margin = (totalCost: number): number => {
    // For 70% margin: Sale Price = Cost / (1 - 0.70) = Cost / 0.30
    const retailPrice = totalCost / 0.30;
    return roundToNearest250(retailPrice);
  };

  const calculateMarginFromPrices = (cost: number, salePrice: number): number => {
    if (salePrice <= 0) return 0;
    return ((salePrice - cost) / salePrice) * 100;
  };

  // Auto-calculate retail price when costs change
  const updateRetailPrice = (productCost: string, shippingCost: string) => {
    const cost = parseFloat(productCost || '0');
    const shipping = parseFloat(shippingCost || '0');
    const totalCost = cost + shipping;
    
    if (totalCost > 0) {
      const calculatedRetailPrice = calculateRetailPriceWith70Margin(totalCost);
      setFormData(prev => ({
        ...prev,
        retail_price: calculatedRetailPrice.toFixed(2)
      }));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsData, pricingData, countriesData] = await Promise.all([
        supabaseService.getProducts(),
        supabaseService.getAllProductPricing(),
        supabaseService.getCountries()
      ]);
      
      setProducts(productsData || []);
      setPricing(pricingData || []);
      setCountries(countriesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      product_id: '',
      country_code: 'GB',
      currency_code: 'GBP',
      product_cost: '',
      shipping_cost: '0',
      sale_price: '',
      retail_price: '',
      discount_price: '',
      is_on_sale: false,
      sale_start_date: '',
      sale_end_date: ''
    });
  };

  const handleEdit = (pricingItem: ProductPricing) => {
    setFormData({
      product_id: pricingItem.product_id,
      country_code: pricingItem.country_code,
      currency_code: pricingItem.currency_code,
      product_cost: (pricingItem.product_cost / 100).toString(),
      shipping_cost: (pricingItem.shipping_cost / 100).toString(),
      sale_price: (pricingItem.sale_price / 100).toString(),
      discount_price: pricingItem.discount_price ? (pricingItem.discount_price / 100).toString() : '',
      is_on_sale: pricingItem.is_on_sale,
      sale_start_date: pricingItem.sale_start_date ? pricingItem.sale_start_date.split('T')[0] : '',
      sale_end_date: pricingItem.sale_end_date ? pricingItem.sale_end_date.split('T')[0] : ''
    });
    setEditingId(pricingItem.id);
    setShowAddForm(false);
  };

  const handleCountryChange = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode);
    setFormData(prev => ({
      ...prev,
      country_code: countryCode,
      currency_code: country?.currency_code || 'GBP'
    }));
    
    // Auto-fetch Gelato pricing if both product and country are selected
    if (formData.product_id) {
      fetchGelatoPricing(formData.product_id, countryCode);
    }
  };

  const handleProductChange = (productId: string) => {
    setFormData(prev => ({ ...prev, product_id: productId }));
    
    // Auto-fetch Gelato pricing if both product and country are selected
    if (formData.country_code) {
      fetchGelatoPricing(productId, formData.country_code);
    }
  };

  const fetchGelatoPricing = async (productId: string, countryCode: string, existingPricingId?: string) => {
    const product = products.find(p => p.id === productId);
    const country = countries.find(c => c.code === countryCode);
    
    if (!product?.gelato_sku || !country) {
      console.log('Missing Gelato SKU or country data');
      return;
    }

    try {
      setLoadingGelatoPricing(true);
      console.log(`🔍 Fetching Gelato pricing for ${product.name} in ${country.name}...`);
      
      const gelatoService = createGelatoService();
      
      // Get product pricing (base cost)
      const baseCost = await gelatoService.getBaseCost(product.gelato_sku, countryCode);
      
      // Get shipping methods to estimate shipping cost
      const shippingMethods = await gelatoService.getShippingMethods(countryCode);
      
      if (baseCost) {
        console.log(`✅ Gelato base cost: ${baseCost.currency} ${baseCost.price}`);
        
        // Convert USD to local currency if needed (same logic as in products page)
        let convertedCost = baseCost.price;
        if (baseCost.currency === 'USD' && country.currency_code !== 'USD') {
          // Simple conversion rates (same as in products page)
          const conversionRates: Record<string, number> = {
            'GBP': 0.79, 'EUR': 0.92, 'CAD': 1.35, 'AUD': 1.52,
            'JPY': 149.5, 'SGD': 1.34, 'BRL': 5.02, 'CHF': 0.88,
            'NZD': 1.64, 'SEK': 10.5, 'NOK': 10.8, 'DKK': 6.85,
            'ISK': 138.2, 'PLN': 4.03, 'CZK': 22.7, 'HUF': 361.0,
            'KRW': 1320, 'HKD': 7.81, 'MYR': 4.48, 'THB': 35.8,
            'INR': 83.2, 'MXN': 17.1, 'ZAR': 18.4, 'TRY': 30.5,
          };
          
          const rate = conversionRates[country.currency_code];
          if (rate) {
            convertedCost = baseCost.price * rate;
            console.log(`💱 Converted ${baseCost.price} USD to ${convertedCost.toFixed(2)} ${country.currency_code}`);
          }
        }
        
        // Estimate shipping cost (use cheapest available method or default)
        let estimatedShipping = 0;
        if (shippingMethods && shippingMethods.length > 0) {
          // Find the cheapest shipping method
          const cheapestShipping = shippingMethods.reduce((cheapest, method) => {
            return method.price < cheapest.price ? method : cheapest;
          }, shippingMethods[0]);
          
          estimatedShipping = cheapestShipping.price || 0;
          console.log(`📦 Estimated shipping: ${country.currency_code} ${estimatedShipping}`);
        }
        
        // Update form with fetched costs if in form mode, or update existing pricing if refreshing
        const roundedProductCost = (Math.round(convertedCost * 100) / 100);
        const roundedShippingCost = (Math.round(estimatedShipping * 100) / 100);
        
        if (existingPricingId) {
          // Update existing pricing entry
          try {
            await supabaseService.updateProductPricing(existingPricingId, {
              product_cost: Math.round(roundedProductCost * 100),
              shipping_cost: Math.round(roundedShippingCost * 100)
            });
            console.log(`✅ Updated pricing for ${product.name} in ${country.name}`);
          } catch (error) {
            console.error('Failed to update pricing with Gelato costs:', error);
            throw error;
          }
        } else {
          // Update form for new pricing
          setFormData(prev => ({
            ...prev,
            product_cost: roundedProductCost.toString(),
            shipping_cost: roundedShippingCost.toString()
          }));
          
          // Auto-calculate retail price with 70% margin
          updateRetailPrice(roundedProductCost.toString(), roundedShippingCost.toString());
          
          console.log(`✅ Auto-populated pricing for ${product.name} in ${country.name}`);
        }
      } else {
        console.warn(`⚠️ No Gelato pricing found for ${product.gelato_sku} in ${countryCode}`);
      }
    } catch (error) {
      console.error('❌ Error fetching Gelato pricing:', error);
    } finally {
      setLoadingGelatoPricing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.product_id || !formData.product_cost || !formData.sale_price) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const pricingData: ProductPricingCreate = {
        product_id: formData.product_id,
        country_code: formData.country_code,
        product_cost: Math.round(parseFloat(formData.product_cost) * 100), // Convert to minor units
        shipping_cost: Math.round(parseFloat(formData.shipping_cost || '0') * 100),
        sale_price: Math.round(parseFloat(formData.sale_price) * 100),
        discount_price: formData.discount_price ? Math.round(parseFloat(formData.discount_price) * 100) : undefined,
        is_on_sale: formData.is_on_sale,
        sale_start_date: formData.sale_start_date || undefined,
        sale_end_date: formData.sale_end_date || undefined
      };

      if (editingId) {
        await supabaseService.updateProductPricing(editingId, pricingData);
      } else {
        await supabaseService.createProductPricing(pricingData);
      }

      await loadData();
      resetForm();
      setEditingId(null);
      setShowAddForm(false);
    } catch (error) {
      console.error('Error saving pricing:', error);
      alert('Failed to save pricing');
    }
  };

  const handleDelete = async (id: string, productName: string, countryCode: string) => {
    if (!confirm(`Are you sure you want to delete pricing for "${productName}" in ${countryCode}?`)) {
      return;
    }

    try {
      await supabaseService.deleteProductPricing(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting pricing:', error);
      alert('Failed to delete pricing');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowAddForm(false);
    resetForm();
  };

  const getMarginCalculations = () => {
    if (!formData.product_cost) return null;
    
    const cost = parseFloat(formData.product_cost) + parseFloat(formData.shipping_cost || '0');
    const salePrice = parseFloat(formData.sale_price || '0');
    const retailPrice = parseFloat(formData.retail_price || '0');
    
    const calculations: any = {};
    
    // Sale price calculations (if entered)
    if (salePrice > 0) {
      calculations.sale = {
        profitMargin: calculateMarginFromPrices(cost, salePrice),
        markup: calculateMarkup(cost * 100, salePrice * 100),
        profit: salePrice - cost
      };
    }
    
    // Retail price calculations (if entered)
    if (retailPrice > 0) {
      calculations.retail = {
        profitMargin: calculateMarginFromPrices(cost, retailPrice),
        markup: calculateMarkup(cost * 100, retailPrice * 100),
        profit: retailPrice - cost
      };
    }
    
    calculations.totalCost = cost;
    return calculations;
  };

  // Filter pricing
  const filteredPricing = pricing.filter(pricingItem => {
    const product = products.find(p => p.id === pricingItem.product_id);
    const matchesSearch = !searchTerm || 
      (product?.name && product.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product?.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      pricingItem.country_code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProduct = !productFilter || pricingItem.product_id === productFilter;
    const matchesCountry = !countryFilter || pricingItem.country_code === countryFilter;
    const matchesCurrency = !currencyFilter || pricingItem.currency_code === currencyFilter;
    
    return matchesSearch && matchesProduct && matchesCountry && matchesCurrency;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setProductFilter('');
    setCountryFilter('');
    setCurrencyFilter('');
  };

  // Bulk operations
  const handleBulkPriceUpdate = async () => {
    if (selectedPricingIds.length === 0) return;
    
    const confirmMessage = `Apply ${targetMargin}% margin${discountPercent > 0 ? ` and ${discountPercent}% discount` : ''} to ${selectedPricingIds.length} selected pricing entries?`;
    if (!confirm(confirmMessage)) return;
    
    try {
      for (const pricingId of selectedPricingIds) {
        const pricingItem = pricing.find(p => p.id === pricingId);
        if (!pricingItem) continue;
        
        const totalCost = (pricingItem.product_cost + pricingItem.shipping_cost) / 100; // Convert from minor units
        
        // Calculate retail price with target margin
        const marginDecimal = targetMargin / 100;
        let retailPrice = totalCost / (1 - marginDecimal);
        retailPrice = roundToNearest250(retailPrice);
        
        // Calculate discounted price if discount is specified
        let discountedPrice = undefined;
        if (discountPercent > 0) {
          discountedPrice = retailPrice * (1 - discountPercent / 100);
          discountedPrice = roundToNearest250(discountedPrice);
        }
        
        const updateData = {
          sale_price: Math.round(retailPrice * 100), // Retail price stays as retail price
          discount_price: discountedPrice ? Math.round(discountedPrice * 100) : undefined,
          is_on_sale: discountPercent > 0
        };
        
        await supabaseService.updateProductPricing(pricingId, updateData);
      }
      
      await loadData();
      setSelectedPricingIds([]);
      alert(`Successfully updated ${selectedPricingIds.length} pricing entries`);
    } catch (error) {
      console.error('Error updating bulk pricing:', error);
      alert('Failed to update pricing');
    }
  };
  
  const handleBulkGelatoRefresh = async () => {
    if (selectedPricingIds.length === 0) return;
    
    if (!confirm(`Refresh Gelato pricing for ${selectedPricingIds.length} selected entries? This will update product and shipping costs.`)) return;
    
    setLoadingGelatoPricing(true);
    
    try {
      for (const pricingId of selectedPricingIds) {
        const pricingItem = pricing.find(p => p.id === pricingId);
        if (!pricingItem) continue;
        
        const product = products.find(p => p.id === pricingItem.product_id);
        if (!product?.gelato_sku) continue;
        
        // Fetch updated Gelato pricing using stored gelato_sku
        const gelatoService = createGelatoService();
        
        // Get product pricing (base cost)
        const baseCost = await gelatoService.getBaseCost(product.gelato_sku, pricingItem.country_code);
        
        // Get shipping methods to estimate shipping cost
        const shippingMethods = await gelatoService.getShippingMethods(pricingItem.country_code);
        
        if (baseCost) {
          const country = countries.find(c => c.code === pricingItem.country_code);
          let convertedCost = baseCost.price;
          
          // Convert USD to local currency if needed
          if (baseCost.currency === 'USD' && country?.currency_code !== 'USD') {
            const conversionRates: Record<string, number> = {
              'GBP': 0.79, 'EUR': 0.92, 'CAD': 1.35, 'AUD': 1.52,
              'JPY': 149.5, 'SGD': 1.34, 'BRL': 5.02, 'CHF': 0.88,
              'NZD': 1.64, 'SEK': 10.5, 'NOK': 10.8, 'DKK': 6.85,
              'ISK': 138.2, 'PLN': 4.03, 'CZK': 22.7, 'HUF': 361.0,
              'KRW': 1320, 'HKD': 7.81, 'MYR': 4.48, 'THB': 35.8,
              'INR': 83.2, 'MXN': 17.1, 'ZAR': 18.4, 'TRY': 30.5,
            };
            
            const rate = conversionRates[country.currency_code];
            if (rate) {
              convertedCost = baseCost.price * rate;
            }
          }
          
          // Estimate shipping cost (use cheapest available method)
          let estimatedShipping = 0;
          if (shippingMethods && shippingMethods.length > 0) {
            const cheapestShipping = shippingMethods.reduce((cheapest, method) => {
              return method.price < cheapest.price ? method : cheapest;
            }, shippingMethods[0]);
            estimatedShipping = cheapestShipping.price || 0;
          }
          
          // Update the pricing entry with new costs
          await supabaseService.updateProductPricing(pricingId, {
            product_cost: Math.round(convertedCost * 100), // Convert to minor units
            shipping_cost: Math.round(estimatedShipping * 100)
          });
        }
      }
      
      await loadData();
      setSelectedPricingIds([]);
      alert(`Successfully refreshed ${selectedPricingIds.length} pricing entries`);
    } catch (error) {
      console.error('Error refreshing Gelato pricing:', error);
      alert('Failed to refresh pricing');
    } finally {
      setLoadingGelatoPricing(false);
    }
  };

  const calculations = getMarginCalculations();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <PawSpinner size="xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pricing Management</h1>
          <p className="text-gray-600 mt-2">
            Manage country-specific pricing for products
          </p>
        </div>
        
        <Button
          onClick={() => {
            setShowAddForm(true);
            setEditingId(null);
            resetForm();
          }}
          className="bg-gradient-to-r from-purple-600 to-blue-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Pricing
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search products, SKUs, countries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Row */}
            <div className="flex justify-between items-center">
              <div className="flex space-x-4">
                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Filter by Product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by Country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(country => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name} ({country.currency_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set(countries.map(c => c.currency_code))].sort().map(currency => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button variant="outline" onClick={clearFilters} size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              </div>

              <p className="text-sm text-gray-600">
                Showing {filteredPricing.length} of {pricing.length} pricing entries
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Pricing Controls */}
      <Card className="mb-8 border-2 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Bulk Pricing Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            {/* Target Margin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Margin (%)
              </label>
              <Input
                type="number"
                min="10"
                max="90"
                step="5"
                value={targetMargin}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    setTargetMargin(Math.min(90, Math.max(10, value)));
                  }
                }}
                className="text-center"
              />
            </div>

            {/* Discount Percent */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Discount (%)
              </label>
              <Input
                type="number"
                min="0"
                max="50"
                step="5"
                value={discountPercent}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    setDiscountPercent(Math.min(50, Math.max(0, value)));
                  }
                }}
                className="text-center"
              />
            </div>

            {/* Apply Button */}
            <div>
              <Button
                onClick={handleBulkPriceUpdate}
                disabled={selectedPricingIds.length === 0}
                className="w-full bg-gradient-to-r from-green-600 to-blue-600"
              >
                Apply to Selected ({selectedPricingIds.length})
              </Button>
            </div>

            {/* Refresh Gelato Prices */}
            <div>
              <Button
                onClick={handleBulkGelatoRefresh}
                disabled={selectedPricingIds.length === 0 || loadingGelatoPricing}
                variant="outline"
                className="w-full"
              >
                {loadingGelatoPricing ? (
                  <><PawSpinner size="sm" className="mr-2" />Refreshing...</>
                ) : (
                  <>🔄 Refresh Gelato Prices</>
                )}
              </Button>
            </div>
          </div>

          {/* Selection Info */}
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">
              <strong>Selection:</strong> {selectedPricingIds.length} pricing entries selected
              {selectedPricingIds.length > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setSelectedPricingIds([])}
                  className="ml-2 h-auto p-0 text-xs"
                >
                  Clear Selection
                </Button>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Target margin applies £2.50 rounding. Discount is applied after margin calculation.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Form - Hidden during inline row editing */}
      {showAddForm && (
        <Card className="mb-8 border-2 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center">
              <PoundSterling className="w-5 h-5 mr-2" />
              {editingId ? 'Edit Pricing' : 'Add New Pricing'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product and Location */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Product & Location</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product *
                    </label>
                    <Select 
                      value={formData.product_id} 
                      onValueChange={handleProductChange}
                      disabled={!!editingId || loadingGelatoPricing}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.filter((p: any) => p.is_active).map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{product.name}</span>
                              <span className="text-sm text-gray-500">{product.sku}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country *
                    </label>
                    <Select 
                      value={formData.country_code} 
                      onValueChange={handleCountryChange}
                      disabled={!!editingId || loadingGelatoPricing}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.filter(c => c.is_supported).map(country => (
                          <SelectItem key={country.code} value={country.code}>
                            <div className="flex items-center space-x-2">
                              <span>{country.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {country.currency_symbol} {country.currency_code}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Currency:</strong> {formData.currency_code} 
                      ({countries.find(c => c.code === formData.country_code)?.currency_symbol})
                    </p>
                    {loadingGelatoPricing && (
                      <p className="text-sm text-blue-600 mt-2 flex items-center">
                        <PawSpinner size="sm" className="mr-2" />
                        Fetching Gelato pricing...
                      </p>
                    )}
                  </div>
                </div>

                {/* Pricing Details */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Pricing Details</h3>
                    {!editingId && (
                      <p className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                        💡 Costs auto-populate from Gelato when product + country selected
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Cost * ({formData.currency_code})
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.product_cost}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setFormData(prev => ({ ...prev, product_cost: newValue }));
                        // Auto-update retail price when product cost changes
                        if (newValue && formData.shipping_cost) {
                          setTimeout(() => updateRetailPrice(newValue, formData.shipping_cost), 100);
                        }
                      }}
                      placeholder="15.00"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Shipping Cost ({formData.currency_code})
                      </label>
                      {formData.product_id && formData.country_code && !editingId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fetchGelatoPricing(formData.product_id, formData.country_code)}
                          disabled={loadingGelatoPricing}
                          className="text-xs h-6"
                        >
                          {loadingGelatoPricing ? 'Loading...' : '🔄 Refresh Costs'}
                        </Button>
                      )}
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.shipping_cost}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setFormData(prev => ({ ...prev, shipping_cost: newValue }));
                        // Auto-update retail price when shipping cost changes
                        if (formData.product_cost && newValue) {
                          setTimeout(() => updateRetailPrice(formData.product_cost, newValue), 100);
                        }
                      }}
                      placeholder="5.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sale Price * ({formData.currency_code})
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.sale_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, sale_price: e.target.value }))}
                      placeholder="29.99"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Retail Price ({formData.currency_code})
                      </label>
                      {formData.product_cost && formData.shipping_cost && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateRetailPrice(formData.product_cost, formData.shipping_cost)}
                          className="text-xs h-6"
                        >
                          🎯 Auto-calc 70% margin
                        </Button>
                      )}
                    </div>
                    <Input
                      type="number"
                      step="2.50"
                      value={formData.retail_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, retail_price: e.target.value }))}
                      placeholder="Auto-calculated from costs"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Rounds to nearest £2.50 increments (e.g. 27.50, 30.00, 32.50)
                    </p>
                  </div>

                  {/* Margin Calculations */}
                  {calculations && (
                    <div className="bg-green-50 p-4 rounded-lg space-y-3">
                      <p className="text-sm font-medium text-green-700">Profit Analysis</p>
                      
                      {/* Total Cost Display */}
                      <div className="text-sm">
                        <span className="text-green-600">Total Cost: </span>
                        <span className="font-medium">
                          {countries.find(c => c.code === formData.country_code)?.currency_symbol}
                          {calculations.totalCost.toFixed(2)}
                        </span>
                      </div>

                      {/* Sale Price Analysis */}
                      {calculations.sale && (
                        <div className="border-l-2 border-blue-300 pl-3">
                          <p className="text-xs font-medium text-blue-700 mb-1">Sale Price Analysis:</p>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-blue-600">Profit:</span>
                              <p className="font-medium">
                                {countries.find(c => c.code === formData.country_code)?.currency_symbol}
                                {calculations.sale.profit.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <span className="text-blue-600">Margin:</span>
                              <p className="font-medium">{calculations.sale.profitMargin.toFixed(1)}%</p>
                            </div>
                            <div>
                              <span className="text-blue-600">Markup:</span>
                              <p className="font-medium">{calculations.sale.markup.toFixed(1)}%</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Retail Price Analysis */}
                      {calculations.retail && (
                        <div className="border-l-2 border-purple-300 pl-3">
                          <p className="text-xs font-medium text-purple-700 mb-1">
                            Retail Price Analysis (Target: 70% margin):
                          </p>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-purple-600">Profit:</span>
                              <p className="font-medium">
                                {countries.find(c => c.code === formData.country_code)?.currency_symbol}
                                {calculations.retail.profit.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <span className="text-purple-600">Margin:</span>
                              <p className={`font-medium ${calculations.retail.profitMargin >= 68 && calculations.retail.profitMargin <= 72 ? 'text-green-600' : 'text-orange-600'}`}>
                                {calculations.retail.profitMargin.toFixed(1)}%
                              </p>
                            </div>
                            <div>
                              <span className="text-purple-600">Markup:</span>
                              <p className="font-medium">{calculations.retail.markup.toFixed(1)}%</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Sale Settings */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Sale Settings</h3>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_on_sale"
                      checked={formData.is_on_sale}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_on_sale: e.target.checked }))}
                      className="mr-2"
                    />
                    <label htmlFor="is_on_sale" className="text-sm font-medium text-gray-700">
                      Currently on sale
                    </label>
                  </div>

                  {formData.is_on_sale && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Discount Price ({formData.currency_code})
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.discount_price}
                          onChange={(e) => setFormData(prev => ({ ...prev, discount_price: e.target.value }))}
                          placeholder="24.99"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sale Start Date
                          </label>
                          <Input
                            type="date"
                            value={formData.sale_start_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, sale_start_date: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sale End Date
                          </label>
                          <Input
                            type="date"
                            value={formData.sale_end_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, sale_end_date: e.target.value }))}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t">
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-purple-600 to-blue-600">
                  <Save className="w-4 h-4 mr-2" />
                  {editingId ? 'Update' : 'Create'} Pricing
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pricing Tables Grouped by Currency */}
      {Object.entries(
        filteredPricing.reduce((groups: {[key: string]: any[]}, item) => {
          const currency = item.currency_code;
          if (!groups[currency]) groups[currency] = [];
          groups[currency].push(item);
          return groups;
        }, {})
      ).map(([currency, pricingItems]) => {
        const currencySymbol = countries.find(c => c.currency_code === currency)?.currency_symbol || currency;
        
        return (
          <Card key={currency} className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <PoundSterling className="w-5 h-5 mr-2" />
                {currency} ({currencySymbol}) Pricing - {pricingItems.length} entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-center p-2 font-medium">
                        <input
                          type="checkbox"
                          checked={pricingItems.every(item => selectedPricingIds.includes(item.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPricingIds(prev => [...new Set([...prev, ...pricingItems.map(item => item.id)])]);
                            } else {
                              setSelectedPricingIds(prev => prev.filter(id => !pricingItems.map(item => item.id).includes(id)));
                            }
                          }}
                          className="rounded"
                        />
                      </th>
                      <th className="text-left p-4 font-medium">Product</th>
                      <th className="text-left p-4 font-medium">Country</th>
                      <th className="text-right p-4 font-medium">Product Cost</th>
                      <th className="text-right p-4 font-medium">Shipping</th>
                      <th className="text-right p-4 font-medium">Total Cost</th>
                      <th className="text-right p-4 font-medium">Retail Price</th>
                      <th className="text-right p-4 font-medium">Discounted Price</th>
                      <th className="text-right p-4 font-medium">Profit</th>
                      <th className="text-right p-4 font-medium">Margin %</th>
                      <th className="text-center p-4 font-medium">Status</th>
                      <th className="text-right p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingItems.map((pricingItem) => {
                      const product = products.find(p => p.id === pricingItem.product_id);
                      const country = countries.find(c => c.code === pricingItem.country_code);
                      const profitMargin = pricingItem.profit_margin_percent || 0;
                      const totalCost = pricingItem.product_cost + pricingItem.shipping_cost;
                      const profit = pricingItem.sale_price - totalCost;
                      
                      return (
                        <tr key={pricingItem.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedPricingIds.includes(pricingItem.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPricingIds(prev => [...prev, pricingItem.id]);
                                } else {
                                  setSelectedPricingIds(prev => prev.filter(id => id !== pricingItem.id));
                                }
                              }}
                              className="rounded"
                            />
                          </td>
                          <td className="p-4">
                            <div>
                              <div className="font-medium text-gray-900">
                                {product?.name || 'Unknown Product'}
                              </div>
                              <div className="text-sm text-gray-600">
                                {product?.medium?.name} - {product?.format?.name}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <Globe className="w-4 h-4 text-gray-500" />
                              <span className="font-medium">{country?.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right font-medium">
                            {formatPrice(pricingItem.product_cost, currency, currencySymbol)}
                          </td>
                          <td className="p-4 text-right font-medium">
                            {formatPrice(pricingItem.shipping_cost, currency, currencySymbol)}
                          </td>
                          <td className="p-4 text-right font-medium">
                            {formatPrice(totalCost, currency, currencySymbol)}
                          </td>
                          <td className="p-4 text-right">
                            {editingId === pricingItem.id ? (
                              <Input
                                type="number"
                                step="2.50"
                                value={(editingPrices[pricingItem.id]?.current ?? pricingItem.sale_price) / 100}
                                onChange={(e) => {
                                  const newSalePrice = Math.round(parseFloat(e.target.value) * 100);
                                  
                                  // Track the original price if not already tracking
                                  if (!editingPrices[pricingItem.id]) {
                                    setEditingPrices(prev => ({
                                      ...prev,
                                      [pricingItem.id]: { original: pricingItem.sale_price, current: newSalePrice }
                                    }));
                                  } else {
                                    setEditingPrices(prev => ({
                                      ...prev,
                                      [pricingItem.id]: { ...prev[pricingItem.id], current: newSalePrice }
                                    }));
                                  }
                                }}
                                className="w-24 text-right"
                              />
                            ) : (
                              <div className="font-medium">
                                {formatPrice(pricingItem.sale_price, currency, currencySymbol)}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {pricingItem.is_on_sale && pricingItem.discount_price ? (
                              <div className="font-medium text-red-600">
                                {formatPrice(pricingItem.discount_price, currency, currencySymbol)}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">-</div>
                            )}
                          </td>
                          <td className="p-4 text-right font-medium">
                            {formatPrice(profit, currency, currencySymbol)}
                          </td>
                          <td className="p-4 text-right">
                            <div className={`font-medium ${profitMargin > 30 ? 'text-green-600' : profitMargin > 15 ? 'text-orange-600' : 'text-red-600'}`}>
                              {profitMargin.toFixed(1)}%
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              {profitMargin > 20 ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-orange-500" />
                              )}
                              {pricingItem.is_on_sale && (
                                <Badge className="bg-red-100 text-red-800 text-xs">
                                  Sale
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end space-x-2">
                              <Button
                                size="sm"
                                variant={editingId === pricingItem.id ? "default" : "outline"}
                                onClick={async () => {
                                  if (editingId === pricingItem.id) {
                                    // If we have changes, save them
                                    const editingPrice = editingPrices[pricingItem.id];
                                    if (editingPrice && editingPrice.current !== editingPrice.original) {
                                      try {
                                        await supabaseService.updateProductPricing(pricingItem.id, {
                                          sale_price: editingPrice.current
                                        });
                                        await loadData();
                                      } catch (error) {
                                        console.error('Error updating price:', error);
                                        alert('Failed to update price');
                                      }
                                    }
                                    
                                    // Clear editing state
                                    setEditingId(null);
                                    setEditingPrices(prev => {
                                      const newState = { ...prev };
                                      delete newState[pricingItem.id];
                                      return newState;
                                    });
                                  } else {
                                    setEditingId(pricingItem.id);
                                  }
                                }}
                              >
                                {editingId === pricingItem.id && editingPrices[pricingItem.id]?.current !== editingPrices[pricingItem.id]?.original ? (
                                  <Save className="w-4 h-4" />
                                ) : (
                                  <Edit2 className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(pricingItem.id, product?.name || 'Unknown', pricingItem.country_code)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {filteredPricing.length === 0 && (
        <Card className="p-8 text-center">
          <CardContent>
            <PoundSterling className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {pricing.length === 0 ? 'No Pricing Configured' : 'No Pricing Found'}
            </h3>
            <p className="text-gray-600 mb-4">
              {pricing.length === 0 
                ? 'Get started by adding pricing for your products in different countries.'
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
            {pricing.length === 0 ? (
              <Button 
                onClick={() => {
                  setShowAddForm(true);
                  resetForm();
                }}
                className="bg-gradient-to-r from-purple-600 to-blue-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Pricing
              </Button>
            ) : (
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}