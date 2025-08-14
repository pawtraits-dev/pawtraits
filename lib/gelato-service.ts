/**
 * Gelato Print-on-Demand API Integration
 * 
 * Official Gelato API Documentation: https://developers.gelato.com/
 * This service handles order creation, status tracking, and webhook handling
 */

export interface GelatoAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface GelatoLineItem {
  productUid: string;
  variantUid: string;
  quantity: number;
  printFileUrl: string;
  printFileType?: 'url' | 'base64';
  personalizationParts?: Record<string, any>;
}

export interface GelatoOrderRequest {
  externalId: string;
  orderReferenceId?: string;
  shippingAddress: GelatoAddress;
  items: GelatoLineItem[];
  currency: string;
  shipmentMethodUid?: string;
  metadata?: Record<string, string>;
}

export interface GelatoOrderResponse {
  id: string;
  externalId: string;
  status: string;
  currency: string;
  totalCost: number;
  createdAt: string;
  items: Array<{
    id: string;
    productUid: string;
    variantUid: string;
    quantity: number;
    printFileUrl: string;
    status: string;
  }>;
  shipments: Array<{
    id: string;
    trackingNumber?: string;
    trackingUrl?: string;
    status: string;
  }>;
}

export interface GelatoProduct {
  uid: string;
  title: string;
  description: string;
  variants: GelatoVariant[];
}

export interface GelatoVariant {
  uid: string;
  title: string;
  size: {
    width: number;
    height: number;
    unit: string;
  };
  currency: string;
  price: number;
  placeholders: GelatoPlaceholder[];
}

export interface GelatoPlaceholder {
  name: string;
  width: number;
  height: number;
  dpi: number;
}

export interface GelatoPriceData {
  productUid: string;
  country: string;
  quantity: number;
  price: number;
  currency: string;
  pageCount?: number;
}

export interface GelatoPricingOptions {
  country?: string;
  currency?: string;
  pageCount?: number;
}

export interface GelatoBaseCost {
  price: number;
  currency: string;
  quantity: number;
}

