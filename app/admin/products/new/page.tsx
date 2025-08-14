'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { ArrowLeft, Save, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Import interfaces and types from original file
interface GelatoProduct {
  uid: string;
  name: string;
  description?: string;
  category?: string;
  variants?: Array<{
    uid: string;
    name: string;
    values: Array<{
      uid: string;
      title: string;
    }>;
  }>;
}

interface ProductFormData {
  medium_id: string;
  format_id: string;
  description: string;
  size_name: string;
  size_code: string;
  width_cm: string;
  height_cm: string;
  width_inches: string;
  height_inches: string;
  gelato_sku: string;
  is_active: boolean;
  is_featured: boolean;
  stock_status: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState<ProductFormData>({
    medium_id: '',
    format_id: '',
    description: '',
    size_name: '',
    size_code: '',
    width_cm: '',
    height_cm: '',
    width_inches: '',
    height_inches: '',
    gelato_sku: '',
    is_active: true,
    is_featured: false,
    stock_status: 'in_stock'
  });

  // Supporting data
  const [media, setMedia] = useState<any[]>([]);
  const [formats, setFormats] = useState<any[]>([]);
  
  // Gelato integration state
  const [showGelatoSearch, setShowGelatoSearch] = useState(false);
  const [gelatoProducts, setGelatoProducts] = useState<GelatoProduct[]>([]);
  const [searchingGelato, setSearchingGelato] = useState(false);
  const [selectedGelatoProduct, setSelectedGelatoProduct] = useState<GelatoProduct | null>(null);
  const [selectedVariantValues, setSelectedVariantValues] = useState<Record<string, {uid: string, title: string}>>({});
  const [gelatoSearchTerm, setGelatoSearchTerm] = useState('');
  const [gelatoUnitFilter, setGelatoUnitFilter] = useState<'mm' | 'inches'>('mm');
  const [productPricing, setProductPricing] = useState<{[key: string]: any}>({});

  const supabaseService = new AdminSupabaseService();

  useEffect(() => {
    loadSupportingData();
  }, []);

