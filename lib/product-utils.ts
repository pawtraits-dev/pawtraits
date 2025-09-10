import { SupabaseService } from './supabase';

// Common product description utility used across all order pages
export class ProductDescriptionService {
  private static instance: ProductDescriptionService;
  private supabaseService: SupabaseService;
  private productCache: {[key: string]: any} = {};

  private constructor() {
    this.supabaseService = new SupabaseService();
  }

  static getInstance(): ProductDescriptionService {
    if (!ProductDescriptionService.instance) {
      ProductDescriptionService.instance = new ProductDescriptionService();
    }
    return ProductDescriptionService.instance;
  }

  // Load product details for multiple orders
  async loadProductDetails(orders: any[]): Promise<{[key: string]: any}> {
    try {
      const productDetailsMap: {[key: string]: any} = {};
      
      // Get current user email for API authentication
      const { data: { user } } = await this.supabaseService.getClient().auth.getUser();
      if (!user?.email) {
        console.warn('No user email found for product details loading');
        return {};
      }
      
      // Collect all unique product IDs from all orders
      const allOrderItems = orders.flatMap(order => order.order_items || []);
      const uniqueProductIds = Array.from(new Set(allOrderItems.map(item => item.product_id)));
      console.log('Loading product details for IDs:', uniqueProductIds);
      
      // Fetch product details via API with proper URL encoding
      for (const productId of uniqueProductIds) {
        try {
          const encodedProductId = encodeURIComponent(productId);
          const url = `/api/shop/products/${encodedProductId}?email=${encodeURIComponent(user.email)}`;
          console.log(`Fetching URL: ${url}`);
          
          const response = await fetch(url);
          
          if (response.ok) {
            const product = await response.json();
            console.log(`Product details for ${productId}:`, product);
            productDetailsMap[productId] = product;
            // Also cache for future use
            this.productCache[productId] = product;
          } else {
            console.warn(`Failed to fetch product details for ${productId}, status:`, response.status);
            const errorText = await response.text();
            console.warn('Error response:', errorText);
          }
        } catch (error) {
          console.error(`Error fetching product details for ${productId}:`, error);
        }
      }
      
      console.log('Final product details map:', productDetailsMap);
      return productDetailsMap;
    } catch (error) {
      console.error('Error loading product details:', error);
      return {};
    }
  }

  // Get product description from loaded product data
  getProductDescription(productId: string, productDetails: {[key: string]: any}): string {
    const product = productDetails[productId] || this.productCache[productId];
    console.log(`Getting description for product ${productId}:`, product);
    
    if (product) {
      // Use the product name if available, otherwise construct it
      if (product.name) {
        return product.name;
      }
      // Fallback: construct description similar to generateDescription function
      const sizeName = product.size_name || '';
      const formatName = product.formats?.name || product.format?.name || '';
      const mediumName = product.media?.name || product.medium?.name || '';
      const description = `${sizeName} ${formatName} ${mediumName}`.trim();
      if (description) {
        return description;
      }
      // Final fallback with dimensions
      return `${product.width_cm || 'Unknown'} x ${product.height_cm || 'Unknown'}cm ${formatName} ${mediumName}`.trim();
    }
    
    // Show the current state for debugging
    const hasProductDetails = Object.keys(productDetails).length > 0;
    return hasProductDetails ? `No product found for ID: ${productId}` : 'Product details loading...';
  }

  // Format price consistently
  formatPrice(priceInPence: number, currency: string = 'GBP'): string {
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
    return `${symbol}${(priceInPence / 100).toFixed(2)}`;
  }

  // Comprehensive price display utility for order items
  getOrderItemPricing(item: any, order: any) {
    const currency = order.currency || 'GBP';
    
    return {
      // Original price (before any discounts)
      originalPrice: item.original_price ? this.formatPrice(item.original_price, currency) : null,
      
      // Current unit price (after discounts)
      unitPrice: this.formatPrice(item.unit_price, currency),
      
      // Total price for this item (unit_price × quantity)
      totalPrice: this.formatPrice(item.total_price, currency),
      
      // Discount calculations
      hasDiscount: item.original_price && item.original_price !== item.unit_price,
      discountPerUnit: item.original_price && item.original_price !== item.unit_price 
        ? item.original_price - item.unit_price 
        : 0,
      discountTotal: item.original_price && item.original_price !== item.unit_price 
        ? (item.original_price - item.unit_price) * item.quantity 
        : 0,
      discountPercentage: item.original_price && item.original_price !== item.unit_price
        ? Math.round(((item.original_price - item.unit_price) / item.original_price) * 100)
        : 0,
      
      // Formatted discount amounts
      discountPerUnitFormatted: item.original_price && item.original_price !== item.unit_price 
        ? this.formatPrice(item.original_price - item.unit_price, currency)
        : null,
      discountTotalFormatted: item.original_price && item.original_price !== item.unit_price 
        ? this.formatPrice((item.original_price - item.unit_price) * item.quantity, currency)
        : null,
      
      // Quantity
      quantity: item.quantity,
      
      // Raw values (for calculations)
      raw: {
        originalPrice: item.original_price || item.unit_price,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        discountPerUnit: item.original_price && item.original_price !== item.unit_price 
          ? item.original_price - item.unit_price 
          : 0,
        discountTotal: item.original_price && item.original_price !== item.unit_price 
          ? (item.original_price - item.unit_price) * item.quantity 
          : 0
      }
    };
  }

  // Comprehensive price display utility for orders
  getOrderPricing(order: any) {
    const currency = order.currency || 'GBP';
    
    // Calculate totals from items
    const items = order.order_items || [];
    const itemsTotal = items.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0);
    const originalTotal = items.reduce((sum: number, item: any) => 
      sum + ((item.original_price || item.unit_price) * item.quantity), 0);
    const totalDiscount = originalTotal - itemsTotal;
    
    return {
      // Order totals
      subtotal: this.formatPrice(order.subtotal_amount || itemsTotal, currency),
      shipping: this.formatPrice(order.shipping_amount || 0, currency),
      total: this.formatPrice(order.total_amount, currency),
      
      // Discount information
      hasOrderDiscount: totalDiscount > 0,
      totalDiscountAmount: totalDiscount,
      totalDiscountFormatted: totalDiscount > 0 ? this.formatPrice(totalDiscount, currency) : null,
      
      // Raw values
      raw: {
        subtotal: order.subtotal_amount || itemsTotal,
        shipping: order.shipping_amount || 0,
        total: order.total_amount,
        discount: totalDiscount
      },
      
      // Currency
      currency,
      currencySymbol: currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'
    };
  }

  // Generate discount messaging based on user type
  getDiscountMessage(pricing: any, userType: 'customer' | 'partner' | 'admin' = 'customer') {
    if (!pricing.hasDiscount) return null;
    
    const messages = {
      customer: `You saved: ${pricing.discountTotalFormatted}`,
      partner: `Partner Discount: ${pricing.discountTotalFormatted} (${pricing.discountPercentage}% off)`,
      admin: `Discount Applied: ${pricing.discountTotalFormatted} (${pricing.discountPercentage}% off)`
    };
    
    return messages[userType];
  }

  // Clear cache if needed
  clearCache(): void {
    this.productCache = {};
  }
}

// Export singleton instance
export const productDescriptionService = ProductDescriptionService.getInstance();