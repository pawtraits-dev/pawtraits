/**
 * Bundle Pricing Service
 *
 * Handles tiered pricing calculations for digital download bundles.
 * Customers get discounts when purchasing multiple images.
 *
 * Pricing Example:
 * - 1 image:  £9.99  (0% discount)
 * - 2 images: £17.49 (12% discount)
 * - 3 images: £22.49 (25% discount)
 * - 10 images: £50.99 (49% discount)
 */

import { createClient } from '@supabase/supabase-js';

export interface BundleTier {
  id: string;
  quantity: number;
  price_gbp: number; // In pence
  discount_percentage: number;
  is_active: boolean;
}

export interface BundlePricing {
  quantity: number;
  price_per_item: number; // In pence
  total_price: number; // In pence
  savings: number; // In pence
  discount_percentage: number;
  next_tier?: {
    quantity: number;
    price_per_item: number;
    additional_savings: number;
  };
}

export class BundlePricingService {
  private supabase: ReturnType<typeof createClient>;
  private tiers: BundleTier[] | null = null;
  private tiersLoadedAt: number = 0;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  /**
   * Load bundle pricing tiers from database (with caching)
   */
  async loadTiers(): Promise<BundleTier[]> {
    // Return cached tiers if still valid
    const now = Date.now();
    if (this.tiers && (now - this.tiersLoadedAt) < this.CACHE_DURATION_MS) {
      return this.tiers;
    }

    console.log('💰 [Bundle Pricing] Loading pricing tiers from database');

    const { data, error } = await this.supabase
      .from('digital_bundle_tiers')
      .select('*')
      .eq('is_active', true)
      .order('quantity', { ascending: true });

    if (error) {
      console.error('❌ [Bundle Pricing] Failed to load tiers:', error);
      return this.tiers || []; // Return cached tiers or empty array
    }

    this.tiers = data || [];
    this.tiersLoadedAt = now;

    console.log(`✅ [Bundle Pricing] Loaded ${this.tiers.length} active pricing tiers`);

    return this.tiers;
  }

  /**
   * Calculate bundle pricing for given quantity
   */
  async calculateBundlePrice(quantity: number): Promise<BundlePricing> {
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    const tiers = await this.loadTiers();

    if (tiers.length === 0) {
      throw new Error('No pricing tiers configured');
    }

    // Find the tier for this quantity (or closest lower tier)
    let selectedTier = tiers[0]; // Default to tier 1
    for (const tier of tiers) {
      if (tier.quantity <= quantity) {
        selectedTier = tier;
      } else {
        break;
      }
    }

    const basePrice = tiers[0]?.price_gbp || 999; // £9.99 default
    const tierPrice = selectedTier.price_gbp;

    // Calculate price per item based on the tier
    const pricePerItem = Math.round(tierPrice / selectedTier.quantity);

    // Total price = price per item × quantity
    const totalPrice = pricePerItem * quantity;

    // Calculate savings vs buying at base price
    const baseTotalPrice = basePrice * quantity;
    const savings = baseTotalPrice - totalPrice;
    const discountPercentage = baseTotalPrice > 0 ? (savings / baseTotalPrice) * 100 : 0;

    // Find next tier for upsell messaging
    let nextTier = undefined;
    for (const tier of tiers) {
      if (tier.quantity > quantity) {
        const nextPricePerItem = Math.round(tier.price_gbp / tier.quantity);
        const nextTotalPrice = nextPricePerItem * tier.quantity;
        const nextSavings = (basePrice * tier.quantity) - nextTotalPrice;
        const additionalSavings = nextSavings - savings;

        nextTier = {
          quantity: tier.quantity,
          price_per_item: nextPricePerItem,
          additional_savings: Math.max(0, additionalSavings)
        };
        break;
      }
    }

    const result: BundlePricing = {
      quantity,
      price_per_item: pricePerItem,
      total_price: totalPrice,
      savings: Math.max(0, savings),
      discount_percentage: Math.max(0, discountPercentage),
      next_tier
    };

    console.log(`💰 [Bundle Pricing] Calculated for ${quantity} images:`, {
      total: this.formatPrice(totalPrice),
      savings: this.formatPrice(savings),
      discount: `${discountPercentage.toFixed(1)}%`
    });

    return result;
  }

  /**
   * Get all active tiers (for admin UI and pricing display)
   */
  async getAllTiers(): Promise<BundleTier[]> {
    return this.loadTiers();
  }

  /**
   * Get the master bundle product ID
   * (The single "Digital Download Bundle" product used for all digital downloads)
   */
  async getMasterBundleProductId(): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('products')
      .select('id')
      .eq('name', 'Digital Download Bundle')
      .eq('product_type', 'digital_download')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error || !data) {
      console.error('❌ [Bundle Pricing] Failed to find master bundle product:', error);
      return null;
    }

    return data.id;
  }

  /**
   * Format price for display (pence to pounds)
   */
  formatPrice(priceInPence: number): string {
    return `£${(priceInPence / 100).toFixed(2)}`;
  }

  /**
   * Clear cached tiers (useful for testing or after tier updates)
   */
  clearCache(): void {
    this.tiers = null;
    this.tiersLoadedAt = 0;
    console.log('🗑️  [Bundle Pricing] Cache cleared');
  }
}