  const loadSupportingData = async () => {
    try {
      const [mediaResult, formatsResult] = await Promise.all([
        supabaseService.getMedia(),
        supabaseService.getFormats()
      ]);
      
      setMedia(mediaResult || []);
      setFormats(formatsResult || []);
    } catch (err) {
      console.error('Error loading supporting data:', err);
      setError('Failed to load form data');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.medium_id || !formData.format_id) {
      setError('Medium and Format are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await supabaseService.createProduct(formData);
      router.push('/admin/products');
    } catch (err) {
      console.error('Error creating product:', err);
      setError('Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  // Gelato integration functions (extracted from original file)
  const searchGelatoProducts = async () => {
    try {
      setSearchingGelato(true);
      const response = await fetch('/api/admin/gelato-products?action=search');
      const result = await response.json();
      
      if (result.success) {
        setGelatoProducts(result.products);
      } else {
        alert('Failed to fetch Gelato products: ' + result.error);
      }
    } catch (error) {
      console.error('Error searching Gelato products:', error);
      alert('Failed to search Gelato products');
    } finally {
      setSearchingGelato(false);
    }
  };

  const selectGelatoProduct = async (product: GelatoProduct) => {
    try {
      setSelectedGelatoProduct(product);
      
      // Fetch detailed product info with pricing
      const response = await fetch(`/api/admin/gelato-products?action=details&uid=${product.uid}`);
      const result = await response.json();
      
      if (result.success) {
        setSelectedGelatoProduct(result.product);
        setFormData(prev => ({
          ...prev,
          gelato_sku: product.uid,
          description: result.product.description || prev.description
        }));
        
        setSelectedVariantValues({});
      } else {
        alert('Failed to fetch product details: ' + result.error);
      }
    } catch (error) {
      console.error('Error selecting Gelato product:', error);
      alert('Failed to load product details');
    }
  };

  const updateFormWithSelectedVariants = (variantUid: string, selectedValue: {uid: string, title: string}) => {
    if (!selectedGelatoProduct) return;
    
    // Update variant selections
    setSelectedVariantValues(prev => ({
      ...prev,
      [variantUid]: selectedValue
    }));

    // Fetch the correct Product UID asynchronously
    fetchCorrectGelatoProductUID(variantUid, selectedValue).then(gelatoProductUID => {
      if (gelatoProductUID && gelatoProductUID.length > 10 && gelatoProductUID !== 'canvas') {
        setFormData(prev => ({
          ...prev,
          gelato_sku: gelatoProductUID
        }));
        
        // Fetch real-time pricing from Gelato
        fetchGelatoPricing(gelatoProductUID);
      } else {
        console.warn('Invalid Product UID received:', gelatoProductUID);
      }
    });
  };

  const fetchCorrectGelatoProductUID = async (variantUid: string, selectedValue: {uid: string, title: string}) => {
    if (!selectedGelatoProduct) return '';
    
    const currentVariants = {...selectedVariantValues};
    currentVariants[variantUid] = selectedValue;
    
    try {
      const selectedAttributes: Record<string, string> = {};
      Object.entries(currentVariants).forEach(([key, value]) => {
        if (value.uid) {
          selectedAttributes[key] = value.uid;
        }
      });
      
      const response = await fetch('/api/admin/gelato-products?action=search-product-uid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogUid: selectedGelatoProduct.uid,
          attributes: selectedAttributes
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.productUid) {
        // Extract dimensions if available
        if (result.productDetails && result.productDetails.dimensions) {
          const dims = result.productDetails.dimensions;
          const widthMm = dims.Width?.value;
          const heightMm = dims.Height?.value;
          
          if (widthMm && heightMm) {
            setFormData(prev => ({
              ...prev,
              width_cm: (widthMm / 10).toString(),
              height_cm: (heightMm / 10).toString(),
              width_inches: (widthMm / 25.4).toFixed(1),
              height_inches: (heightMm / 25.4).toFixed(1)
            }));
          }
        }
        
        return result.productUid;
      }
      return '';
    } catch (error) {
      console.error('Error getting Product UID:', error);
      return '';
    }
  };

  const fetchGelatoPricing = async (productUid: string) => {
    // Validate the Product UID format - Gelato UIDs are typically longer alphanumeric strings
    if (!productUid || productUid.length < 10 || productUid === 'canvas' || !productUid.match(/^[a-zA-Z0-9_-]+$/)) {
      console.warn('Invalid Gelato Product UID:', productUid);
      return;
    }

    try {
      const [baseCostResponse, multiCountryResponse] = await Promise.all([
        fetch(`/api/admin/gelato-products?action=base-cost&uid=${productUid}&country=GB`),
        fetch(`/api/admin/gelato-products?action=multi-country-pricing&uid=${productUid}&countries=GB,US,DE`)
      ]);
      
      const [baseCostResult, multiCountryResult] = await Promise.all([
        baseCostResponse.json(),
        multiCountryResponse.json()
      ]);
      
      if (baseCostResult.success && multiCountryResult.success) {
        setProductPricing(prev => ({
          ...prev,
          [productUid]: {
            baseCost: baseCostResult.baseCost,
            multiCountry: multiCountryResult.pricing
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching Gelato pricing:', error);
    }
  };

  const filteredGelatoProducts = gelatoProducts.filter(product =>
    !gelatoSearchTerm || product.name.toLowerCase().includes(gelatoSearchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link href="/admin/products">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Product</h1>
          <p className="text-gray-600">Create a new product with Gelato integration</p>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Product Information */}
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
            <CardDescription>Basic product details and Gelato integration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Medium and Format Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Medium Type *
                </label>
                <Select 
                  value={formData.medium_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, medium_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select medium" />
                  </SelectTrigger>
                  <SelectContent>
                    {media.filter((m: any) => m.is_active).map(medium => (
                      <SelectItem key={medium.id} value={medium.id}>
                        {medium.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format *
                </label>
                <Select 
                  value={formData.format_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, format_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.filter((f: any) => f.is_active).map(format => (
                      <SelectItem key={format.id} value={format.id}>
                        {format.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Gelato Integration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gelato Product SKU
              </label>
              <div className="flex space-x-2">
                <Input
                  value={formData.gelato_sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, gelato_sku: e.target.value }))}
                  placeholder="gelato_sku_12345"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowGelatoSearch(true)}
                  size="sm"
                >
                  Browse Gelato
                </Button>
                
                {formData.gelato_sku && formData.gelato_sku.length > 10 && formData.gelato_sku !== 'canvas' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fetchGelatoPricing(formData.gelato_sku)}
                    size="sm"
                    className="text-xs"
                  >
                    🔄 Refresh Pricing
                  </Button>
                )}
              </div>
            </div>

            {/* Display current Gelato SKU prominently */}
            {formData.gelato_sku && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-800 mb-2">Complete Gelato Product UID:</p>
                <div className="font-mono text-sm text-green-700 break-all bg-white px-3 py-2 rounded border">
                  {formData.gelato_sku}
                </div>
                <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                  <p className="text-xs font-medium text-blue-800 mb-1">✅ Using Gelato Product Search API</p>
                  <div className="text-xs text-blue-600">
                    Product UID retrieved directly from Gelato's catalog using selected attributes
                  </div>
                </div>
              </div>
            )}

            {/* Real-time Gelato Pricing */}
            {formData.gelato_sku && (
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                <h4 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center">
                  💰 Live Gelato Pricing
                  {productPricing[formData.gelato_sku] ? (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✅ Loaded</span>
                  ) : (
                    <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Loading...</span>
                  )}
                </h4>
                
                {productPricing[formData.gelato_sku] ? (
                  <>
                    {/* Base Cost */}
                    {productPricing[formData.gelato_sku].baseCost && (
                      <div className="mb-3">
                        <span className="text-sm font-medium text-yellow-700">Base Cost: </span>
                        <span className="font-mono text-lg font-semibold text-yellow-900">
                          {productPricing[formData.gelato_sku].baseCost.currency} {productPricing[formData.gelato_sku].baseCost.price}
                        </span>
                      </div>
                    )}
                    
                    {/* Multi-Country Pricing */}
                    {productPricing[formData.gelato_sku].multiCountry && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-yellow-700">Multi-Country Costs:</div>
                        <div className="grid grid-cols-3 gap-3">
                          {Object.entries(productPricing[formData.gelato_sku].multiCountry).map(([country, prices]) => {
                            const priceArray = prices as any[];
                            if (!priceArray || priceArray.length === 0) return null;
                            const basePrice = priceArray.find(p => p.quantity === 1) || priceArray[0];
                            return (
                              <div key={country} className="bg-white p-2 rounded border border-yellow-200">
                                <div className="font-semibold text-yellow-800">{country}</div>
                                <div className="font-mono text-yellow-700 text-sm">
                                  {basePrice.currency} {basePrice.price}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-yellow-700">
                    Fetching live pricing from Gelato API...
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Size & Dimensions */}
        <Card>
          <CardHeader>
            <CardTitle>Size & Dimensions</CardTitle>
            <CardDescription>Product size information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size Name *
                </label>
                <Input
                  value={formData.size_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, size_name: e.target.value }))}
                  placeholder="Small"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size Code
                </label>
                <Input
                  value={formData.size_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, size_code: e.target.value.toUpperCase() }))}
                  placeholder="S"
                  maxLength={5}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Width (cm) *
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.width_cm}
                  onChange={(e) => setFormData(prev => ({ ...prev, width_cm: e.target.value }))}
                  placeholder="20.0"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Height (cm) *
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.height_cm}
                  onChange={(e) => setFormData(prev => ({ ...prev, height_cm: e.target.value }))}
                  placeholder="20.0"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Width (inches)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.width_inches}
                  onChange={(e) => setFormData(prev => ({ ...prev, width_inches: e.target.value }))}
                  placeholder="8.0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Height (inches)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.height_inches}
                  onChange={(e) => setFormData(prev => ({ ...prev, height_inches: e.target.value }))}
                  placeholder="8.0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Details */}
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
            <CardDescription>Additional product information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Additional product description (optional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Status
                </label>
                <Select 
                  value={formData.stock_status} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, stock_status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_stock">In Stock</SelectItem>
                    <SelectItem value="low_stock">Low Stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                    Active Product
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_featured"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="is_featured" className="text-sm font-medium text-gray-700">
                    Featured Product
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-end space-x-4">
              <Link href="/admin/products">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
              <Button 
                type="submit" 
                disabled={loading}
                className="bg-gradient-to-r from-purple-600 to-blue-600"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {loading ? 'Creating...' : 'Create Product'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Gelato Product Search Modal */}
      {showGelatoSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl h-full max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Browse Gelato Products</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGelatoSearch(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Search */}
            <div className="p-6 border-b">
              <div className="flex space-x-4">
                <Input
                  placeholder="Search products..."
                  value={gelatoSearchTerm}
                  onChange={(e) => setGelatoSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={searchGelatoProducts}
                  disabled={searchingGelato}
                  className="bg-gradient-to-r from-purple-600 to-blue-600"
                >
                  {searchingGelato ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  {searchingGelato ? 'Searching...' : 'Search Gelato'}
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full p-6">
                {/* Product List */}
                <div className="space-y-4 overflow-y-auto">
                  <h3 className="font-semibold text-gray-900 sticky top-0 bg-white py-2">
                    Products ({filteredGelatoProducts.length})
                  </h3>
                  <div className="space-y-2">
                    {filteredGelatoProducts.map((product) => (
                      <div
                        key={product.uid}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedGelatoProduct?.uid === product.uid
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => selectGelatoProduct(product)}
                      >
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-600">{product.category}</div>
                        <div className="text-xs text-gray-500 mt-1">{product.uid}</div>
                        {product.description && (
                          <div className="text-xs text-gray-500 mt-1">{product.description.slice(0, 100)}...</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Variant Selection */}
                <div className="space-y-4 overflow-y-auto">
                  {selectedGelatoProduct && (
                    <>
                      <div className="sticky top-0 bg-white py-2 border-b space-y-3">
                        <h3 className="font-semibold text-gray-900">Product Configuration</h3>
                        
                        {/* Unit Selector */}
                        <div className="flex items-center space-x-4">
                          <span className="text-sm font-medium text-gray-700">Unit:</span>
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              onClick={() => setGelatoUnitFilter('mm')}
                              className={`px-3 py-1 text-xs rounded ${
                                gelatoUnitFilter === 'mm'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                  : 'bg-gray-100 text-gray-600 border border-gray-300'
                              }`}
                            >
                              Millimeters
                            </button>
                            <button
                              type="button"
                              onClick={() => setGelatoUnitFilter('inches')}
                              className={`px-3 py-1 text-xs rounded ${
                                gelatoUnitFilter === 'inches'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                  : 'bg-gray-100 text-gray-600 border border-gray-300'
                              }`}
                            >
                              Inches
                            </button>
                          </div>
                        </div>
                        
                        {/* Show current Gelato SKU */}
                        {formData.gelato_sku && (
                          <div className="p-2 bg-green-50 rounded border">
                            <span className="text-xs font-medium text-green-800">Gelato SKU:</span>
                            <div className="font-mono text-sm text-green-700 break-all">{formData.gelato_sku}</div>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {/* Variant Selection Interface */}
                        {selectedGelatoProduct?.variants && selectedGelatoProduct.variants.length > 0 ? (
                          selectedGelatoProduct.variants.map((variant) => {
                            // Filter values based on unit preference
                            const filteredValues = variant.values.filter(value => {
                              if (gelatoUnitFilter === 'mm') {
                                return !value.title.toLowerCase().includes('inch') && 
                                       !value.title.toLowerCase().includes('"');
                              } else {
                                return value.title.toLowerCase().includes('inch') || 
                                       value.title.toLowerCase().includes('"');
                              }
                            });
                            
                            // If no values match filter, show all values
                            const valuesToShow = filteredValues.length > 0 ? filteredValues : variant.values;
                            
                            return (
                              <div key={variant.uid} className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                  {variant.name}
                                </label>
                                <Select
                                  value={selectedVariantValues[variant.uid]?.uid || ''}
                                  onValueChange={(valueUid) => {
                                    const selectedValue = valuesToShow.find(v => v.uid === valueUid);
                                    if (selectedValue) {
                                      updateFormWithSelectedVariants(variant.uid, selectedValue);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder={`Select ${variant.name.toLowerCase()}`} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {valuesToShow.map(value => (
                                      <SelectItem key={value.uid} value={value.uid}>
                                        {value.title}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {selectedVariantValues[variant.uid] && (
                                  <div className="text-xs text-gray-500">
                                    Selected: {selectedVariantValues[variant.uid].title}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            {selectedGelatoProduct ? 'No variants available for this product' : 'Select a product to see variants'}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-4 p-6 border-t bg-white">
              <Button
                variant="outline"
                onClick={() => setShowGelatoSearch(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowGelatoSearch(false)}
                disabled={!selectedGelatoProduct}
                className="bg-gradient-to-r from-purple-600 to-blue-600"
              >
                Use Selected Product
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}