export class GelatoService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = process.env.GELATO_API_BASE_URL || 'https://product.gelatoapis.com';
    this.apiKey = process.env.GELATO_API_KEY || '';
  }

  private validateApiKey(): void {
    if (!this.apiKey) {
      throw new Error('GELATO_API_KEY environment variable is required');
    }
  }

  private getHeaders(): HeadersInit {
    this.validateApiKey();
    return {
      'Content-Type': 'application/json',
      'X-API-KEY': this.apiKey,
      'User-Agent': 'Pawtraits/1.0'
    };
  }

  /**
   * Get available products from Gelato catalog
   */
  async getProducts(): Promise<GelatoProduct[]> {
    try {
      // Get catalogs first, then get products from each catalog
      const response = await fetch(`${this.baseUrl}/v3/catalogs`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gelato API error response:', errorText);
        throw new Error(`Gelato API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const response_data = await response.json();
      console.log('Gelato catalogs response success');
      
      // Extract catalogs array from response
      const catalogsArray = response_data.data || [];
      
      // Filter for print-related catalogs that are good for pet portraits
      const printCatalogs = catalogsArray.filter((catalog: any) => {
        const uid = catalog.catalogUid || '';
        return uid === 'posters' ||
               uid === 'canvas' ||
               uid === 'acrylic' ||
               uid === 'metallic' ||
               uid === 'framed-posters' ||
               uid === 'framed-canvas' ||
               uid === 'wood-prints' ||
               uid === 'wallpaper' ||
               uid === 'foam-print-product';
      });
      
      console.log(`Found ${printCatalogs.length} print catalogs:`, printCatalogs.map(c => c.catalogUid));
      
      // Return catalog list as products
      return printCatalogs.map((catalog: any) => ({
        uid: catalog.catalogUid,
        name: catalog.title,
        description: `${catalog.title} - Perfect for pet portraits`,
        category: 'Print',
        variants: []
      }));
    } catch (error) {
      console.error('Error fetching Gelato products:', error);
      throw error;
    }
  }

  /**
   * Get specific catalog details including product attributes (variants)
   */
  async getProduct(catalogUid: string): Promise<GelatoProduct> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/catalogs/${catalogUid}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gelato API error response:', errorText);
        throw new Error(`Gelato API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Gelato catalog details response:', data);
      
      // Convert product attributes to variants format
      const variants = data.productAttributes?.map((attr: any) => {
        console.log(`Processing attribute: ${attr.productAttributeUid}`, attr.values);
        
        // Handle both array and object formats for values
        let values = [];
        if (Array.isArray(attr.values)) {
          values = attr.values.map((val: any) => ({
            uid: val.productAttributeValueUid || val.uid,
            title: val.title || val.name
          }));
        } else if (attr.values && typeof attr.values === 'object') {
          // Handle single object value
          values = [{
            uid: attr.values.productAttributeValueUid || attr.values.uid,
            title: attr.values.title || attr.values.name
          }];
        }
        
        return {
          uid: attr.productAttributeUid,
          name: attr.title,
          values: values
        };
      }) || [];
      
      console.log('Processed variants:', variants);

      return {
        uid: data.catalogUid,
        name: data.title,
        description: `${data.title} catalog with ${variants.length} attributes`,
        category: 'Print',
        variants: variants
      };
    } catch (error) {
      console.error('Error fetching Gelato catalog:', error);
      throw error;
    }
  }

  /**
   * Create an order with Gelato
   */
  async createOrder(orderData: GelatoOrderRequest): Promise<GelatoOrderResponse> {
    try {
      console.log('Creating Gelato order:', {
        externalId: orderData.externalId,
        itemCount: orderData.items.length,
        currency: orderData.currency
      });

      // Use the orders API endpoint
      const response = await fetch('https://order.gelatoapis.com/v4/orders', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Gelato order creation failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody
        });
        throw new Error(`Gelato order creation failed: ${response.status} ${response.statusText}`);
      }

      const order = await response.json();
      console.log('Gelato order created successfully:', order.id);
      return order;
    } catch (error) {
      console.error('Error creating Gelato order:', error);
      throw error;
    }
  }

  /**
   * Get order status from Gelato
   */
  async getOrder(orderId: string): Promise<GelatoOrderResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v4/orders/${orderId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Gelato API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching Gelato order:', error);
      throw error;
    }
  }

  /**
   * Get shipping methods for a country
   */
  async getShippingMethods(countryCode: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v4/shipment-methods?country=${countryCode}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Gelato API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.shipmentMethods || [];
    } catch (error) {
      console.error('Error fetching shipping methods:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive pricing for a product (replaces old variant-based pricing)
   * Uses new Gelato API: GET /v3/products/{productUid}/prices
   */
  async getProductPrices(productUid: string, options?: {
    country?: string;
    currency?: string;
    pageCount?: number;
  }): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (options?.country) params.append('country', options.country);
      if (options?.currency) params.append('currency', options.currency);
      if (options?.pageCount) params.append('pageCount', options.pageCount.toString());
      
      const url = `${this.baseUrl}/v3/products/${productUid}/prices${params.toString() ? '?' + params.toString() : ''}`;
      
      console.log(`Fetching Gelato pricing for ${productUid}:`, url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gelato pricing API error response:', errorText);
        throw new Error(`Gelato API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Gelato pricing response:', data);
      
      return data; // Returns array of pricing objects with quantities
    } catch (error) {
      console.error('Error fetching Gelato product prices:', error);
      throw error;
    }
  }

  /**
   * Get pricing for multiple countries at once
   */
  async getMultiCountryPricing(productUid: string, countries: string[] = ['GB', 'US', 'DE', 'FR']): Promise<Record<string, any[]>> {
    try {
      console.log(`Fetching multi-country pricing for ${productUid}:`, countries);
      
      const pricingPromises = countries.map(async (country) => {
        try {
          const prices = await this.getProductPrices(productUid, { country });
          return { country, success: true, prices };
        } catch (error) {
          return { 
            country, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const results = await Promise.all(pricingPromises);
      
      // Convert to object format for easy access
      const pricingData: Record<string, any[]> = {};
      results.forEach(result => {
        if (result.success) {
          pricingData[result.country] = result.prices;
        } else {
          console.warn(`Failed to get pricing for ${result.country}:`, result.error);
          pricingData[result.country] = [];
        }
      });
      
      return pricingData;
    } catch (error) {
      console.error('Error fetching multi-country pricing:', error);
      throw error;
    }
  }

  /**
   * Get the lowest cost for a product (typically quantity 1)
   */
  async getBaseCost(productUid: string, country: string = 'GB'): Promise<{
    price: number;
    currency: string;
    quantity: number;
  } | null> {
    try {
      const prices = await this.getProductPrices(productUid, { country });
      
      if (!prices || prices.length === 0) {
        return null;
      }
      
      // Find the price for quantity 1, or the lowest quantity available
      const sortedPrices = prices.sort((a, b) => a.quantity - b.quantity);
      const basePrice = sortedPrices[0];
      
      return {
        price: basePrice.price,
        currency: basePrice.currency,
        quantity: basePrice.quantity
      };
    } catch (error) {
      console.error('Error getting base cost:', error);
      return null;
    }
  }

  /**
   * Legacy method for backwards compatibility
   * @deprecated Use getProductPrices instead
   */
  async getProductPricing(productUid: string, variantUid: string, countryCode: string): Promise<any> {
    console.warn('getProductPricing is deprecated. Use getProductPrices instead.');
    
    try {
      const prices = await this.getProductPrices(productUid, { country: countryCode });
      
      if (!prices || prices.length === 0) {
        throw new Error('No pricing data available');
      }
      
      const basePrice = prices.find(p => p.quantity === 1) || prices[0];
      
      return {
        productUid,
        variantUid, // Keep for compatibility
        countryCode,
        currency: basePrice.currency,
        price: basePrice.price,
        formattedPrice: `${basePrice.currency} ${basePrice.price}`,
        quantity: basePrice.quantity,
        allPrices: prices // Include all pricing tiers
      };
    } catch (error) {
      console.error('Error in legacy getProductPricing:', error);
      throw error;
    }
  }

  /**
   * Search for products in a catalog with specific attribute filters
   * Returns the exact Product UID for the attribute combination
   */
  async searchProducts(catalogUid: string, attributeFilters: Record<string, string[]>): Promise<any[]> {
    try {
      console.log(`Searching products in catalog ${catalogUid} with filters:`, attributeFilters);
      
      const response = await fetch(`${this.baseUrl}/v3/catalogs/${catalogUid}/products:search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          attributeFilters,
          limit: 10  // Limit results since we're looking for exact matches
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gelato product search API error:', errorText);
        throw new Error(`Gelato API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Gelato product search response:', data);
      return data.products || [];
    } catch (error) {
      console.error('Error searching Gelato products:', error);
      throw error;
    }
  }

  /**
   * Get the correct Product UID based on selected variant attributes
   * Returns both the Product UID and detailed product information including dimensions
   */
  async getProductUidFromAttributes(catalogUid: string, selectedAttributes: Record<string, string>): Promise<{
    productUid: string;
    productDetails: any;
  } | null> {
    try {
      // Convert selected attributes to filter format
      const attributeFilters: Record<string, string[]> = {};
      Object.entries(selectedAttributes).forEach(([key, value]) => {
        if (value) {
          attributeFilters[key] = [value];
        }
      });

      const products = await this.searchProducts(catalogUid, attributeFilters);
      
      if (products.length === 0) {
        console.warn('No products found for attribute combination:', selectedAttributes);
        return null;
      }
      
      if (products.length > 1) {
        console.warn('Multiple products found, using first one. Products:', products.map(p => p.productUid));
      }

      const product = products[0];
      const productUid = product.productUid;
      
      console.log('✅ Found exact Gelato Product UID:', productUid);
      console.log('Product details:', product);
      
      return {
        productUid,
        productDetails: product
      };
    } catch (error) {
      console.error('Error getting Product UID from attributes:', error);
      return null;
    }
  }

  /**
   * Get bulk pricing for multiple product variants
   */
  async getBulkPricing(requests: Array<{productUid: string, variantUid: string, countryCode: string}>): Promise<any[]> {
    try {
      const pricing = await Promise.all(
        requests.map(async (req) => {
          try {
            const data = await this.getProductPricing(req.productUid, req.variantUid, req.countryCode);
            return { ...req, success: true, data };
          } catch (error) {
            return { ...req, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        })
      );

      return pricing;
    } catch (error) {
      console.error('Error fetching bulk pricing:', error);
      throw error;
    }
  }

  /**
   * Convert our order data to Gelato format
   */
  mapOrderToGelato(
    order: any,
    orderItems: any[],
    imageUrls: Record<string, string>
  ): GelatoOrderRequest {
    // Map shipping address
    const shippingAddress: GelatoAddress = {
      firstName: order.shipping_first_name,
      lastName: order.shipping_last_name,
      address1: order.shipping_address,
      city: order.shipping_city,
      postalCode: order.shipping_postcode,
      country: this.mapCountryToGelatoCode(order.shipping_country),
      email: order.customer_email
    };

    // Map order items to Gelato line items
    const items: GelatoLineItem[] = orderItems.map(item => ({
      productUid: this.mapProductToGelatoUID(item.product_data),
      variantUid: this.mapVariantToGelatoUID(item.product_data),
      quantity: item.quantity,
      printFileUrl: imageUrls[item.image_id] || '',
      printFileType: 'url' as const,
      personalizationParts: {
        // Add any custom text or personalization data
        title: item.image_title || '',
      }
    }));

    return {
      externalId: order.order_number,
      orderReferenceId: order.id,
      shippingAddress,
      items,
      currency: order.currency.toUpperCase(),
      metadata: {
        pawtraitsOrderId: order.id,
        paymentIntentId: order.payment_intent_id,
        customerEmail: order.customer_email,
        isPartnerOrder: order.metadata?.isPartnerOrder || 'false'
      }
    };
  }

  /**
   * Map our product data to Gelato product UID
   * This would be configured based on your product catalog mapping
   */
  private mapProductToGelatoUID(productData: any): string {
    // Map based on medium type
    const medium = productData.medium?.name?.toLowerCase() || '';
    
    if (medium.includes('canvas')) {
      return 'premium-canvas-prints_premium-canvas-portrait-210gsm';
    } else if (medium.includes('paper')) {
      return 'premium-posters_premium-poster-portrait-210gsm';
    } else if (medium.includes('metal') || medium.includes('aluminum')) {
      return 'metal-prints_metal-print-white-base';
    } else if (medium.includes('acrylic')) {
      return 'acrylic-prints_acrylic-print-3mm';
    }
    
    // Default to canvas if unsure
    return 'premium-canvas-prints_premium-canvas-portrait-210gsm';
  }

  /**
   * Map our product variant to Gelato variant UID
   */
  private mapVariantToGelatoUID(productData: any): string {
    const width = productData.width_cm || 20;
    const height = productData.height_cm || 20;
    
    // Map size to Gelato variant UIDs
    // These would need to be configured based on actual Gelato catalog
    if (width === 20 && height === 20) {
      return '20x20-cm';
    } else if (width === 30 && height === 30) {
      return '30x30-cm';
    } else if (width === 40 && height === 40) {
      return '40x40-cm';
    } else if (width === 20 && height === 30) {
      return '20x30-cm';
    } else if (width === 30 && height === 40) {
      return '30x40-cm';
    } else if (width === 40 && height === 60) {
      return '40x60-cm';
    }
    
    // Default variant
    return '30x30-cm';
  }

  /**
   * Map country names to Gelato country codes
   */
  private mapCountryToGelatoCode(country: string): string {
    const countryMap: Record<string, string> = {
      'United Kingdom': 'GB',
      'United States': 'US',
      'Canada': 'CA',
      'Australia': 'AU',
      'Germany': 'DE',
      'France': 'FR',
      'Spain': 'ES',
      'Italy': 'IT',
      'Netherlands': 'NL',
      'Sweden': 'SE',
      'Norway': 'NO',
      'Denmark': 'DK',
      // Add more countries as needed
    };

    return countryMap[country] || 'GB'; // Default to GB
  }

  /**
   * Generate high-quality image URL for printing
   * Uses Cloudinary transformations to ensure print quality
   */
  generatePrintImageUrl(imageId: string, width: number, height: number): string {
    const cloudinaryBaseUrl = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    
    if (!cloudinaryBaseUrl) {
      console.warn('Cloudinary not configured, using fallback URL');
      return `/api/images/print/${imageId}?w=${width}&h=${height}`;
    }

    // Calculate required pixels for 300 DPI
    const pixelWidth = Math.ceil((width / 2.54) * 300); // cm to inches * DPI
    const pixelHeight = Math.ceil((height / 2.54) * 300);

    // Cloudinary transformation for high-quality print
    const transformation = [
      `w_${pixelWidth}`,
      `h_${pixelHeight}`,
      'c_fill', // Fill the dimensions exactly
      'f_auto', // Auto format selection
      'q_auto:best', // Best quality
      'dpr_1.0', // Device pixel ratio
      'fl_progressive:steep' // Progressive JPEG
    ].join(',');

    return `https://res.cloudinary.com/${cloudinaryBaseUrl}/image/upload/${transformation}/pawtraits_catalog/${imageId}`;
  }
}

// Factory function to create service instance when needed
export function createGelatoService(): GelatoService {
  return new GelatoService();
}

// Default export for convenience - lazy loaded
let _gelatoService: GelatoService | null = null;
export const gelatoService = {
  get instance(): GelatoService {
    if (!_gelatoService) {
      _gelatoService = new GelatoService();
    }
    return _gelatoService;
  }
};