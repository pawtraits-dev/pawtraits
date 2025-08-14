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

interface GelatoProduct {
  uid: string;
  name: string;
  description: string;
  category: string;
  variants: GelatoVariant[];
}

interface GelatoVariant {
  uid: string;
  name?: string;
  values?: Array<{
    uid: string;
    title: string;
  }>;
  selectedValue?: string;
  selectedValueTitle?: string;
  size?: {
    width: number;
    height: number;
    unit: string;
  };
  pricing?: Array<{
    country: string;
    currency: string;
    price: number;
    formattedPrice: string;
  }>;
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
  const [showGelatoSearch, setShowGelatoSearch] = useState(false);
  const [gelatoProducts, setGelatoProducts] = useState<GelatoProduct[]>([]);
  const [searchingGelato, setSearchingGelato] = useState(false);
  const [selectedGelatoProduct, setSelectedGelatoProduct] = useState<GelatoProduct | null>(null);
  const [selectedGelatoVariant, setSelectedGelatoVariant] = useState<GelatoVariant | null>(null);
  const [selectedVariantValues, setSelectedVariantValues] = useState<Record<string, {uid: string, title: string}>>({});
  const [gelatoSearchTerm, setGelatoSearchTerm] = useState('');
  const [gelatoUnitFilter, setGelatoUnitFilter] = useState<'mm' | 'inches'>('mm');
  
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
    setShowGelatoSearch(false);
    setSelectedGelatoProduct(null);
    setSelectedGelatoVariant(null);
    setGelatoProducts([]);
    setGelatoSearchTerm('');
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

  // Gelato integration functions
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
        setSelectedGelatoVariant(null);
        
        // Auto-populate form with Gelato product info
        setFormData(prev => ({
          ...prev,
          gelato_sku: product.uid, // This will be updated as variants are selected
          description: result.product.description || prev.description
        }));
        
        // Reset variant selections when changing products
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
    
    // Build product description from all selected variants
    const buildDescription = () => {
      const parts = [selectedGelatoProduct.name];
      Object.values(selectedVariantValues).forEach(value => {
        if (value.title) parts.push(value.title);
      });
      // Add the current selection
      parts.push(selectedValue.title);
      return parts.join(' - ');
    };

