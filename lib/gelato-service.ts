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
      const variants = data.productAttributes?.map((attr: any) => ({
        uid: attr.productAttributeUid,
        name: attr.title,
        values: attr.values?.map((val: any) => ({
          uid: val.productAttributeValueUid,
          title: val.title
        })) || []
      })) || [];

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
   * Get pricing for a specific product variant in a country
   */
  async getProductPricing(productUid: string, variantUid: string, countryCode: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/products/${productUid}/variants/${variantUid}/pricing?country=${countryCode}`, {
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
      return {
        productUid,
        variantUid,
        countryCode,
        currency: data.currency,
        price: data.price,
        formattedPrice: data.formattedPrice,
        costs: data.costs || {},
        availableFrom: data.availableFrom,
        shippingCosts: data.shippingCosts || []
      };
    } catch (error) {
      console.error('Error fetching product pricing:', error);
      throw error;
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