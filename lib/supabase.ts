import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase-client';
import type { 
  ImageCatalogCreate, 
  ImageCatalogUpdate, 
  ImageCatalogWithDetails,
  Partner,
  PartnerCreate,
  PartnerUpdate,
  Referral,
  ReferralCreate,
  ReferralUpdate,
  CommissionPayment,
  PartnerStats,
  AnimalType
} from './types';
import type { UserProfile, UserType } from './user-types';
import type { 
  Media, MediaCreate, MediaUpdate,
  Product, ProductCreate, ProductUpdate,
  ProductPricing, ProductPricingCreate, ProductPricingUpdate,
  Country
} from './product-types';

// Client-side Supabase client
export const createClient = () => createClientComponentClient();

// Utility functions for common database operations
export class SupabaseService {
  private supabase = createClientComponentClient();

  // Public method to access the client for RPC calls
  public getClient() {
    return this.supabase;
  }

  // ===== USER PROFILES =====
  
  async getUserProfile(userId?: string): Promise<UserProfile | null> {
    try {
      console.log('SupabaseService.getUserProfile - userId:', userId);
      const { data, error } = await this.supabase
        .rpc('get_user_profile', { user_uuid: userId || undefined });
      
      console.log('SupabaseService.getUserProfile - RPC result:', { data, error });
      if (error) throw error;
      
      // The RPC returns TABLE, so data should be an array
      const profile = Array.isArray(data) ? data[0] : data;
      console.log('SupabaseService.getUserProfile - Final profile:', profile);
      return profile || null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  async getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
      console.log('SupabaseService.getCurrentUserProfile - Getting user...');
      const { data: { user } } = await this.supabase.auth.getUser();
      console.log('SupabaseService.getCurrentUserProfile - User:', user?.id, user?.email);
      if (!user) return null;
      
      return this.getUserProfile(user.id);
    } catch (error) {
      console.error('Error getting current user profile:', error);
      return null;
    }
  }

