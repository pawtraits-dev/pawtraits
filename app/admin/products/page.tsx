'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Package,
  Star,
  Eye,
  EyeOff,
  Search,
  Filter,
  Layers
} from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import type { Product, Media, Format, ProductCreate } from '@/lib/product-types';
import { formatPrice, generateProductSku } from '@/lib/product-types';

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
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
}

interface PricingFormData {
  country_code: string;
  product_cost: string;
  shipping_cost: string;
  sale_price: string;
}

export default function ProductManagementPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mediumFilter, setMediumFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [showPricingSection, setShowPricingSection] = useState(false);
  const [pricingEntries, setPricingEntries] = useState<PricingFormData[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [productPricing, setProductPricing] = useState<{[key: string]: any}>({});
  
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

  const supabaseService = new AdminSupabaseService();

  const stockStatuses = [
    { value: 'in_stock', label: 'In Stock', color: 'bg-green-100 text-green-800' },
    { value: 'low_stock', label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'out_of_stock', label: 'Out of Stock', color: 'bg-red-100 text-red-800' },
    { value: 'discontinued', label: 'Discontinued', color: 'bg-gray-100 text-gray-800' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsData, mediaData, formatsData] = await Promise.all([
        supabaseService.getProducts({ activeOnly: false }), // Show all products, not just active
        supabaseService.getMedia(false), // Show all media, not just active  
        supabaseService.getFormats() // Get all formats
      ]);
      
      setProducts(productsData || []);
      setMedia(mediaData || []);
      setFormats(formatsData || []);
      
      // Load pricing data for all products
      try {
        const pricingData = await supabaseService.getAllProductPricing();
        const pricingMap: {[key: string]: any} = {};
        
        pricingData.forEach((pricing: any) => {
          if (!pricingMap[pricing.product_id]) {
            pricingMap[pricing.product_id] = {};
          }
          pricingMap[pricing.product_id][pricing.country_code] = pricing;
        });
        
        setProductPricing(pricingMap);
      } catch (pricingError) {
        console.warn('Pricing data not available:', pricingError);
        setProductPricing({});
      }
      
      // Load countries separately with error handling
      try {
        const countriesData = await supabaseService.getCountries(true);
        setCountries(countriesData || []);
      } catch (countryError) {
        console.warn('Countries not available:', countryError);
        setCountries([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
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
    setPricingEntries([]);
    setShowPricingSection(false);
  };

  const addPricingEntry = () => {
    setPricingEntries(prev => [...prev, {
      country_code: '',
      product_cost: '',
      shipping_cost: '',
      sale_price: ''
    }]);
  };

  const updatePricingEntry = (index: number, field: keyof PricingFormData, value: string) => {
    setPricingEntries(prev => prev.map((entry, i) => 
      i === index ? { ...entry, [field]: value } : entry
    ));
  };

  const removePricingEntry = (index: number) => {
    setPricingEntries(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.medium_id || !formData.format_id || !formData.size_name || !formData.width_cm || !formData.height_cm) {
      alert('Please fill in medium, format, size name, and dimensions');
      return;
    }

    try {
      if (editingProduct) {
        // Update existing product
        const updateData = {
          id: editingProduct.id,
          medium_id: formData.medium_id,
          format_id: formData.format_id,
          description: formData.description || undefined,
          size_name: formData.size_name,
          size_code: formData.size_code || formData.size_name.charAt(0).toUpperCase(),
          width_cm: parseFloat(formData.width_cm),
          height_cm: parseFloat(formData.height_cm),
          width_inches: formData.width_inches ? parseFloat(formData.width_inches) : undefined,
          height_inches: formData.height_inches ? parseFloat(formData.height_inches) : undefined,
          gelato_sku: formData.gelato_sku || undefined,
          is_active: formData.is_active,
          is_featured: formData.is_featured,
          stock_status: formData.stock_status
        };

        await supabaseService.updateProduct(updateData);
        
        await loadData();
        resetForm();
        setShowEditForm(false);
        setEditingProduct(null);
      } else {
        // Create new product
        const productData: ProductCreate = {
          medium_id: formData.medium_id,
          format_id: formData.format_id,
          description: formData.description || undefined,
          size_name: formData.size_name,
          size_code: formData.size_code || formData.size_name.charAt(0).toUpperCase(),
          width_cm: parseFloat(formData.width_cm),
          height_cm: parseFloat(formData.height_cm),
          width_inches: formData.width_inches ? parseFloat(formData.width_inches) : undefined,
          height_inches: formData.height_inches ? parseFloat(formData.height_inches) : undefined,
          gelato_sku: formData.gelato_sku || undefined,
          is_active: formData.is_active,
          is_featured: formData.is_featured,
          stock_status: formData.stock_status
        };

        const newProduct = await supabaseService.createProduct(productData);
        
        if (newProduct && pricingEntries.length > 0) {
          // Create pricing entries for the new product
          for (const pricing of pricingEntries) {
            if (pricing.country_code && 
                pricing.product_cost !== '' && 
                pricing.sale_price !== '' &&
                !isNaN(parseFloat(pricing.product_cost)) &&
                !isNaN(parseFloat(pricing.sale_price))) {
              
              const pricingData = {
                product_id: newProduct.id,
                country_code: pricing.country_code,
                product_cost: Math.round(parseFloat(pricing.product_cost) * 100), // Convert to minor units
                shipping_cost: pricing.shipping_cost ? Math.round(parseFloat(pricing.shipping_cost) * 100) : 0,
                sale_price: Math.round(parseFloat(pricing.sale_price) * 100)
              };
              
              console.log('Creating pricing with data:', pricingData);
              await supabaseService.createProductPricing(pricingData);
            }
          }
        }
        
        await loadData();
        resetForm();
        setShowAddForm(false);
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will also delete all associated pricing.`)) {
      return;
    }

    try {
      await supabaseService.deleteProduct(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    resetForm();
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      medium_id: product.medium_id,
      format_id: product.format_id,
      description: product.description || '',
      size_name: product.size_name || '',
      size_code: product.size_code || '',
      width_cm: product.width_cm?.toString() || '',
      height_cm: product.height_cm?.toString() || '',
      width_inches: product.width_inches?.toString() || '',
      height_inches: product.height_inches?.toString() || '',
      gelato_sku: product.gelato_sku || '',
      is_active: product.is_active,
      is_featured: product.is_featured,
      stock_status: product.stock_status
    });
    setShowEditForm(true);
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setShowEditForm(false);
    setEditingProduct(null);
    resetForm();
  };

  const getPreviewName = () => {
    if (!formData.medium_id || !formData.format_id) return '';
    
    const medium = media.find(m => m.id === formData.medium_id);
    const format = formats.find(f => f.id === formData.format_id);
    
    if (!medium || !format) return '';
    
    return `${medium.name} - ${format.name}`;
  };

  const getPreviewSku = () => {
    if (!formData.medium_id || !formData.format_id) return '';
    
    const medium = media.find(m => m.id === formData.medium_id);
    const format = formats.find(f => f.id === formData.format_id);
    
    if (!medium || !format) return '';
    
    return generateProductSku(medium.slug, format.name);
  };

  // Filter and sort products
  const filteredProducts = (() => {
    if (loading || products.length === 0) return [];
    
    return products.filter(product => {
      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.medium?.name && product.medium.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (product.format?.name && product.format.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = !statusFilter || 
        (statusFilter === 'active' && product.is_active) ||
        (statusFilter === 'inactive' && !product.is_active) ||
        (statusFilter === 'featured' && product.is_featured) ||
        product.stock_status === statusFilter;
      
      const matchesMedium = !mediumFilter || product.medium_id === mediumFilter;
      const matchesFormat = !formatFilter || product.format_id === formatFilter;
      const matchesSize = !sizeFilter || (product.size_name && product.size_name.toLowerCase().includes(sizeFilter.toLowerCase()));
      
      return matchesSearch && matchesStatus && matchesMedium && matchesFormat && matchesSize;
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'medium':
          aValue = a.medium?.name || '';
          bValue = b.medium?.name || '';
          break;
        case 'format':
          aValue = a.format?.name || '';
          bValue = b.format?.name || '';
          break;
        case 'size':
          aValue = a.size_name || '';
          bValue = b.size_name || '';
          break;
        case 'price':
          aValue = getGBPPrice(a.id);
          bValue = getGBPPrice(b.id);
          break;
        case 'margin':
          aValue = getGBPMargin(a.id);
          bValue = getGBPMargin(b.id);
          break;
        case 'sales':
          aValue = 0; // TODO: Add sales data
          bValue = 0;
          break;
        case 'revenue':
          aValue = 0; // TODO: Add revenue data
          bValue = 0;
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  })();

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setMediumFilter('');
    setFormatFilter('');
    setSizeFilter('');
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getGBPPrice = (productId: string): number => {
    if (!productPricing || !productId) return 0;
    const pricing = productPricing[productId]?.['GB'];
    return pricing?.sale_price ? pricing.sale_price / 100 : 0; // Convert from pence to pounds
  };

  const getGBPMargin = (productId: string): number => {
    if (!productPricing || !productId) return 0;
    const pricing = productPricing[productId]?.['GB'];
    return pricing?.profit_margin_percent || 0;
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Product Management</h1>
          <p className="text-gray-600 mt-2">
            Manage products (combinations of media types and formats)
          </p>
        </div>
        
        <Button
          onClick={() => {
            setShowAddForm(true);
            resetForm();
          }}
          className="bg-gradient-to-r from-purple-600 to-blue-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Product
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
                placeholder="Search products, SKUs, media types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Row */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Select value={mediumFilter} onValueChange={setMediumFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Medium Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {media.map(medium => (
                      <SelectItem key={medium.id} value={medium.id}>
                        {medium.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={formatFilter} onValueChange={setFormatFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map(format => (
                      <SelectItem key={format.id} value={format.id}>
                        {format.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Size name..."
                  value={sizeFilter}
                  onChange={(e) => setSizeFilter(e.target.value)}
                />



                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="featured">Featured</SelectItem>
                    {stockStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button variant="outline" onClick={clearFilters} size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>

              <div className="flex justify-between items-center">
                <div></div>
                <p className="text-sm text-gray-600">
                  Showing {filteredProducts.length} of {products.length} products
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Form */}
      {(showAddForm || showEditForm) && (
        <Card className="mb-8 border-2 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Layers className="w-5 h-5 mr-2" />
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product Composition */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Product Composition</h3>
                  
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
                        {media.filter(m => m.is_active).map(medium => (
                          <SelectItem key={medium.id} value={medium.id}>
                            <div className="flex items-center space-x-2">
                              <span>{medium.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {medium.category}
                              </Badge>
                            </div>
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
                            <div className="flex items-center space-x-2">
                              <span>{format.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Size Information */}
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-gray-800">Size & Dimensions</h4>
                    
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
                  </div>

                  {/* Preview */}
                  {(formData.medium_id && formData.format_id) && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-blue-800 mb-1">Product Preview:</p>
                      <p className="text-sm text-blue-700">
                        <strong>Name:</strong> {getPreviewName()}
                      </p>
                      <p className="text-sm text-blue-700">
                        <strong>SKU:</strong> {getPreviewSku()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Product Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Product Details</h3>
                  
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stock Status
                    </label>
                    <Select 
                      value={formData.stock_status} 
                      onValueChange={(value: any) => setFormData(prev => ({ ...prev, stock_status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stockStatuses.map(status => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                        className="mr-2"
                      />
                      Active
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_featured}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))}
                        className="mr-2"
                      />
                      Featured
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gelato SKU
                    </label>
                    <Input
                      value={formData.gelato_sku}
                      onChange={(e) => setFormData(prev => ({ ...prev, gelato_sku: e.target.value }))}
                      placeholder="gelato_sku_12345"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="space-y-4 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Country-Specific Pricing</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPricingSection(!showPricingSection)}
                  >
                    {showPricingSection ? 'Hide Pricing' : 'Add Pricing'}
                  </Button>
                </div>

                {showPricingSection && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Add pricing for different countries. Costs are what Gelato charges you, sale prices are what you charge customers.
                    </p>
                    
                    {pricingEntries.map((pricing, index) => (
                      <div key={index} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-medium text-gray-800">Pricing Entry {index + 1}</h4>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removePricingEntry(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Country
                            </label>
                            <Select
                              value={pricing.country_code}
                              onValueChange={(value) => updatePricingEntry(index, 'country_code', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                              <SelectContent>
                                {countries.map(country => (
                                  <SelectItem key={country.code} value={country.code}>
                                    {country.name} ({country.currency_symbol})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Product Cost
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              value={pricing.product_cost}
                              onChange={(e) => updatePricingEntry(index, 'product_cost', e.target.value)}
                              placeholder="12.50"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Shipping Cost
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              value={pricing.shipping_cost}
                              onChange={(e) => updatePricingEntry(index, 'shipping_cost', e.target.value)}
                              placeholder="3.99"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Sale Price
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              value={pricing.sale_price}
                              onChange={(e) => updatePricingEntry(index, 'sale_price', e.target.value)}
                              placeholder="24.99"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addPricingEntry}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Pricing Entry
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t">
                <Button type="button" variant="outline" onClick={editingProduct ? cancelEdit : cancelAdd}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-purple-600 to-blue-600">
                  <Save className="w-4 h-4 mr-2" />
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>Manage product combinations of media types and formats</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th 
                    className="text-left p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('medium')}
                  >
                    Medium Type {getSortIcon('medium')}
                  </th>
                  <th 
                    className="text-left p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('format')}
                  >
                    Format {getSortIcon('format')}
                  </th>
                  <th 
                    className="text-left p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('size')}
                  >
                    Size Name {getSortIcon('size')}
                  </th>
                  <th 
                    className="text-right p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('price')}
                  >
                    GBP Price {getSortIcon('price')}
                  </th>
                  <th 
                    className="text-right p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('margin')}
                  >
                    Margin % {getSortIcon('margin')}
                  </th>
                  <th 
                    className="text-right p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('sales')}
                  >
                    No of Sales {getSortIcon('sales')}
                  </th>
                  <th 
                    className="text-right p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('revenue')}
                  >
                    Revenue {getSortIcon('revenue')}
                  </th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const gbpPrice = getGBPPrice(product.id);
                  const margin = getGBPMargin(product.id);
                  const sales = 0; // TODO: Implement sales data
                  const revenue = 0; // TODO: Implement revenue data
                  
                  return (
                    <tr key={product.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div>
                          <div className="font-medium text-gray-900">{product.medium?.name}</div>
                          {product.medium?.category && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {product.medium.category}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{product.format?.name}</div>
                      </td>
                      <td className="p-4">
                        <div>
                          <div className="font-medium text-gray-900">{product.size_name || 'No size'}</div>
                          {product.is_featured && (
                            <Badge className="bg-yellow-100 text-yellow-800 text-xs mt-1">
                              <Star className="w-3 h-3 mr-1" />
                              Featured
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        {gbpPrice > 0 ? (
                          <div className="font-medium text-gray-900">
                            £{gbpPrice.toFixed(2)}
                          </div>
                        ) : (
                          <span className="text-gray-400">No price</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {margin > 0 ? (
                          <div className={`font-medium ${margin > 30 ? 'text-green-600' : margin > 15 ? 'text-orange-600' : 'text-red-600'}`}>
                            {margin.toFixed(1)}%
                          </div>
                        ) : (
                          <span className="text-gray-400">No margin</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-medium text-gray-900">{sales}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-medium text-gray-900">
                          {revenue > 0 ? `£${revenue.toFixed(2)}` : '£0.00'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(product)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(product.id, product.name)}
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

      {filteredProducts.length === 0 && (
        <Card className="p-8 text-center">
          <CardContent>
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {products.length === 0 ? 'No Products' : 'No Products Found'}
            </h3>
            <p className="text-gray-600 mb-4">
              {products.length === 0 
                ? 'Get started by creating your first product combination of media type and format.'
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
            {products.length === 0 ? (
              <Button 
                onClick={() => {
                  setShowAddForm(true);
                  resetForm();
                }}
                className="bg-gradient-to-r from-purple-600 to-blue-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product
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