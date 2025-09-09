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
      const uniqueProductIds = [...new Set(allOrderItems.map(item => item.product_id))];
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

  // Clear cache if needed
  clearCache(): void {
    this.productCache = {};
  }
}

// Export singleton instance
export const productDescriptionService = ProductDescriptionService.getInstance();