  async createUserProfile(
    userId: string,
    userType: UserType,
    profileData: Partial<UserProfile>
  ): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('create_user_profile', {
          p_user_id: userId,
          p_user_type: userType,
          p_first_name: profileData.first_name || null,
          p_last_name: profileData.last_name || null,
          p_email: profileData.email || null,
          p_phone: profileData.phone || null,
          p_partner_id: profileData.partner_id || null,
          p_customer_id: profileData.customer_id || null
        });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating user profile:', error);
      return null;
    }
  }

  async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      return null;
    }
  }

  // ===== PRODUCT SYSTEM =====

  // Media methods
  async getMedia(activeOnly: boolean = true): Promise<Media[]> {
    try {
      let query = this.supabase
        .from('media')
        .select('*')
        .order('display_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting media:', error);
      return [];
    }
  }

  async getMediaById(id: string): Promise<Media | null> {
    try {
      const { data, error } = await this.supabase
        .from('media')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting media by id:', error);
      return null;
    }
  }

  async createMedia(mediaData: MediaCreate): Promise<Media | null> {
    try {
      const { data, error } = await this.supabase
        .from('media')
        .insert(mediaData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating media:', error);
      return null;
    }
  }

  async updateMedia(id: string, updates: Partial<MediaUpdate>): Promise<Media | null> {
    try {
      const { data, error } = await this.supabase
        .from('media')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating media:', error);
      return null;
    }
  }

  async deleteMedia(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('media')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting media:', error);
      return false;
    }
  }

  // Product methods
  async getProducts(filters?: {
    activeOnly?: boolean;
    featuredOnly?: boolean;
    mediumId?: string;
    formatId?: string;
    countryCode?: string;
  }): Promise<Product[]> {
    try {
      let query = this.supabase
        .from('products')
        .select(`
          *,
          medium:media(*),
          format:formats(*)
        `);

      if (filters?.activeOnly !== false) {
        query = query.eq('is_active', true);
      }

      if (filters?.featuredOnly) {
        query = query.eq('is_featured', true);
      }

      if (filters?.mediumId) {
        query = query.eq('medium_id', filters.mediumId);
      }

      if (filters?.formatId) {
        query = query.eq('format_id', filters.formatId);
      }

      const { data: products, error } = await query;
      if (error) throw error;

      // Load pricing if country specified
      if (filters?.countryCode && products) {
        const productIds = products.map((p: any) => p.id);
        const { data: pricing } = await this.supabase
          .from('product_pricing')
          .select('*')
          .in('product_id', productIds)
          .eq('country_code', filters.countryCode);

        // Attach pricing to products
        products.forEach((product: any) => {
          product.current_pricing = pricing?.find((p: any) => p.product_id === product.id);
        });
      }

      return products || [];
    } catch (error) {
      console.error('Error getting products:', error);
      return [];
    }
  }

  async getProductById(id: string, countryCode?: string): Promise<Product | null> {
    try {
      const { data: product, error } = await this.supabase
        .from('products')
        .select(`
          *,
          medium:media(*),
          format:formats(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Load pricing
      if (product) {
        let pricingQuery = this.supabase
          .from('product_pricing')
          .select('*, country:countries(*)')
          .eq('product_id', id);

        if (countryCode) {
          pricingQuery = pricingQuery.eq('country_code', countryCode);
        }

        const { data: pricing } = await pricingQuery;
        product.pricing = pricing || [];
        
        if (countryCode) {
          product.current_pricing = pricing?.find((p: any) => p.country_code === countryCode);
        }
      }

      return product;
    } catch (error) {
      console.error('Error getting product by id:', error);
      return null;
    }
  }

  async createProduct(productData: ProductCreate): Promise<Product | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('create_product', {
          p_medium_id: productData.medium_id,
          p_format_id: productData.format_id,
          p_gelato_product_id: (productData as any).gelato_product_id || null,
          p_gelato_variant_id: (productData as any).gelato_variant_id || null
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating product:', error);
      return null;
    }
  }

  // Product pricing methods
  async getProductPricing(productId: string, countryCode?: string): Promise<ProductPricing[]> {
    try {
      let query = this.supabase
        .from('product_pricing')
        .select('*, country:countries(*)')
        .eq('product_id', productId);

      if (countryCode) {
        query = query.eq('country_code', countryCode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting product pricing:', error);
      return [];
    }
  }

  async createProductPricing(pricingData: ProductPricingCreate): Promise<ProductPricing | null> {
    try {
      const { data, error } = await this.supabase
        .from('product_pricing')
        .insert({
          ...pricingData,
          country_code: pricingData.country_code || 'GB',
          currency_code: (pricingData as any).currency_code || 'GBP'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating product pricing:', error);
      return null;
    }
  }

  async updateProductPricing(id: string, updates: Partial<ProductPricingUpdate>): Promise<ProductPricing | null> {
    try {
      const { data, error } = await this.supabase
        .from('product_pricing')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating product pricing:', error);
      return null;
    }
  }

  async getAllProductPricing(): Promise<ProductPricing[]> {
    try {
      const { data, error } = await this.supabase
        .from('product_pricing')
        .select('*, country:countries(*), product:products(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting all product pricing:', error);
      return [];
    }
  }

  // Public methods using API endpoints (bypass RLS for shop pages)
  async getPublicProducts(): Promise<Product[]> {
    try {
      const response = await fetch('/api/public/products');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Error getting public products:', error);
      return [];
    }
  }

  async getPublicProductPricing(): Promise<ProductPricing[]> {
    try {
      const response = await fetch('/api/public/pricing');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Error getting public product pricing:', error);
      return [];
    }
  }

  // Country methods
  async getCountries(supportedOnly: boolean = true): Promise<Country[]> {
    try {
      let query = this.supabase
        .from('countries')
        .select('*')
        .order('display_order', { ascending: true });

      if (supportedOnly) {
        query = query.eq('is_supported', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting countries:', error);
      return [];
    }
  }

  // ===== AUTHENTICATION WITH USER TYPES =====

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async getCurrentAdmin() {
    try {
      const profile = await this.getCurrentUserProfile();
      return profile?.user_type === 'admin' ? profile : null;
    } catch (error) {
      console.error('Error getting current admin:', error);
      return null;
    }
  }

  async getCurrentCustomer() {
    try {
      const profile = await this.getCurrentUserProfile();
      return profile?.user_type === 'customer' ? profile : null;
    } catch (error) {
      console.error('Error getting current customer:', error);
      return null;
    }
  }

  async getCustomerPets(customerId?: string) {
    try {
      // If no customerId provided, get current customer
      let targetUserId = customerId;
      
      if (!targetUserId) {
        const customer = await this.getCurrentCustomer();
        if (!customer) {
          throw new Error('No customer found');
        }
        targetUserId = customer.user_id;
      }

      const { data: pets, error } = await this.supabase
        .rpc('get_user_pets', { user_uuid: targetUserId });
      
      if (error) throw error;
      return pets || [];
    } catch (error) {
      console.error('Error getting customer pets:', error);
      return [];
    }
  }

  // Keep existing getCurrentPartner method but update it to use profiles
  async getCurrentPartner() {
    try {
      const profile = await this.getCurrentUserProfile();
      if (profile?.user_type === 'partner' && profile.partner_id) {
        // Get full partner details
        const { data: partner, error } = await this.supabase
          .from('partners')
          .select('*')
          .eq('id', profile.partner_id)
          .single();
        
        if (error) throw error;
        return partner;
      }
      return null;
    } catch (error) {
      console.error('Error getting current partner:', error);
      return null;
    }
  }

  // Breeds
  async getBreeds(animalType?: AnimalType) {
    let query = this.supabase
      .from('breeds')
      .select('*');
    
    if (animalType) {
      query = query.eq('animal_type', animalType);
    }
    
    const { data, error } = await query.order('popularity_rank', { ascending: true });
    
    if (error) throw error;
    return data;
  }

  async getBreed(id: string) {
    const { data, error } = await this.supabase
      .from('breeds')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  async createBreed(breed: any) {
    const { data, error } = await this.supabase
      .from('breeds')
      .insert(breed)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateBreed(id: string, updates: any) {
    const { data, error } = await this.supabase
      .from('breeds')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteBreed(id: string) {
    const { error } = await this.supabase
      .from('breeds')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Themes
  async getThemes() {
    const { data, error } = await this.supabase
      .from('themes')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data;
  }

  async getTheme(id: string) {
    const { data, error } = await this.supabase
      .from('themes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Styles
  async getStyles() {
    const { data, error } = await this.supabase
      .from('styles')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data;
  }

  async getStyle(id: string) {
    const { data, error } = await this.supabase
      .from('styles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Outfits
  async getOutfits() {
    const { data, error } = await this.supabase
      .from('outfits')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data;
  }

  async getOutfit(id: string) {
    const { data, error } = await this.supabase
      .from('outfits')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Formats
  async getFormats() {
    const { data, error } = await this.supabase
      .from('formats')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data;
  }

  async getFormat(id: string) {
    const { data, error } = await this.supabase
      .from('formats')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Coats
  async getCoats(animalType?: AnimalType) {
    let query = this.supabase
      .from('coats')
      .select('*');
    
    if (animalType) {
      query = query.eq('animal_type', animalType);
    }
    
    const { data, error } = await query.order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data;
  }

  async getCoat(id: string) {
    const { data, error } = await this.supabase
      .from('coats')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Breed-Coat relationships
  async getBreedCoats(breedId?: string, coatId?: string) {
    let query = this.supabase.from('breed_coat_details').select('*');
    
    if (breedId) query = query.eq('breed_id', breedId);
    if (coatId) query = query.eq('coat_id', coatId);
    
    const { data, error } = await query.order('popularity_rank', { ascending: true });
    
    if (error) throw error;
    return data;
  }

  async addBreedCoat(breedId: string, coatId: string, options?: {
    is_common?: boolean;
    is_standard?: boolean;
    popularity_rank?: number;
    notes?: string;
  }) {
    const { data, error } = await this.supabase
      .from('breed_coats')
      .insert({
        breed_id: breedId,
        coat_id: coatId,
        is_common: options?.is_common ?? true,
        is_standard: options?.is_standard ?? true,
        popularity_rank: options?.popularity_rank,
        notes: options?.notes
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async removeBreedCoat(breedId: string, coatId: string) {
    const { error } = await this.supabase
      .from('breed_coats')
      .delete()
      .eq('breed_id', breedId)
      .eq('coat_id', coatId);
    
    if (error) throw error;
  }

  // Image Storage and Catalog methods
  async uploadImage(file: File): Promise<{ success: boolean; filename?: string; path?: string; publicUrl?: string; error?: string }> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `images/${fileName}`;

      const { data, error } = await this.supabase.storage
        .from('pet-images')
        .upload(filePath, file);

      if (error) {
        return { success: false, error: error.message };
      }

      const { data: { publicUrl } } = this.supabase.storage
        .from('pet-images')
        .getPublicUrl(filePath);

      return {
        success: true,
        filename: fileName,
        path: filePath,
        publicUrl
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async deleteImageFile(path: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.storage
        .from('pet-images')
        .remove([path]);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getImages(filters?: {
    page?: number;
    limit?: number;
    breedId?: string | null;
    themeId?: string | null;
    styleId?: string | null;
    formatId?: string | null;
    coatId?: string | null;
    tags?: string[];
    featured?: boolean;
    publicOnly?: boolean;
    search?: string;
  }): Promise<ImageCatalogWithDetails[]> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('image_catalog')
      .select(`
        *,
        breeds(name, slug, animal_type),
        themes(name),
        styles(name),
        formats(name),
        coats(name, hex_color, animal_type)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters?.publicOnly !== false) {
      query = query.eq('is_public', true);
    }

    if (filters?.breedId) {
      query = query.eq('breed_id', filters.breedId);
    }

    if (filters?.themeId) {
      query = query.eq('theme_id', filters.themeId);
    }

    if (filters?.styleId) {
      query = query.eq('style_id', filters.styleId);
    }

    if (filters?.formatId) {
      query = query.eq('format_id', filters.formatId);
    }

    if (filters?.coatId) {
      query = query.eq('coat_id', filters.coatId);
    }

    if (filters?.featured === true) {
      query = query.eq('is_featured', true);
    }

    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    if (filters?.search && filters.search.trim() !== '') {
      const searchTerm = filters.search.trim().toLowerCase();
      const searchPattern = `%${searchTerm}%`;
      
      // Search in description, prompt_text, and tags array
      query = query.or(`description.ilike.${searchPattern},prompt_text.ilike.${searchPattern},tags.cs.{"${searchTerm}"}`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      breed_name: item.breeds?.name,
      breed_animal_type: item.breeds?.animal_type,
      theme_name: item.themes?.name,
      style_name: item.styles?.name,
      format_name: item.formats?.name,
      coat_name: item.coats?.name,
      coat_hex_color: item.coats?.hex_color,
      coat_animal_type: item.coats?.animal_type,
      // Explicitly preserve the coat_id field for filtering
      coat_id: item.coat_id,
      // Create nested objects to match interface expectations
      breed: item.breeds ? { id: item.breed_id, name: item.breeds.name, slug: item.breeds.slug || '', animal_type: item.breeds.animal_type } : undefined,
      theme: item.themes ? { id: item.theme_id, name: item.themes.name } : undefined,
      style: item.styles ? { id: item.style_id, name: item.styles.name } : undefined,  
      coat: item.coats ? { id: item.coat_id, name: item.coats.name, hex_color: item.coats.hex_color, animal_type: item.coats.animal_type } : undefined
    }));
  }

  async getImage(id: string): Promise<ImageCatalogWithDetails | null> {
    const { data, error } = await this.supabase
      .from('image_catalog')
      .select(`
        *,
        breeds(name, slug),
        themes(name),
        styles(name),
        formats(name),
        coats(name, hex_color)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return {
      ...data,
      breed_name: data.breeds?.name,
      theme_name: data.themes?.name,
      style_name: data.styles?.name,
      format_name: data.formats?.name,
      coat_name: data.coats?.name,
      coat_hex_color: data.coats?.hex_color,
      // Explicitly preserve the coat_id field for filtering
      coat_id: data.coat_id,
      // Create nested objects to match interface expectations
      breed: data.breeds ? { id: data.breed_id, name: data.breeds.name, slug: data.breeds.slug || '' } : undefined,
      theme: data.themes ? { id: data.theme_id, name: data.themes.name } : undefined,
      style: data.styles ? { id: data.style_id, name: data.styles.name } : undefined
    };
  }

  async createImage(imageData: ImageCatalogCreate) {
    const { data, error } = await this.supabase
      .from('image_catalog')
      .insert(imageData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateImage(id: string, updates: ImageCatalogUpdate) {
    const { data, error } = await this.supabase
      .from('image_catalog')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteImage(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('image_catalog')
      .delete()
      .eq('id', id);

    return !error;
  }

  // Partner Management Methods
  async getPartner(id: string): Promise<Partner | null> {
    const { data, error } = await this.supabase
      .from('partners')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  async createPartner(partnerData: PartnerCreate, userId?: string): Promise<Partner> {
    let userIdToUse = userId;
    
    // If no userId provided, get from auth
    if (!userIdToUse) {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      userIdToUse = user.id;
    }

    // First try direct insert
    const { data, error } = await this.supabase
      .from('partners')
      .insert({
        ...partnerData,
        id: userIdToUse
      })
      .select()
      .single();

    if (error) {
      console.error('Direct partner creation failed, trying function approach:', {
        error: error.message,
        code: error.code
      });

      // If direct insert fails (likely RLS issue), try using the database function
      const { data: functionData, error: functionError } = await this.supabase
        .rpc('create_partner_profile', {
          p_id: userIdToUse,
          p_email: partnerData.email,
          p_first_name: partnerData.first_name,
          p_last_name: partnerData.last_name,
          p_phone: partnerData.phone,
          p_business_name: partnerData.business_name,
          p_business_type: partnerData.business_type,
          p_business_address: partnerData.business_address,
          p_business_phone: partnerData.business_phone,
          p_business_website: partnerData.business_website
        });

      if (functionError) {
        console.error('Function partner creation also failed:', functionError);
        throw new Error(`Failed to create partner: ${functionError.message}`);
      }

      return functionData;
    }

    return data;
  }

  async updatePartner(id: string, updates: PartnerUpdate): Promise<Partner> {
    const { data, error } = await this.supabase
      .from('partners')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCurrentPartner(updates: PartnerUpdate): Promise<Partner> {
    const { data: { user } } = await this.supabase.auth.getUser();
    
    if (!user) throw new Error('Not authenticated');

    return this.updatePartner(user.id, updates);
  }

  async getPartnerStats(partnerId?: string): Promise<PartnerStats | null> {
    const id = partnerId || (await this.getCurrentPartner())?.id;
    
    if (!id) return null;

    const { data, error } = await this.supabase
      .from('partner_stats')
      .select('*')
      .eq('partner_id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  // Referral Management Methods
  async getReferrals(filters?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    partnerId?: string;
  }): Promise<Referral[]> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by partner (current user if not specified)
    if (filters?.partnerId) {
      query = query.eq('partner_id', filters.partnerId);
    } else {
      const partner = await this.getCurrentPartner();
      if (partner) {
        query = query.eq('partner_id', partner.id);
      }
    }

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters?.search && filters.search.trim() !== '') {
      const searchTerm = filters.search.trim().toLowerCase();
      const searchPattern = `%${searchTerm}%`;
      
      query = query.or(`client_name.ilike.${searchPattern},client_email.ilike.${searchPattern},referral_code.ilike.${searchPattern}`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getReferral(id: string): Promise<Referral | null> {
    const { data, error } = await this.supabase
      .from('referrals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  async getReferralByCode(code: string): Promise<Referral | null> {
    const { data, error } = await this.supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', code.toUpperCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  async createReferral(referralData: ReferralCreate): Promise<Referral> {
    const partner = await this.getCurrentPartner();
    if (!partner) throw new Error('Not authenticated as partner');

    // Generate unique referral code
    const partnerPrefix = partner.business_name 
      ? partner.business_name.substring(0, 3).toUpperCase()
      : partner.first_name.substring(0, 3).toUpperCase();

    // Call the database function to generate a unique code
    const { data: codeData, error: codeError } = await this.supabase
      .rpc('generate_referral_code', { partner_prefix: partnerPrefix });

    if (codeError) throw codeError;

    const referralCode = codeData;

    const { data, error } = await this.supabase
      .from('referrals')
      .insert({
        ...referralData,
        partner_id: partner.id,
        referral_code: referralCode
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateReferral(id: string, updates: ReferralUpdate): Promise<Referral> {
    const { data, error } = await this.supabase
      .from('referrals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteReferral(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('referrals')
      .delete()
      .eq('id', id);

    return !error;
  }

  // Track referral events
  async trackReferralEvent(
    referralId: string, 
    eventType: 'qr_scan' | 'email_open' | 'link_click' | 'page_view' | 'order_start' | 'order_complete',
    eventData?: any
  ): Promise<void> {
    const { error } = await this.supabase
      .from('referral_analytics')
      .insert({
        referral_id: referralId,
        event_type: eventType,
        event_data: eventData,
        ip_address: null, // Could be populated from request
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
      });

    if (error) throw error;

    // Update referral counters
    if (eventType === 'qr_scan') {
      await this.supabase
        .from('referrals')
        .update({ 
          qr_scans: this.supabase.rpc('increment_qr_scans', { referral_id: referralId })
        })
        .eq('id', referralId);
    } else if (eventType === 'email_open') {
      await this.supabase
        .from('referrals')
        .update({ 
          email_opens: this.supabase.rpc('increment_email_opens', { referral_id: referralId })
        })
        .eq('id', referralId);
    }
  }

  // Commission Management Methods
  async getCommissionPayments(partnerId?: string): Promise<CommissionPayment[]> {
    const id = partnerId || (await this.getCurrentPartner())?.id;
    
    if (!id) return [];

    const { data, error } = await this.supabase
      .from('commission_payments')
      .select('*')
      .eq('partner_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async createCommissionPayment(paymentData: Omit<CommissionPayment, 'id' | 'created_at' | 'updated_at'>): Promise<CommissionPayment> {
    const { data, error } = await this.supabase
      .from('commission_payments')
      .insert(paymentData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Authentication helper methods
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Track login activity
    if (data.user && typeof window !== 'undefined') {
      try {
        fetch('/api/interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageId: 'system_login',
            interactionType: 'login',
            metadata: {
              userEmail: data.user.email,
              loginTimestamp: new Date().toISOString()
            }
          })
        }).catch(err => console.warn('Failed to track login activity:', err));
      } catch (error) {
        console.warn('Could not track login activity:', error);
      }
    }

    return data;
  }

  async updatePassword(newPassword: string) {
    const { error } = await this.supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
    return { success: true };
  }

  async signUp(email: string, password: string, metadata?: any) {
    console.log('SupabaseService.signUp called with:', { email, hasPassword: !!password, metadata });
    
    // Get origin safely
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    
    const signUpData = {
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${origin}/auth/callback`
      }
    };
    
    console.log('Calling supabase.auth.signUp with:', {
      email: signUpData.email,
      hasPassword: !!signUpData.password,
      options: signUpData.options
    });

    const { data, error } = await this.supabase.auth.signUp(signUpData);

    console.log('SignUp raw response:', { 
      data: {
        user: data.user,
        session: data.session
      }, 
      error: error ? {
        message: error.message,
        status: error.status,
        name: error.name
      } : null
    });

    if (error) {
      console.error('SignUp error details:', error);
      throw error;
    }
    
    // Check if user was actually created
    if (!data.user) {
      console.error('SignUp succeeded but no user returned!');
      throw new Error('No user returned from signup - this should not happen');
    }
    
    console.log('SignUp successful - user created:', {
      id: data.user.id,
      email: data.user.email,
      confirmed: !!data.user.email_confirmed_at,
      created: data.user.created_at
    });
    
    return data;
  }

  // Add method to create service role client for admin operations
  private createServiceRoleClient() {
    // Check if we're on the server side (where process.env works)
    if (typeof window !== 'undefined') {
      throw new Error('Service role client can only be created on server side');
    }
    
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not found in environment');
    }
    
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  // Method to confirm user email via API (for development)
  async confirmUserEmail(userId: string) {
    try {
      const response = await fetch('/api/auth/confirm-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        throw new Error(`Confirmation failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('User email confirmed successfully:', result);
      return result;
    } catch (error) {
      console.error('Failed to confirm user email:', error);
      throw error;
    }
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }
}