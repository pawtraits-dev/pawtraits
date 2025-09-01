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
import { formatPrice } from '@/lib/product-types';
import { PawSpinner } from '@/components/ui/paw-spinner';

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
  product_weight_g?: number;
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
    stock_status: 'in_stock',
    product_weight_g: undefined
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
  
  // SKU dropdown state
  const [availableSkus, setAvailableSkus] = useState<any[]>([]);
  const [loadingSkus, setLoadingSkus] = useState(false);
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);

  const supabaseService = new AdminSupabaseService();

  // Helper function to determine format based on dimensions
  const determineFormatFromDimensions = (width: number, height: number) => {
    const ratio = width / height;
    
    if (Math.abs(ratio - 1) < 0.1) {
      // Square (1:1)
      return formats.find(f => f.name === 'Square' && f.is_active);
    } else if (ratio > 1) {
      // Landscape (wider than tall)
      return formats.find(f => f.name === 'Landscape' && f.is_active);
    } else {
      // Portrait (taller than wide)
      return formats.find(f => f.name === 'Portrait' && f.is_active);
    }
  };

  // Helper function to map Gelato product to form fields
  const populateFormFromGelatoProduct = (gelatoProduct: GelatoProduct) => {
    const updates: Partial<ProductFormData> = {};
    
    // Map Gelato product name/category to medium type
    const productName = gelatoProduct.name?.toLowerCase() || '';
    const productUid = gelatoProduct.uid?.toLowerCase() || '';
    
    // Find matching medium based on Gelato product name/category
    const matchingMedium = media.find(medium => {
      const mediumName = medium.name?.toLowerCase() || '';
      const mediumSlug = medium.slug?.toLowerCase() || '';
      
      // Check for direct matches in product name or UID
      return productName.includes(mediumName) || 
             productName.includes(mediumSlug) ||
             productUid.includes(mediumName) ||
             productUid.includes(mediumSlug) ||
             // Specific mappings for common Gelato products
             (productName.includes('canvas') && mediumName.includes('canvas')) ||
             (productName.includes('acrylic') && mediumName.includes('acrylic')) ||
             (productName.includes('metal') && mediumName.includes('metal')) ||
             (productName.includes('poster') && mediumName.includes('poster')) ||
             (productName.includes('frame') && mediumName.includes('frame'));
    });
    
    if (matchingMedium) {
      updates.medium_id = matchingMedium.id;
    }
    
    // Set a default size name based on product name
    if (productName) {
      updates.size_name = gelatoProduct.name || 'Standard';
    }
    
    return updates;
  };

  // Helper function to generate description based on size, format, and medium
  const generateDescription = (sizeName: string, formatName: string, mediumName: string) => {
    const cleanSizeName = sizeName.replace(/\d+[xX×]\d+/, '').trim() || sizeName;
    return `${cleanSizeName} ${formatName} ${mediumName}`.trim();
  };

  // Helper function to extract size information from variant selections
  const extractSizeFromVariants = (variants: Record<string, {uid: string, title: string}>) => {
    let sizeName = '';
    let sizeCode = '';
    
    // Look through selected variants for size-related information
    Object.values(variants).forEach(variant => {
      if (variant && variant.title) {
        const title = variant.title.toLowerCase();
        
        // Check for size variants (usually contain dimensions or size names)
        if (title.includes('mm') || title.includes('cm') || title.includes('inch') || title.includes('"')) {
          // Extract dimensions for size name
          const dimensionMatch = title.match(/(\d+)\s*[x×]\s*(\d+)/);
          if (dimensionMatch) {
            const [, width, height] = dimensionMatch;
            sizeName = `${width}×${height}`;
            
            // Create size code from dimensions
            if (title.includes('mm')) {
              sizeCode = `${width}x${height}mm`;
            } else if (title.includes('cm')) {
              sizeCode = `${width}x${height}cm`;
            } else if (title.includes('inch') || title.includes('"')) {
              sizeCode = `${width}x${height}in`;
            }
          } else {
            // Use the full title as size name if it contains size info
            sizeName = variant.title;
          }
        }
        
        // Check for standard size names
        const standardSizes = ['small', 'medium', 'large', 'xl', 'xxl', 'a4', 'a3', 'a2', 'a1', 'a0'];
        if (standardSizes.some(size => title.includes(size))) {
          sizeName = variant.title;
          sizeCode = title.toUpperCase().replace(/[^A-Z0-9]/g, '');
        }
      }
    });
    
    return { sizeName, sizeCode };
  };

  useEffect(() => {
    loadSupportingData();
  }, []);

  // Auto-select single-value variants
  useEffect(() => {
    if (selectedGelatoProduct?.variants) {
      selectedGelatoProduct.variants.forEach((variant) => {
        // Skip if already selected or if variant is invalid
        if (!variant || !variant.uid || selectedVariantValues[variant.uid]) {
          return;
        }
        
        // Note: Unified formats are now allowed and active

        // Filter values based on unit preference
        const filteredValues = variant.values?.filter(value => {
          if (!value || !value.title || typeof value.title !== 'string') {
            return false;
          }
          
          const titleLower = value.title.toLowerCase();
          if (gelatoUnitFilter === 'mm') {
            return !titleLower.includes('inch') && !titleLower.includes('"');
          } else {
            return titleLower.includes('inch') || titleLower.includes('"');
          }
        }) || [];
        
        const valuesToShow = filteredValues.length > 0 ? filteredValues : (variant.values || []);
        
        // Auto-select if only one value
        if (valuesToShow.length === 1 && valuesToShow[0]) {
          updateFormWithSelectedVariants(variant.uid, valuesToShow[0]);
        }
      });
    }
  }, [selectedGelatoProduct, gelatoUnitFilter]);

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
      
      // Create the product first
      const createdProduct = await supabaseService.createProduct(formData);
      
      if (!createdProduct) {
        throw new Error('Failed to create product');
      }
      
      // Save pricing data if available
      if (formData.gelato_sku && productPricing[formData.gelato_sku] && productPricing[formData.gelato_sku].allPricing) {
        const pricingData = productPricing[formData.gelato_sku].allPricing;
        
        // Create pricing entries for each country with successful pricing
        for (const pricing of pricingData) {
          if (pricing.success && pricing.price) {
            try {
              const costInMinorUnits = Math.round(pricing.price * 100); // Convert to pence/cents
              
              // Calculate 70% margin retail price
              const retailPrice = (costInMinorUnits / 100) / 0.30; // 70% margin
              const roundedRetailPrice = Math.round(retailPrice / 2.5) * 2.5; // Round to £2.50
              const retailPriceMinorUnits = Math.round(roundedRetailPrice * 100);
              
              const pricingEntry = {
                product_id: createdProduct.id,
                country_code: pricing.country,
                product_cost: costInMinorUnits,
                shipping_cost: 0, // Gelato pricing is typically base cost
                sale_price: retailPriceMinorUnits
              };
              
              await supabaseService.createProductPricing(pricingEntry);
            } catch (pricingError) {
              console.warn(`Failed to create pricing for ${pricing.country}:`, pricingError);
              // Continue with other pricing entries even if one fails
            }
          }
        }
      }
      
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
      
      // Fetch detailed product info to get variants (but don't set pricing yet)
      const response = await fetch(`/api/admin/gelato-products?action=details&uid=${product.uid}`);
      const result = await response.json();
      
      if (result.success) {
        setSelectedGelatoProduct(result.product);
        
        // Auto-populate form fields from Gelato product information
        const populatedFields = populateFormFromGelatoProduct(result.product);
        
        setFormData(prev => ({
          ...prev,
          ...populatedFields,
          // Don't set gelato_sku yet - wait for variant selection to generate proper Product UID
          description: result.product.description || prev.description
        }));
        
        // Clear any previous variant selections
        setSelectedVariantValues({});
        // Clear any existing pricing data
        setProductPricing({});
        
        // Fetch available SKUs for this catalog
        await fetchAvailableSkus(product.uid);
      } else {
        alert('Failed to fetch product details: ' + result.error);
      }
    } catch (error) {
      console.error('Error selecting Gelato product:', error);
      alert('Failed to load product details');
    }
  };

  const fetchAvailableSkus = async (catalogUid: string) => {
    try {
      setLoadingSkus(true);
      console.log('Fetching SKUs for catalog:', catalogUid);
      
      const response = await fetch(`/api/admin/gelato-products?action=get-skus&uid=${catalogUid}`);
      const result = await response.json();
      
      if (result.success) {
        setAvailableSkus(result.skus || []);
        setShowSkuDropdown(true);
        console.log(`Loaded ${result.skus?.length || 0} SKUs`);
      } else {
        console.error('Failed to fetch SKUs:', result.error);
        setAvailableSkus([]);
        setShowSkuDropdown(false);
      }
    } catch (error) {
      console.error('Error fetching SKUs:', error);
      setAvailableSkus([]);
      setShowSkuDropdown(false);
    } finally {
      setLoadingSkus(false);
    }
  };

  const selectSkuDirectly = async (sku: any) => {
    try {
      console.log('Selected SKU:', sku);
      
      // Set the gelato_sku to the selected SKU UID
      setFormData(prev => ({
        ...prev,
        gelato_sku: sku.uid
      }));
      
      // Try to extract information from the SKU
      if (sku.dimensions) {
        const dims = sku.dimensions;
        const updates: Partial<ProductFormData> = {};
        
        if (dims.Width?.value && dims.Height?.value) {
          const widthMm = dims.Width.value;
          const heightMm = dims.Height.value;
          
          updates.width_cm = (widthMm / 10).toString();
          updates.height_cm = (heightMm / 10).toString();
          updates.width_inches = (widthMm / 25.4).toFixed(1);
          updates.height_inches = (heightMm / 25.4).toFixed(1);
          
          // Determine format based on dimensions
          const determinedFormat = determineFormatFromDimensions(widthMm, heightMm);
          if (determinedFormat) {
            updates.format_id = determinedFormat.id;
          }
        }
        
        if (dims.Weight?.value) {
          updates.product_weight_g = dims.Weight.value;
        }
        
        setFormData(prev => ({ ...prev, ...updates }));
      }
      
      // Auto-generate description if we have enough information
      if (sku.title) {
        const selectedFormat = formats.find(f => f.id === formData.format_id);
        const selectedMedium = media.find(m => m.id === formData.medium_id);
        
        if (selectedFormat && selectedMedium) {
          setFormData(prev => ({
            ...prev,
            description: generateDescription(sku.title, selectedFormat.name, selectedMedium.name),
            size_name: sku.title
          }));
        }
      }
      
      // Close the modal
      setShowGelatoSearch(false);
      
    } catch (error) {
      console.error('Error selecting SKU:', error);
      alert('Failed to apply SKU details');
    }
  };

  const updateFormWithSelectedVariants = (variantUid: string, selectedValue: {uid: string, title: string}) => {
    if (!selectedGelatoProduct) return;
    
    // Update variant selections
    setSelectedVariantValues(prev => {
      const newVariants = {
        ...prev,
        [variantUid]: selectedValue
      };
      
      // Regenerate Product UID with ALL current variants (including this new one)
      fetchCorrectGelatoProductUID(newVariants).then(gelatoProductUID => {
        if (gelatoProductUID && gelatoProductUID.length > 10 && gelatoProductUID !== 'canvas') {
          setFormData(prevForm => ({
            ...prevForm,
            gelato_sku: gelatoProductUID
          }));
        } else {
          console.warn('Invalid Product UID received:', gelatoProductUID);
        }
      });
      
      return newVariants;
    });
  };

  const fetchCorrectGelatoProductUID = async (allVariants: Record<string, {uid: string, title: string}>) => {
    if (!selectedGelatoProduct) return '';
    
    const currentVariants = allVariants;
    
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
        // Extract dimensions and size info from product details
        const formUpdates: Partial<ProductFormData> = {};
        
        // Extract dimensions if available
        if (result.productDetails && result.productDetails.dimensions) {
          const dims = result.productDetails.dimensions;
          let widthMm = dims.Width?.value;
          let heightMm = dims.Height?.value;
          let weightG = dims.Weight?.value;
          
          if (widthMm && heightMm) {
            formUpdates.width_cm = (widthMm / 10).toString();
            formUpdates.height_cm = (heightMm / 10).toString();
            formUpdates.width_inches = (widthMm / 25.4).toFixed(1);
            formUpdates.height_inches = (heightMm / 25.4).toFixed(1);
            
            // Determine format based on dimensions
            const determinedFormat = determineFormatFromDimensions(widthMm, heightMm);
            if (determinedFormat) {
              formUpdates.format_id = determinedFormat.id;
            }
            
            // Store weight if available
            if (weightG) {
              formUpdates.product_weight_g = weightG;
            }
          }
        }
        
        // Extract size information from selected variants
        const sizeInfo = extractSizeFromVariants(currentVariants);
        if (sizeInfo.sizeName) {
          formUpdates.size_name = sizeInfo.sizeName;
        }
        if (sizeInfo.sizeCode) {
          formUpdates.size_code = sizeInfo.sizeCode;
        }
        
        // Generate description after we have all the info
        setFormData(prev => {
          const updatedForm = { ...prev, ...formUpdates };
          
          // Find the format and medium names for description
          const selectedFormat = formats.find(f => f.id === updatedForm.format_id);
          const selectedMedium = media.find(m => m.id === updatedForm.medium_id);
          
          if (selectedFormat && selectedMedium && updatedForm.size_name) {
            updatedForm.description = generateDescription(
              updatedForm.size_name,
              selectedFormat.name,
              selectedMedium.name
            );
          }
          
          return updatedForm;
        });
        
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
      // Get active countries from database
      const countryDetailsResponse = await fetch('/api/admin/countries?supportedOnly=true');
      if (!countryDetailsResponse.ok) {
        throw new Error('Failed to fetch active countries');
      }
      
      const activeCountries = await countryDetailsResponse.json();
      console.log('Active countries for pricing:', activeCountries.map(c => `${c.name} (${c.code})`));
      
      // Add flag helper function for countries not in the helper
      const getFlag = (code: string) => {
        const flags: Record<string, string> = {
          'GB': '🇬🇧', 'US': '🇺🇸', 'DE': '🇩🇪', 'FR': '🇫🇷', 
          'CA': '🇨🇦', 'AU': '🇦🇺', 'ES': '🇪🇸', 'IT': '🇮🇹',
          'NL': '🇳🇱', 'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰'
        };
        return flags[code] || '🏳️';
      };
      
      const countries = activeCountries.map((country: any) => ({
        code: country.code,
        currency: country.currency_code,
        flag: getFlag(country.code),
        name: country.name
      }));

      const pricingPromises = countries.map(async ({ code, currency, flag, name }) => {
        try {
          console.log(`🔍 Fetching pricing for ${name} (${code}) with UID: ${productUid}, converting to ${currency}`);
          // Use enhanced API with automatic currency conversion
          const response = await fetch(`/api/admin/gelato-products?action=base-cost&uid=${productUid}&country=${code}&currency=${currency}`);
          const result = await response.json();
          
          console.log(`📊 ${name} (${code}) pricing result:`, result);
          
          if (result.success && result.baseCost) {
            console.log(`✅ ${name} (${code}) pricing successful:`, result.baseCost);
            
            if (result.baseCost.originalCurrency !== result.baseCost.currency) {
              console.log(`💱 Currency conversion: ${result.baseCost.originalPrice?.toFixed(2)} ${result.baseCost.originalCurrency} → ${result.baseCost.price.toFixed(2)} ${result.baseCost.currency} (${result.baseCost.conversionSource})`);
            }
            
            return {
              country: code,
              countryName: name,
              flag: flag,
              currency: result.baseCost.currency,
              price: result.baseCost.price,
              quantity: result.baseCost.quantity,
              originalPrice: result.baseCost.originalPrice,
              originalCurrency: result.baseCost.originalCurrency,
              conversionRate: result.baseCost.conversionRate,
              conversionSource: result.baseCost.conversionSource,
              success: true
            };
          }
          console.warn(`❌ ${name} (${code}) pricing failed:`, result.error || 'No pricing data');
          return { country: code, countryName: name, flag: flag, currency, success: false, error: result.error || 'No pricing data' };
        } catch (error) {
          console.error(`💥 ${name} (${code}) pricing error:`, error);
          return { country: code, countryName: name, flag: flag, currency, success: false, error: error.message };
        }
      });

      const pricingResults = await Promise.all(pricingPromises);
      console.log('📋 All pricing results:', pricingResults);
      
      const successfulPricing = pricingResults.filter(p => p.success);
      console.log('✅ Successful pricing results:', successfulPricing);

      if (successfulPricing.length > 0) {
        // Currency conversion is now handled automatically by the enhanced API
        const convertedPricing = successfulPricing;
        
        const filteredPricing = convertedPricing;
        
        // Group by currency for better display
        const byCurrency = filteredPricing.reduce((acc, pricing) => {
          if (!acc[pricing.currency]) {
            acc[pricing.currency] = [];
          }
          acc[pricing.currency].push(pricing);
          return acc;
        }, {} as Record<string, any[]>);

        setProductPricing(prev => ({
          ...prev,
          [productUid]: {
            byCurrency,
            allPricing: filteredPricing,
            lastUpdated: new Date().toISOString()
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
                    className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                  >
                    💰 Get Pricing
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

            {/* Gelato Pricing */}
            {formData.gelato_sku && formData.gelato_sku.length > 10 && formData.gelato_sku !== 'canvas' && (
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                <h4 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center">
                  💰 Gelato Costs & Retail Pricing
                  {productPricing[formData.gelato_sku] ? (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✅ Loaded</span>
                  ) : (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">Click "Get Pricing" to load</span>
                  )}
                  <Link href="/admin/pricing" className="ml-auto">
                    <Button variant="outline" size="sm" className="text-xs">
                      Manage Pricing
                    </Button>
                  </Link>
                </h4>
                
                {productPricing[formData.gelato_sku] && (
                  <>
                    {/* Native Currency Pricing */}
                    {productPricing[formData.gelato_sku].byCurrency && (
                      <div className="space-y-4">
                        {Object.entries(productPricing[formData.gelato_sku].byCurrency).map(([currency, prices]) => {
                          const priceArray = prices as any[];
                          if (!priceArray || priceArray.length === 0) return null;
                          
                          // Calculate retail pricing with 70% margin
                          const calculateRetailPriceWith70Margin = (cost: number): number => {
                            const retailPrice = cost / 0.30;
                            return Math.round(retailPrice / 2.5) * 2.5;
                          };
                          
                          // Format price display
                          const formatLocalPrice = (price: number | string, currency: string) => {
                            const numPrice = typeof price === 'string' ? parseFloat(price) : price;
                            return `${numPrice.toFixed(2)} ${currency}`;
                          };

                          return (
                            <div key={currency} className="bg-white p-3 rounded-lg border border-yellow-200">
                              <div className="flex justify-between items-center mb-2">
                                <h5 className="font-semibold text-yellow-800 text-lg">{currency} Pricing</h5>
                                <span className="text-xs text-gray-500">
                                  {priceArray.length} market{priceArray.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {priceArray.map((pricing, index) => {
                                  const costPrice = typeof pricing.price === 'string' ? parseFloat(pricing.price) : pricing.price;
                                  const retailPrice = calculateRetailPriceWith70Margin(costPrice);
                                  const margin = ((retailPrice - costPrice) / retailPrice * 100);
                                  
                                  return (
                                    <div key={`${pricing.country}-${index}`} className="p-3 bg-white rounded border border-gray-200">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                          <span className="text-lg">{pricing.flag}</span>
                                          {pricing.countryName || pricing.country}
                                        </span>
                                      </div>
                                      
                                      <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Cost:</span>
                                          <span className="font-mono text-yellow-800">{formatLocalPrice(pricing.price, pricing.currency)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Retail (70% margin):</span>
                                          <span className="font-mono text-green-700 font-semibold">{formatLocalPrice(retailPrice, pricing.currency)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                          <span className="text-gray-500">Margin:</span>
                                          <span className="text-gray-500">{margin.toFixed(1)}%</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              
                              {priceArray.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-gray-200">
                                  <div className="text-xs text-gray-600">
                                    <div className="flex justify-between">
                                      <span>Avg Cost:</span>
                                      <span>{formatLocalPrice((priceArray.reduce((sum, p) => sum + parseFloat(p.price || 0), 0) / priceArray.length), currency)}</span>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                      <span>Avg Retail:</span>
                                      <span className="font-medium text-green-700">
                                        {formatLocalPrice(calculateRetailPriceWith70Margin(priceArray.reduce((sum, p) => sum + parseFloat(p.price || 0), 0) / priceArray.length), currency)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        {productPricing[formData.gelato_sku].lastUpdated && (
                          <div className="text-xs text-gray-500 text-center">
                            Updated: {new Date(productPricing[formData.gelato_sku].lastUpdated).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                
                {!productPricing[formData.gelato_sku] && (
                  <div className="text-sm text-yellow-700 bg-white p-3 rounded border">
                    <p className="mb-2">📋 <strong>To get pricing:</strong></p>
                    <ol className="text-xs list-decimal list-inside space-y-1">
                      <li>Select all required product variants above</li>
                      <li>Ensure you have a complete Product UID</li>
                      <li>Click the "💰 Get Pricing" button</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* Product Details moved from separate card */}
            <div className="border-t pt-6">
              <h4 className="font-semibold text-gray-900 mb-4">Product Details</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Product description (auto-generated from selections)"
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
              </div>
            </div>
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

            {/* Product Weight */}
            {formData.product_weight_g && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Weight
                </label>
                <div className="p-3 bg-gray-50 rounded border">
                  <div className="text-sm font-medium text-gray-900">
                    {formData.product_weight_g}g ({(formData.product_weight_g / 1000).toFixed(2)}kg)
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Weight from Gelato product specifications
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Details moved to Product Information card */}

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
                  <PawSpinner size="sm" className="mr-2" />
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
                    <PawSpinner size="sm" className="mr-2" />
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

                {/* Variant Selection or SKU Selection */}
                <div className="space-y-4 overflow-y-auto">
                  {selectedGelatoProduct && (
                    <>
                      <div className="sticky top-0 bg-white py-2 border-b space-y-3">
                        <h3 className="font-semibold text-gray-900">
                          {showSkuDropdown ? 'Available SKUs' : 'Product Configuration'}
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
                        
                        {/* Toggle between SKU selection and variant configuration */}
                        {showSkuDropdown && (
                          <div className="flex items-center space-x-4">
                            <Button
                              type="button"
                              size="sm"
                              variant={showSkuDropdown ? "default" : "outline"}
                              onClick={() => setShowSkuDropdown(true)}
                            >
                              Choose SKU Directly
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={!showSkuDropdown ? "default" : "outline"}
                              onClick={() => setShowSkuDropdown(false)}
                            >
                              Configure Variants
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {/* SKU Selection Interface */}
                        {showSkuDropdown && availableSkus.length > 0 ? (
                          <div className="space-y-3">
                            {loadingSkus ? (
                              <div className="text-center py-4">
                                <PawSpinner size="sm" className="mx-auto" />
                                <p className="text-sm text-gray-600 mt-2">Loading available SKUs...</p>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm text-gray-600 mb-3">
                                  Found {availableSkus.length} available SKUs. Select one to automatically populate product details.
                                </p>
                                <div className="max-h-96 overflow-y-auto space-y-2">
                                  {availableSkus.map((sku, index) => (
                                    <div
                                      key={sku.uid || index}
                                      className="p-3 border rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                                      onClick={() => selectSkuDirectly(sku)}
                                    >
                                      <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                          <div className="font-medium text-gray-900 mb-1">
                                            {sku.title || sku.uid}
                                          </div>
                                          <div className="text-xs font-mono text-blue-600 mb-2 break-all">
                                            {sku.uid}
                                          </div>
                                          {sku.dimensions && (
                                            <div className="text-sm text-gray-600 space-y-1">
                                              {sku.dimensions.Width && sku.dimensions.Height && (
                                                <div>
                                                  📐 {sku.dimensions.Width.value}×{sku.dimensions.Height.value} {sku.dimensions.Width.unit || 'mm'}
                                                  {' '}({(sku.dimensions.Width.value / 25.4).toFixed(1)}×{(sku.dimensions.Height.value / 25.4).toFixed(1)} inches)
                                                </div>
                                              )}
                                              {sku.dimensions.Weight && (
                                                <div>⚖️ {sku.dimensions.Weight.value}g</div>
                                              )}
                                            </div>
                                          )}
                                          {sku.description && (
                                            <div className="text-xs text-gray-500 mt-2">
                                              {sku.description.slice(0, 100)}{sku.description.length > 100 ? '...' : ''}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        ) : showSkuDropdown ? (
                          <div className="text-center py-8 text-gray-500">
                            <p>No SKUs available for this product type.</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setShowSkuDropdown(false)}
                              className="mt-2"
                            >
                              Configure Variants Instead
                            </Button>
                          </div>
                        ) : (
                          /* Variant Selection Interface */
                          selectedGelatoProduct?.variants && selectedGelatoProduct.variants.length > 0 ? (
                          (() => {
                            // Process all variants including "Unified" formats
                            const processedVariants = selectedGelatoProduct.variants
                              .map((variant) => {
                                // Safety check for variant structure
                                if (!variant || !variant.uid || !variant.name) {
                                  return null;
                                }
                                
                                // Note: Unified formats are now allowed and active
                                
                                // Filter values based on unit preference
                                const filteredValues = variant.values?.filter(value => {
                                  // Add null/undefined checks to prevent errors
                                  if (!value || !value.title || typeof value.title !== 'string') {
                                    return false;
                                  }
                                  
                                  const titleLower = value.title.toLowerCase();
                                  if (gelatoUnitFilter === 'mm') {
                                    return !titleLower.includes('inch') && !titleLower.includes('"');
                                  } else {
                                    return titleLower.includes('inch') || titleLower.includes('"');
                                  }
                                }) || [];
                                
                                // If no values match filter, show all values (with safety check)
                                const valuesToShow = filteredValues.length > 0 ? filteredValues : (variant.values || []);
                                
                                // Sort values alphabetically by title
                                const sortedValues = valuesToShow.sort((a, b) => {
                                  if (!a.title || !b.title) return 0;
                                  return a.title.localeCompare(b.title);
                                });
                                
                                return {
                                  ...variant,
                                  valuesToShow: sortedValues,
                                  hasMultipleValues: sortedValues.length > 1
                                };
                              })
                              .filter(Boolean); // Remove null entries
                            
                            // Sort variants: multi-value first, single-value last
                            const sortedVariants = processedVariants.sort((a, b) => {
                              if (a.hasMultipleValues && !b.hasMultipleValues) return -1;
                              if (!a.hasMultipleValues && b.hasMultipleValues) return 1;
                              return 0;
                            });
                            
                            return sortedVariants.map((variant) => (
                              <div key={variant.uid} className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                  {variant.name}
                                </label>
                                
                                {variant.hasMultipleValues ? (
                                  // Multi-value: Show dropdown
                                  <Select
                                    value={selectedVariantValues[variant.uid]?.uid || ''}
                                    onValueChange={(valueUid) => {
                                      const selectedValue = variant.valuesToShow.find(v => v.uid === valueUid);
                                      if (selectedValue) {
                                        updateFormWithSelectedVariants(variant.uid, selectedValue);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder={`Select ${variant.name.toLowerCase()}`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {variant.valuesToShow.map(value => (
                                        <SelectItem key={value.uid} value={value.uid}>
                                          {value.title}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  // Single value: Show as text (auto-selection handled elsewhere)
                                  <div className="p-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-700">
                                    {variant.valuesToShow[0]?.title || 'No value available'}
                                  </div>
                                )}
                                
                                {selectedVariantValues[variant.uid] && (
                                  <div className="text-xs text-gray-500">
                                    Selected: {selectedVariantValues[variant.uid].title}
                                  </div>
                                )}
                              </div>
                            ));
                          })()
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            {selectedGelatoProduct ? 'No variants available for this product' : 'Select a product to see variants'}
                          </div>
                        ))}
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