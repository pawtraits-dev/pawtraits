// Database types matching your schema

// Animal type definition for cats and dogs
export type AnimalType = 'dog' | 'cat';

export interface Breed {
  id: string;
  name: string;
  slug: string;
  description: string;
  physical_traits: Record<string, any>;
  personality_traits: string[];
  alternative_names: string[];
  popularity_rank: number | null;
  is_active: boolean;
  metadata: Record<string, any>;
  animal_type: 'dog' | 'cat';
  hero_image_url?: string;
  hero_image_alt?: string;
  created_at: string;
  updated_at: string;
}

export interface Theme {
  id: string;
  name: string;
  slug: string;
  description: string;
  base_prompt_template: string;
  style_keywords: string[];
  seasonal_relevance: Record<string, any>;
  difficulty_level: number;
  is_active: boolean;
  sort_order: number;
  hero_image_url?: string;
  hero_image_alt?: string;
  created_at: string;
  updated_at: string;
}

export interface Style {
  id: string;
  name: string;
  slug: string;
  description: string;
  prompt_suffix: string;
  technical_parameters: Record<string, any>;
  compatible_themes: string[];
  midjourney_sref?: string;
  reference_image_url?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Outfit {
  id: string;
  name: string;
  slug: string;
  description: string;
  clothing_description: string;
  color_scheme: string[];
  style_keywords: string[];
  seasonal_relevance: Record<string, any>;
  animal_compatibility: AnimalType[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Format {
  id: string;
  name: string;
  slug: string;
  description: string;
  aspect_ratio: string;
  use_case: string;
  prompt_adjustments: string;
  midjourney_parameters: string;
  technical_specs: Record<string, any>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Coat {
  id: string;
  name: string;
  slug: string;
  description: string;
  hex_color: string;
  pattern_type: string;
  rarity: string;
  is_active: boolean;
  sort_order: number;
  animal_type: 'dog' | 'cat';
  hero_image_url?: string;
  hero_image_alt?: string;
  created_at: string;
  updated_at: string;
}

export interface BreedCoat {
  id: string;
  breed_id: string;
  coat_id: string;
  is_common: boolean;
  is_standard: boolean;
  popularity_rank: number | null;
  notes: string | null;
  created_at: string;
}

export interface BreedCoatDetail {
  id: string;
  breed_name: string;
  breed_slug: string;
  coat_name: string;
  coat_slug: string;
  coat_description: string;
  hex_color: string;
  pattern_type: string;
  rarity: string;
  is_common: boolean;
  is_standard: boolean;
  popularity_rank: number | null;
  notes: string | null;
}

// Form types for create/update operations
export type BreedCreate = Omit<Breed, 'id' | 'created_at' | 'updated_at'>;
export type BreedUpdate = Partial<BreedCreate>;
export type CreateBreedData = BreedCreate;
export type UpdateBreedData = BreedUpdate;

export type ThemeCreate = Omit<Theme, 'id' | 'created_at' | 'updated_at'>;
export type ThemeUpdate = Partial<ThemeCreate>;
export type CreateThemeData = ThemeCreate;
export type UpdateThemeData = ThemeUpdate;

export type StyleCreate = Omit<Style, 'id' | 'created_at' | 'updated_at'>;
export type StyleUpdate = Partial<StyleCreate>;
export type CreateStyleData = StyleCreate;
export type UpdateStyleData = StyleUpdate;

export type FormatCreate = Omit<Format, 'id' | 'created_at' | 'updated_at'>;
export type FormatUpdate = Partial<FormatCreate>;
export type CreateFormatData = FormatCreate;
export type UpdateFormatData = FormatUpdate;

export type CoatCreate = Omit<Coat, 'id' | 'created_at' | 'updated_at'>;
export type CoatUpdate = Partial<CoatCreate>;
export type CreateCoatData = CoatCreate;
export type UpdateCoatData = CoatUpdate;

export type BreedCoatCreate = Omit<BreedCoat, 'id' | 'created_at'>;
export type BreedCoatUpdate = Partial<BreedCoatCreate>;

// Image catalog types
export interface ImageCatalog {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  public_url: string;
  image_url?: string; // Legacy field
  prompt_text: string;
  description?: string;
  tags: string[];
  breed_id?: string;
  theme_id?: string;
  style_id?: string;
  format_id?: string;
  coat_id?: string;
  ai_model?: string;
  generation_parameters?: Record<string, any>;
  rating?: number;
  is_featured: boolean;
  is_public: boolean;
  cloudinary_public_id?: string;
  image_variants?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ImageCatalogWithDetails extends ImageCatalog {
  breed_name?: string;
  breed_animal_type?: 'dog' | 'cat';
  theme_name?: string;
  style_name?: string;
  format_name?: string;
  coat_name?: string;
  coat_hex_color?: string;
  coat_animal_type?: 'dog' | 'cat';
}

export type ImageCatalogCreate = Omit<ImageCatalog, 'id' | 'created_at' | 'updated_at'>;
export type ImageCatalogUpdate = Partial<ImageCatalogCreate>;

// Prompt session types for linking images to generation sessions
export interface PromptSession {
  id: string;
  breed_id?: string;
  theme_id?: string;
  style_id?: string;
  format_id?: string;
  coat_id?: string;
  generated_prompt: string;
  session_data: Record<string, any>;
  created_at: string;
}

export type PromptSessionCreate = Omit<PromptSession, 'id' | 'created_at'>;

// Partner account management types
export interface Partner {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  business_name?: string;
  business_type?: 'groomer' | 'breeder' | 'vet' | 'salon' | 'mobile' | 'independent' | 'chain';
  business_address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  business_phone?: string;
  business_website?: string;
  bio?: string;
  avatar_url?: string;
  logo_url?: string;
  is_active: boolean;
  is_verified: boolean;
  onboarding_completed: boolean;
  payment_method?: 'paypal' | 'bank_transfer';
  payment_details?: Record<string, any>;
  notification_preferences: {
    email_commissions: boolean;
    email_referrals: boolean;
    sms_enabled: boolean;
  };
  // Admin approval fields
  approval_status?: 'pending' | 'approved' | 'rejected' | 'suspended';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

// ===========================
// INFLUENCER SYSTEM TYPES
// ===========================

export interface Influencer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  username?: string; // Social media handle
  bio?: string;
  avatar_url?: string;
  phone?: string;
  is_active: boolean;
  is_verified: boolean;
  commission_rate: number; // Default 10% lifetime commission
  payment_method?: 'paypal' | 'bank_transfer';
  payment_details?: Record<string, any>;
  notification_preferences: {
    email_commissions: boolean;
    email_referrals: boolean;
  };
  // Admin approval fields
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InfluencerSocialChannel {
  id: string;
  influencer_id: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'facebook' | 'linkedin' | 'pinterest';
  username: string;
  profile_url?: string;
  follower_count?: number;
  engagement_rate?: number; // Percentage as decimal (e.g., 0.035 for 3.5%)
  verified: boolean;
  is_primary: boolean; // One primary channel per influencer
  is_active: boolean;
  last_updated: string;
  created_at: string;
}

export interface InfluencerReferralCode {
  id: string;
  influencer_id: string;
  code: string;
  qr_code_url?: string;
  description?: string; // What this code is for
  usage_count: number;
  conversion_count: number;
  total_revenue: number; // In cents
  total_commission: number; // In cents
  is_active: boolean;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InfluencerReferral {
  id: string;
  influencer_id: string;
  referral_code_id: string;
  customer_id?: string;
  customer_email?: string;
  status: 'pending' | 'accessed' | 'signed_up' | 'purchased' | 'credited' | 'expired';
  order_id?: string;
  order_value?: number; // In cents
  commission_amount?: number; // In cents
  commission_paid: boolean;
  source_platform?: string; // Which social platform the referral came from
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  accessed_at?: string;
  signed_up_at?: string;
  purchased_at?: string;
  credited_at?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// Extended interfaces for admin views
export interface InfluencerWithStats extends Influencer {
  total_referrals: number;
  successful_referrals: number;
  pending_referrals: number;
  total_commission_earned: number; // In cents
  total_revenue_generated: number; // In cents
  conversion_rate: number; // Percentage as decimal
  primary_social_channel?: InfluencerSocialChannel;
  social_channels_count: number;
  active_codes_count: number;
}

export interface InfluencerStats {
  influencer_id: string;
  first_name: string;
  last_name: string;
  username?: string;
  total_referrals: number;
  successful_referrals: number;
  pending_referrals: number;
  expired_referrals: number;
  total_commission_earned: number; // In cents
  total_revenue_generated: number; // In cents
  avg_order_value: number; // In cents
  conversion_rate: number; // Percentage as decimal
  total_social_reach?: number; // Sum of follower counts
  primary_platform?: string;
}

export interface AdminInfluencerOverview {
  total_influencers: number;
  active_influencers: number;
  pending_approval: number;
  total_commission_paid: number; // In cents
  total_revenue_generated: number; // In cents
  avg_commission_rate: number;
  top_performers: InfluencerStats[];
  recent_signups: Influencer[];
}

// Form types for influencer management
export type InfluencerCreate = Omit<Influencer, 'id' | 'created_at' | 'updated_at' | 'approval_status' | 'approved_by' | 'approved_at'>;
export type InfluencerUpdate = Partial<InfluencerCreate> & { approval_status?: 'pending' | 'approved' | 'rejected' | 'suspended' };

export type SocialChannelCreate = Omit<InfluencerSocialChannel, 'id' | 'created_at' | 'last_updated'>;
export type SocialChannelUpdate = Partial<SocialChannelCreate>;

export type InfluencerReferralCodeCreate = Omit<InfluencerReferralCode, 'id' | 'created_at' | 'updated_at' | 'usage_count' | 'conversion_count' | 'total_revenue' | 'total_commission'>;

// Extended referral types to include influencers
export type ExtendedReferralType = 'partner' | 'customer' | 'influencer' | 'pre_registration';
export type ExtendedReferrerType = 'partner' | 'customer' | 'influencer';

export interface Referral {
  id: string;
  partner_id: string;
  referral_code: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_notes?: string;
  pet_name?: string;
  pet_breed_id?: string;
  pet_coat_id?: string;
  status: 'invited' | 'accessed' | 'accepted' | 'applied' | 'expired';
  qr_code_url?: string;
  qr_scans: number;
  email_opens: number;
  last_viewed_at?: string;
  order_id?: string;
  order_value?: number;
  discount_amount?: number;
  commission_rate: number;
  lifetime_commission_rate: number;
  commission_amount?: number;
  commission_paid: boolean;
  expires_at: string;
  purchased_at?: string;
  created_at: string;
  updated_at: string;
  // New aggregated fields for orders and commissions
  order_count?: number;
  total_order_value?: number;
  total_commission_amount?: number;
  pending_commission?: number;
  paid_commission?: number;
}

export interface ReferralWithPartner extends Referral {
  partner_name: string;
  business_name?: string;
}

export interface CommissionPayment {
  id: string;
  partner_id: string;
  payment_period_start: string;
  payment_period_end: string;
  total_amount: number;
  referral_count: number;
  initial_commission_amount: number;
  lifetime_commission_amount: number;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';
  payment_method: string;
  payment_details?: Record<string, any>;
  failure_reason?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientOrder {
  id: string;
  client_email: string;
  referral_id?: string;
  partner_id?: string;
  order_value: number;
  discount_applied: number;
  is_initial_order: boolean;
  commission_rate?: number;
  commission_amount?: number;
  commission_paid: boolean;
  payment_id?: string;
  order_items?: Record<string, any>;
  order_status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  created_at: string;
  updated_at: string;
}

export interface PartnerStats {
  partner_id: string;
  first_name: string;
  last_name: string;
  business_name?: string;
  total_referrals: number;
  successful_referrals: number;
  pending_referrals: number;
  expired_referrals: number;
  total_commission_earned: number;
  total_order_value: number;
  avg_order_value: number;
  conversion_rate: number;
  total_qr_scans: number;
}

// Form types for partner management
export type PartnerCreate = Omit<Partner, 'id' | 'created_at' | 'updated_at'>;
export type PartnerUpdate = Partial<PartnerCreate>;

export type ReferralCreate = Omit<Referral, 'id' | 'created_at' | 'updated_at' | 'referral_code' | 'qr_scans' | 'email_opens' | 'commission_paid'>;
export type ReferralUpdate = Partial<ReferralCreate>;

// Customer management types
export interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  email_verified: boolean;
  marketing_consent: boolean;
  created_at: string;
  updated_at: string;
}

export interface Pet {
  id: string;
  customer_id: string;
  name: string;
  breed_id?: string;
  coat_id?: string;
  gender?: 'male' | 'female' | 'unknown';
  age?: number; // in months
  weight?: number; // in pounds
  is_spayed_neutered?: boolean;
  personality_traits?: string[];
  special_notes?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface PetPhoto {
  id: string;
  pet_id: string;
  photo_url: string;
  is_primary: boolean;
  description?: string;
  created_at: string;
}

export interface PetWithDetails extends Pet {
  breed_name?: string;
  breed_slug?: string;
  coat_name?: string;
  coat_slug?: string;
  coat_hex_color?: string;
  primary_photo_url?: string;
  photo_urls?: string[];
  photos: PetPhoto[];
}

// Interface matching the get_user_pets RPC function return structure
export interface UserPetData {
  pet_id: string;
  name: string;
  age?: number;
  birthday?: string;
  gender?: 'male' | 'female' | 'unknown';
  weight?: number;
  primary_photo_url?: string;
  photo_urls?: string[];
  personality_traits?: string[];
  special_notes?: string;
  breed_id?: string;
  breed_name?: string;
  breed_slug?: string;
  coat_id?: string;
  coat_name?: string;
  coat_slug?: string;
  coat_hex_color?: string;
  created_at: string;
}

// Admin types
export interface Admin {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'super_admin';
  permissions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  admin_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AdminPartnerOverview {
  id: string;
  email: string;
  full_name: string;
  business_name?: string;
  business_type?: string;
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login_at?: string;
  total_referrals: number;
  successful_referrals: number;
  total_orders: number;
  total_order_value: number;
  total_commissions: number;
  paid_commissions: number;
  unpaid_commissions: number;
}

export interface AdminCustomerOverview {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  is_registered: boolean;
  total_pets: number;
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  first_order_date: string | null;
  last_order_date: string | null;
  customer_status: string;
  customer_segment: string;
  marketing_consent: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
  referred_by_partner_id: string | null;
}

// Enhanced referral with pet details
export interface ReferralWithPet extends Referral {
  pet_id?: string;
  pet_name?: string;
  pet_breed_id?: string;
  pet_coat_id?: string;
  pet_breed_name?: string;
  pet_coat_name?: string;
  pet_coat_hex_color?: string;
}

// ===========================================
// EXTENDED REFERRAL SYSTEM TYPES
// ===========================================

// Pre-registration codes for partner acquisition
export interface PreRegistrationCode {
  id: string;
  code: string;
  status: 'active' | 'used' | 'expired' | 'deactivated';
  business_category?: string;
  expiration_date?: string;
  marketing_campaign?: string;
  notes?: string;
  print_quantity: number;
  qr_code_url?: string;
  qr_code_data?: Record<string, any>;
  partner_id?: string; // Set when code is used
  admin_id?: string;
  scans_count: number;
  conversions_count: number;
  created_at: string;
  updated_at: string;
}

export interface PreRegistrationCodeWithPartner extends PreRegistrationCode {
  partner_name?: string;
  business_name?: string;
}

export type PreRegistrationCodeCreate = Omit<
  PreRegistrationCode,
  'id' | 'created_at' | 'updated_at' | 'scans_count' | 'conversions_count' | 'partner_id'
>;

export type PreRegistrationCodeUpdate = Partial<PreRegistrationCodeCreate>;

// Customer referrals (customer-to-customer)
export interface CustomerReferral {
  id: string;
  referrer_customer_id: string;
  referee_customer_id?: string;
  referral_code: string;
  referee_email: string;
  status: 'pending' | 'accessed' | 'signed_up' | 'purchased' | 'credited' | 'expired';
  discount_amount?: number; // In cents
  credit_amount?: number; // In cents
  order_id?: string;
  order_value?: number; // In cents
  expires_at: string;
  accessed_at?: string;
  signed_up_at?: string;
  purchased_at?: string;
  credited_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerReferralWithDetails extends CustomerReferral {
  referrer_customer_name: string;
  referrer_customer_email: string;
  referee_customer_name?: string;
  referee_customer_email?: string;
  order_details?: {
    total_amount: number;
    items_count: number;
  };
}

export type CustomerReferralCreate = Omit<
  CustomerReferral,
  'id' | 'created_at' | 'updated_at' | 'referral_code' | 'status'
>;

export type CustomerReferralUpdate = Partial<Pick<CustomerReferral, 'status' | 'referee_customer_id'>>;

// Customer credits system
export interface CustomerCredits {
  id: string;
  customer_id: string;
  total_earned: number; // Total credits ever earned (in cents)
  total_used: number; // Total credits ever used (in cents)
  available_balance: number; // Current available balance (in cents)
  pending_credits: number; // Credits pending order completion (in cents)
  last_credit_earned_at?: string;
  last_credit_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreditTransaction {
  id: string;
  customer_id: string;
  transaction_type: 'earned' | 'used' | 'expired' | 'refunded';
  amount: number; // In cents
  balance_after: number; // Balance after this transaction (in cents)
  reference_type?: 'referral' | 'order' | 'adjustment';
  reference_id?: string;
  description?: string;
  created_at: string;
}

// Customer referral statistics
export interface CustomerReferralStats {
  total_referrals: number;
  successful_referrals: number;
  pending_referrals: number;
  total_credits_earned: number; // In cents
  available_credits: number; // In cents
  personal_referral_code?: string;
}

// Enhanced referral types with multi-tier support (updated to include influencers)
export type ReferrerType = 'partner' | 'customer' | 'influencer';

// Referral tracking and attribution
export interface ReferralAttribution {
  referral_id: string;
  referral_type: ExtendedReferralType;
  referrer_type: ReferrerType;
  partner_id?: string;
  customer_referrer_id?: string;
  influencer_id?: string;
  pre_registration_code_id?: string;
  conversion_source: 'qr_scan' | 'email' | 'social' | 'direct_link';
  accessed_from_qr: boolean;
}

// QR Code generation options for extended system
export interface ExtendedQRCodeOptions {
  type: 'partner' | 'customer' | 'influencer' | 'pre_registration';
  referral_code: string;
  branding?: {
    logo_url?: string;
    primary_color?: string;
    background_color?: string;
  };
  size?: 'small' | 'medium' | 'large' | 'print';
  error_correction?: 'L' | 'M' | 'Q' | 'H';
  format?: 'png' | 'svg' | 'pdf';
}

// Bulk QR code generation
export interface BulkQRRequest {
  codes: Array<{
    code: string;
    type: 'partner' | 'customer' | 'influencer' | 'pre_registration';
    campaign?: string;
  }>;
  options: ExtendedQRCodeOptions;
  output_format: 'zip' | 'pdf' | 'individual';
}

// Credit application for checkout
export interface CreditApplicationResult {
  credits_applied: number; // In cents
  remaining_balance: number; // In cents
  final_order_value: number; // In cents
  transaction_id?: string;
}

// Multi-tier commission calculation
export interface MultiTierCommission {
  tier: 'partner' | 'customer';
  referrer_id: string;
  referrer_type: ReferrerType;
  commission_type: 'percentage' | 'credit';
  commission_amount: number; // In cents or percentage
  order_value: number; // In cents
  calculated_amount: number; // Final amount in cents
}

// Referral funnel analytics
export interface ReferralFunnelStats {
  pre_registration: {
    codes_created: number;
    codes_scanned: number;
    partners_converted: number;
    conversion_rate: number;
  };
  partner_referrals: {
    referrals_created: number;
    customers_acquired: number;
    total_commission_paid: number;
    avg_order_value: number;
  };
  customer_referrals: {
    referrals_sent: number;
    friends_converted: number;
    credits_awarded: number;
    credits_redeemed: number;
  };
}

// Print materials for QR codes
export interface PrintMaterial {
  id: string;
  pre_registration_code_id: string;
  material_type: 'counter_display' | 'window_decal' | 'business_card' | 'poster' | 'flyer';
  format: 'pdf' | 'png' | 'svg';
  size: string; // e.g., 'A4', '4x6', '8.5x11'
  file_url: string;
  print_quantity: number;
  created_at: string;
}

// Form types
export type CustomerCreate = Omit<Customer, 'id' | 'created_at' | 'updated_at'>;
export type CustomerUpdate = Partial<CustomerCreate>;

export type PetCreate = Omit<Pet, 'id' | 'created_at' | 'updated_at'>;
export type PetUpdate = Partial<PetCreate>;

export type AdminCreate = Omit<Admin, 'id' | 'created_at' | 'updated_at'>;
export type AdminUpdate = Partial<AdminCreate>;