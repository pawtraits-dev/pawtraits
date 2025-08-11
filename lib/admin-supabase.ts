import type { 
  Media, MediaCreate, MediaUpdate,
  Product, ProductCreate, ProductUpdate,
  Format
} from './product-types';

// Admin-specific Supabase service that uses API endpoints with service role
export class AdminSupabaseService {
  // ===== MEDIA METHODS =====
  async getMedia(activeOnly: boolean = false): Promise<Media[]> {
    try {
      const response = await fetch(`/api/admin/media?activeOnly=${activeOnly}`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting media:', error);
      return [];
    }
  }

  async getMediaById(id: string): Promise<Media | null> {
    try {
      const response = await fetch(`/api/admin/media?id=${id}`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error('Error getting media by id:', error);
      return null;
    }
  }

  async createMedia(mediaData: MediaCreate): Promise<Media | null> {
    try {
      const response = await fetch('/api/admin/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mediaData)
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error creating media:', error);
      return null;
    }
  }

  async updateMedia(mediaData: MediaUpdate): Promise<Media | null> {
    try {
      const response = await fetch('/api/admin/media', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mediaData)
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating media:', error);
      return null;
    }
  }

  async deleteMedia(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/admin/media?id=${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error deleting media:', error);
      return false;
    }
  }

  // ===== PRODUCT METHODS =====
  async getProducts(filters?: {
    activeOnly?: boolean;
    featuredOnly?: boolean;
    mediumId?: string;
    formatId?: string;
  }): Promise<Product[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.activeOnly !== undefined) {
        params.set('activeOnly', filters.activeOnly.toString());
      }
      if (filters?.featuredOnly) {
        params.set('featuredOnly', 'true');
      }
      if (filters?.mediumId) {
        params.set('mediumId', filters.mediumId);
      }
      if (filters?.formatId) {
        params.set('formatId', filters.formatId);
      }

      const response = await fetch(`/api/admin/products?${params.toString()}`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting products:', error);
      return [];
    }
  }

  async createProduct(productData: ProductCreate): Promise<Product | null> {
    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error creating product:', error);
      return null;
    }
  }

  async updateProduct(productData: any): Promise<Product | null> {
    try {
      const response = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating product:', error);
      return null;
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/admin/products?id=${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      return false;
    }
  }

  // ===== FORMAT METHODS =====
  async getFormats(): Promise<Format[]> {
    try {
      const response = await fetch('/api/admin/formats');
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting formats:', error);
      return [];
    }
  }

  async getFormatById(id: string): Promise<Format | null> {
    try {
      const response = await fetch(`/api/admin/formats?id=${id}`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting format by id:', error);
      return null;
    }
  }

  // ===== PRICING METHODS =====
  async getAllProductPricing(): Promise<any[]> {
    try {
      const response = await fetch('/api/admin/pricing');
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting all product pricing:', error);
      return [];
    }
  }

  async getProductPricing(productId: string, countryCode?: string): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.set('productId', productId);
      if (countryCode) {
        params.set('countryCode', countryCode);
      }

      const response = await fetch(`/api/admin/pricing?${params.toString()}`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting product pricing:', error);
      return [];
    }
  }

  async createProductPricing(pricingData: any): Promise<any> {
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pricingData)
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error creating pricing:', error);
      return null;
    }
  }

  async updateProductPricing(id: string, updates: any): Promise<any> {
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating pricing:', error);
      return null;
    }
  }

  async deleteProductPricing(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/admin/pricing?id=${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error deleting pricing:', error);
      return false;
    }
  }

  // ===== COUNTRY METHODS =====
  async getCountries(supportedOnly: boolean = true): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (!supportedOnly) {
        params.set('supportedOnly', 'false');
      }

      const response = await fetch(`/api/admin/countries?${params.toString()}`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting countries:', error);
      return [];
    }
  }
}