    // Get the correct Gelato Product UID using Gelato's Product Search API
    const fetchCorrectGelatoProductUID = async () => {
      if (!selectedGelatoProduct) return '';
      
      // Get current variants including the new selection
      const currentVariants = {...selectedVariantValues};
      currentVariants[variantUid] = selectedValue;
      
      console.log('🔍 Fetching correct Gelato Product UID via API:');
      console.log('  Catalog UID:', selectedGelatoProduct.uid);
      console.log('  Selected variants:', currentVariants);
      
      try {
        // Convert variants to the format expected by Gelato's search API
        const selectedAttributes: Record<string, string> = {};
        Object.entries(currentVariants).forEach(([key, value]) => {
          if (value.uid) {
            selectedAttributes[key] = value.uid;
          }
        });
        
        console.log('  Calling Gelato Product Search API with attributes:', selectedAttributes);
        
        // Call our API endpoint to get the correct Product UID
        const response = await fetch('/api/admin/gelato-products?action=search-product-uid', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            catalogUid: selectedGelatoProduct.uid,
            attributes: selectedAttributes
          })
        });
        
        const result = await response.json();
        
        if (result.success && result.productUid) {
          console.log('✅ Received correct Product UID from Gelato API:', result.productUid);
          return result.productUid;
        } else {
          console.warn('⚠️ Could not get Product UID from API:', result.error);
          // Fallback to manual construction if API fails
          return buildManualGelatoProductUID();
        }
      } catch (error) {
        console.error('❌ Error calling Gelato Product Search API:', error);
        // Fallback to manual construction if API fails
        return buildManualGelatoProductUID();
      }
    };
    
    // Fallback manual UID construction (kept for backup)
    const buildManualGelatoProductUID = () => {
      const currentVariants = {...selectedVariantValues};
      currentVariants[variantUid] = selectedValue;
      
      const parts = [selectedGelatoProduct.uid];
      
      // Simple concatenation as fallback
      Object.entries(currentVariants).forEach(([, value]) => {
        if (value.uid) {
          parts.push(value.uid);
        }
      });
      
      const fallbackUID = parts.join('_');
      console.log('  Fallback manual Product UID:', fallbackUID);
      return fallbackUID;
    };

    // Try to extract dimensions from format/size variants
    const extractDimensions = (title: string) => {
      // Look for patterns like "A4", "30x40cm", "12x16in", etc.
      const cmMatch = title.match(/(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)\s*cm/i);
      const inchMatch = title.match(/(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)\s*in/i);
      const aFormatMatch = title.match(/A(\d+)/i);
      
      if (cmMatch) {
        return {
          width_cm: cmMatch[1],
          height_cm: cmMatch[2],
          width_inches: (parseFloat(cmMatch[1]) / 2.54).toFixed(1),
          height_inches: (parseFloat(cmMatch[2]) / 2.54).toFixed(1)
        };
      }
      
      if (inchMatch) {
        return {
          width_inches: inchMatch[1],
          height_inches: inchMatch[2],
          width_cm: (parseFloat(inchMatch[1]) * 2.54).toFixed(1),
          height_cm: (parseFloat(inchMatch[2]) * 2.54).toFixed(1)
        };
      }
      
      // A format sizes (approximate)
      if (aFormatMatch) {
        const aFormats: Record<string, {width: number, height: number}> = {
          '4': {width: 21, height: 29.7}, // A4
          '3': {width: 29.7, height: 42}, // A3
          '2': {width: 42, height: 59.4}, // A2
          '1': {width: 59.4, height: 84.1} // A1
        };
        
        const format = aFormats[aFormatMatch[1]];
        if (format) {
          return {
            width_cm: format.width.toString(),
            height_cm: format.height.toString(),
            width_inches: (format.width / 2.54).toFixed(1),
            height_inches: (format.height / 2.54).toFixed(1)
          };
        }
      }
      
      return {};
    };

    const dimensions = extractDimensions(selectedValue.title);
    
    // Fetch the correct Product UID asynchronously
    fetchCorrectGelatoProductUID().then(gelatoProductUID => {
      // Update the form data with the correct UID
      setFormData(prev => ({
        ...prev,
        gelato_sku: gelatoProductUID
      }));
    });
    
    // Auto-populate Medium Type and Format based on Gelato catalog
    const mapGelatoToMediumAndFormat = (catalogUid: string) => {
      const mapping: Record<string, {mediumId?: string, formatId?: string}> = {
        'canvas': { mediumId: media.find(m => m.name.toLowerCase().includes('canvas'))?.id },
        'acrylic': { mediumId: media.find(m => m.name.toLowerCase().includes('acrylic'))?.id },
        'posters': { mediumId: media.find(m => m.name.toLowerCase().includes('paper') || m.name.toLowerCase().includes('poster'))?.id },
        'metal': { mediumId: media.find(m => m.name.toLowerCase().includes('metal') || m.name.toLowerCase().includes('aluminum'))?.id },
        'wood': { mediumId: media.find(m => m.name.toLowerCase().includes('wood'))?.id },
        'framed': { mediumId: media.find(m => m.name.toLowerCase().includes('framed'))?.id }
      };
      
      // Find matching medium type based on catalog UID
      const catalogKey = Object.keys(mapping).find(key => catalogUid.toLowerCase().includes(key));
      if (catalogKey && mapping[catalogKey].mediumId) {
        return { medium_id: mapping[catalogKey].mediumId };
      }
      
      return {};
    };
    
    // Auto-populate Format based on orientation and other attributes
    const mapToFormat = () => {
      const currentVariants = {...selectedVariantValues};
      currentVariants[variantUid] = selectedValue;
      
      // Look for orientation in variants
      const orientationVariant = Object.values(currentVariants).find(v => 
        v.title?.toLowerCase().includes('portrait') || 
        v.title?.toLowerCase().includes('landscape') ||
        v.title?.toLowerCase().includes('square')
      );
      
      if (orientationVariant?.title.toLowerCase().includes('portrait')) {
        return { format_id: formats.find(f => f.name.toLowerCase().includes('portrait'))?.id };
      } else if (orientationVariant?.title.toLowerCase().includes('landscape')) {
        return { format_id: formats.find(f => f.name.toLowerCase().includes('landscape'))?.id };
      } else if (orientationVariant?.title.toLowerCase().includes('square')) {
        return { format_id: formats.find(f => f.name.toLowerCase().includes('square'))?.id };
      }
      
      return {};
    };
    
    const mediumMapping = mapGelatoToMediumAndFormat(selectedGelatoProduct.uid);
    const formatMapping = mapToFormat();
    
    // Update form data with other attributes (UID will be set separately by the async call)
    setFormData(prev => ({
      ...prev,
      description: buildDescription(),
      size_name: selectedValue.title.includes('cm') || selectedValue.title.includes('inch') || selectedValue.title.includes('A') 
        ? selectedValue.title 
        : prev.size_name,
      ...dimensions,
      ...mediumMapping,
      ...formatMapping
    }));
  };

  const selectGelatoVariant = (variant: GelatoVariant) => {
    setSelectedGelatoVariant(variant);
  };

  const filteredGelatoProducts = gelatoProducts.filter(product => 
    !gelatoSearchTerm || 
    product.name.toLowerCase().includes(gelatoSearchTerm.toLowerCase()) ||
    product.uid.toLowerCase().includes(gelatoSearchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(gelatoSearchTerm.toLowerCase())
  );

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
                      Gelato Integration
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
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
                      </div>
                      
                      {/* Display current Gelato SKU prominently */}
                      {formData.gelato_sku && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-green-800 mb-2">Complete Gelato Product UID:</p>
                              <div className="font-mono text-sm text-green-700 break-all bg-white px-3 py-2 rounded border">
                                {formData.gelato_sku}
                              </div>
                              <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                                <p className="text-xs font-medium text-blue-800 mb-1">✅ Using Gelato Product Search API</p>
                                <div className="text-xs text-blue-600">
                                  Product UID retrieved directly from Gelato's catalog using selected attributes
                                </div>
                                <div className="font-mono text-xs text-gray-500 mt-1">
                                  Example format: canvas_300x450-mm-12x18-inch_canvas_wood-fsc-slim_4-0_ver
                                </div>
                              </div>
                              {selectedGelatoProduct && (
                                <div className="mt-3 space-y-1">
                                  <p className="text-xs text-green-700">
                                    <strong>Catalog:</strong> {selectedGelatoProduct.name} ({selectedGelatoProduct.uid})
                                  </p>
                                  {Object.entries(selectedVariantValues).length > 0 && (
                                    <div className="text-xs text-green-600">
                                      <strong>Selected Variants:</strong>
                                      <div className="ml-2 mt-1 space-y-0.5">
                                        {Object.entries(selectedVariantValues).map(([variantUid, value]) => (
                                          <div key={variantUid}>• {variantUid}: {value.title} ({value.uid})</div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {selectedGelatoProduct && !formData.gelato_sku && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-sm font-medium text-blue-800 mb-1">Selected Gelato Product:</p>
                          <p className="text-sm text-blue-700">
                            <strong>{selectedGelatoProduct.name}</strong>
                          </p>
                          <p className="text-xs text-blue-600">{selectedGelatoProduct.uid}</p>
                          <p className="text-xs text-orange-600 mt-2">⚠️ Configure variants to generate complete Product UID</p>
                        </div>
                      )}
                    </div>
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

            {/* Content - Scrollable */}
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
                    {filteredGelatoProducts.length === 0 && !searchingGelato && (
                      <div className="text-center py-8 text-gray-500">
                        {gelatoProducts.length === 0 
                          ? 'Click "Search Gelato" to load products'
                          : 'No products match your search'
                        }
                      </div>
                    )}
                  </div>
                </div>

                {/* Variant Selection */}
                <div className="space-y-4 overflow-y-auto">
                  {selectedGelatoProduct && (
                    <>
                      <div className="sticky top-0 bg-white py-2 border-b space-y-3">
                        <h3 className="font-semibold text-gray-900">
                          Product Configuration
                        </h3>
                        
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
                        {(() => {
                          if (!selectedGelatoProduct.variants || selectedGelatoProduct.variants.length === 0) {
                            return (
                              <div className="text-center py-4 text-gray-500">
                                No product attributes available
                              </div>
                            );
                          }
                          
                          // Filter out Unified formats that duplicate regular formats
                          const filteredVariants = selectedGelatoProduct.variants.filter(variant => {
                            const name = variant.name?.toLowerCase() || '';
                            // Skip unified formats if regular format exists
                            if (name.includes('unified') && (name.includes('canvas') || name.includes('metal'))) {
                              const regularFormatExists = selectedGelatoProduct.variants.some(v => {
                                const vName = v.name?.toLowerCase() || '';
                                return !vName.includes('unified') && 
                                       (name.includes('canvas') && vName.includes('canvas') ||
                                        name.includes('metal') && vName.includes('metal'));
                              });
                              return !regularFormatExists;
                            }
                            return true;
                          });
                          
                          // Filter variants by unit preference for size/format attributes
                          const filterByUnit = (values: any[]) => {
                            if (gelatoUnitFilter === 'mm') {
                              return values.filter(v => 
                                v.title?.includes('mm') || 
                                v.title?.includes('cm') ||
                                (!v.title?.includes('in') && !v.title?.includes('inch'))
                              );
                            } else {
                              return values.filter(v => 
                                v.title?.includes('in') || 
                                v.title?.includes('inch') ||
                                (!v.title?.includes('mm') && !v.title?.includes('cm'))
                              );
                            }
                          };
                          
                          // Apply unit filter to format-related variants
                          const processedVariants = filteredVariants.map(variant => {
                            const name = variant.name?.toLowerCase() || '';
                            if (name.includes('format') || name.includes('size')) {
                              return {
                                ...variant,
                                values: filterByUnit(variant.values || [])
                              };
                            }
                            return variant;
                          });
                          
                          // Separate selectable (multiple options) and fixed (single option) attributes
                          const selectableVariants = processedVariants.filter(variant => 
                            variant.values && variant.values.length > 1
                          );
                          const fixedVariants = processedVariants.filter(variant => 
                            variant.values && variant.values.length === 1
                          );
                          
                          return (
                            <>
                              {/* Selectable Attributes (at the top) */}
                              {selectableVariants.length > 0 && (
                                <div className="space-y-4">
                                  <h4 className="text-sm font-semibold text-gray-800 border-b pb-1">
                                    Configurable Options
                                  </h4>
                                  {selectableVariants.map((variant) => (
                                    <div key={variant.uid} className="border rounded-lg p-4">
                                      <div className="font-medium text-gray-900 mb-3">{variant.name}</div>
                                      <div>
                                        <Select
                                          value={selectedVariantValues[variant.uid]?.uid || ''}
                                          onValueChange={(value) => {
                                            const selectedValue = variant.values.find(v => v.uid === value);
                                            if (selectedValue) {
                                              setSelectedVariantValues(prev => ({
                                                ...prev,
                                                [variant.uid]: {
                                                  uid: selectedValue.uid,
                                                  title: selectedValue.title
                                                }
                                              }));
                                              
                                              // Update form data with selected attributes
                                              updateFormWithSelectedVariants(variant.uid, selectedValue);
                                            }
                                          }}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder={`Select ${variant.name.toLowerCase()}`} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {variant.values.map((value) => (
                                              <SelectItem key={value.uid} value={value.uid}>
                                                {value.title}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Fixed Attributes (below selectable ones) */}
                              {fixedVariants.length > 0 && (
                                <div className="space-y-3">
                                  <h4 className="text-sm font-semibold text-gray-800 border-b pb-1">
                                    Product Specifications
                                  </h4>
                                  {fixedVariants.map((variant) => (
                                    <div key={variant.uid} className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-400">
                                      <div className="text-sm font-medium text-gray-700">
                                        {variant.name}: <span className="text-gray-900">{variant.values[0].title}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })()}
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