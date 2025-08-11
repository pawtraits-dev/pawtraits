// Physical Products System Types

export interface Format {
  id: string;
  name: string;
  slug: string;
  description?: string;
  width?: number;
  height?: number;
  is_landscape: boolean;
  is_portrait: boolean;
  aspect_ratio_decimal: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}


export interface Media {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: string; // print, canvas, acrylic, metal, etc.
  
  // Material properties
  material_type?: string; // canvas, paper, acrylic, metal, wood
  finish_type?: string; // matte, gloss, satin, textured
  thickness_mm?: number;
  
  // Durability and care
  indoor_outdoor?: 'indoor' | 'outdoor' | 'both';
  uv_resistant: boolean;
  water_resistant: boolean;
  care_instructions?: string;
  
  // Availability and pricing
  is_active: boolean;
  is_featured: boolean;
  gelato_category?: string;
  base_cost_multiplier: number;
  
  // SEO and display
  meta_title?: string;
  meta_description?: string;
  preview_image_url?: string;
  display_order: number;
  
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  
  // Relations (medium + format combination)
  medium_id: string;
  format_id: string;
  medium?: Media;
  format?: Format;
  
  // Product identification
  sku: string; // e.g., "CANVAS-SQUARE-S"
  name: string; // e.g., "Canvas Print Square Small (20x20cm)"
  description?: string;
  
  // Size attributes (specific to this product)
  size_name?: string; // "Small", "Medium", "Large"
  size_code?: string; // "S", "M", "L"
  width_cm?: number;
  height_cm?: number;
  width_inches?: number;
  height_inches?: number;
  
  // Gelato integration
  gelato_sku?: string; // Gelato's exact SKU for this combination
  
  // Availability
  is_active: boolean;
  is_featured: boolean;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
  
  // Pricing (will be loaded separately)
  pricing?: ProductPricing[];
  current_pricing?: ProductPricing; // For current country
  
  created_at: string;
  updated_at: string;
}

export interface ProductPricing {
  id: string;
  product_id: string;
  
  // Geographic pricing
  country_code: string;
  currency_code: string;
  currency_symbol: string;
  country?: Country;
  
  // Direct costs and pricing (in minor currency units: pence/cents)
  product_cost: number; // What Gelato charges me for the product
  shipping_cost: number; // What Gelato charges me for shipping
  sale_price: number; // What I charge customers
  
  // Optional discounts
  discount_price?: number; // Optional discounted customer price
  is_on_sale: boolean;
  sale_start_date?: string;
  sale_end_date?: string;
  
  // Auto-calculated margins
  profit_amount: number; // sale_price - (product_cost + shipping_cost)
  profit_margin_percent: number; // (profit / sale_price) * 100
  markup_percent: number; // (profit / cost) * 100
  
  created_at: string;
  updated_at: string;
}

export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  currency_code: string; // ISO 4217
  currency_symbol: string;
  is_supported: boolean;
  shipping_zone?: string;
  tax_rate_percent: number;
  display_order: number;
  created_at: string;
}

// Create/Update DTOs
export interface MediaCreate {
  name: string;
  slug: string;
  description?: string;
  category: string;
  material_type?: string;
  finish_type?: string;
  thickness_mm?: number;
  indoor_outdoor?: 'indoor' | 'outdoor' | 'both';
  uv_resistant?: boolean;
  water_resistant?: boolean;
  care_instructions?: string;
  is_active?: boolean;
  is_featured?: boolean;
  gelato_category?: string;
  base_cost_multiplier?: number;
  meta_title?: string;
  meta_description?: string;
  preview_image_url?: string;
  display_order?: number;
}

export interface MediaUpdate extends Partial<MediaCreate> {
  id: string;
}

export interface ProductCreate {
  medium_id: string;
  format_id: string;
  description?: string;
  size_name: string; // "Small", "Medium", "Large"
  size_code: string; // "S", "M", "L"
  width_cm: number;
  height_cm: number;
  width_inches?: number;
  height_inches?: number;
  gelato_sku?: string;
  is_active?: boolean;
  is_featured?: boolean;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
}


export interface ProductUpdate extends Partial<ProductCreate> {
  id: string;
}

export interface ProductPricingCreate {
  product_id: string;
  country_code: string;
  product_cost: number; // What Gelato charges me
  shipping_cost: number; // What Gelato charges for shipping
  sale_price: number; // What I charge customers
  discount_price?: number;
  is_on_sale?: boolean;
  sale_start_date?: string;
  sale_end_date?: string;
}

export interface ProductPricingUpdate extends Partial<ProductPricingCreate> {
  id: string;
}

// Utility types for product combinations
export interface ProductWithPricing extends Product {
  pricing: ProductPricing[];
  current_pricing: ProductPricing;
}

export interface ProductCatalogItem {
  id: string;
  name: string;
  sku: string;
  medium_name: string;
  format_name: string;
  size_code?: string;
  dimensions?: string; // e.g., "30x30cm"
  price_display: string; // e.g., "£29.99"
  sale_price_display?: string;
  is_on_sale: boolean;
  is_featured: boolean;
  stock_status: string;
  preview_image_url?: string;
}

// Utility functions
export function formatPrice(amountInMinorUnits: number, currencyCode: string, symbol: string): string {
  const amount = amountInMinorUnits / 100; // Convert pence to pounds, cents to dollars, etc.
  return `${symbol}${amount.toFixed(2)}`;
}

export function calculateProfitMargin(cost: number, price: number): number {
  if (price === 0) return 0;
  return ((price - cost) / price) * 100;
}

export function calculateMarkup(cost: number, price: number): number {
  if (cost === 0) return 0;
  return ((price - cost) / cost) * 100;
}

export function formatDimensions(width_cm?: number, height_cm?: number): string {
  if (!width_cm || !height_cm) return '';
  return `${width_cm}x${height_cm}cm`;
}

export function formatProductDimensions(product: Product): string {
  if (!product.width_cm || !product.height_cm) return '';
  return `${product.width_cm}x${product.height_cm}cm`;
}

export function formatProductDimensionsWithInches(product: Product): string {
  const cm = formatProductDimensions(product);
  if (product.width_inches && product.height_inches) {
    return `${cm} (${product.width_inches}"x${product.height_inches}")`;
  }
  return cm;
}

export function generateProductName(medium: Media, format: Format, sizeName: string, widthCm: number, heightCm: number): string {
  const dimensions = `${widthCm}x${heightCm}cm`;
  return `${medium.name} ${format.name} ${sizeName} (${dimensions})`;
}

export function generateProductSKU(medium: Media, format: Format, sizeCode: string): string {
  const mediumSlug = medium.slug.toUpperCase();
  const formatSlug = format.name.toUpperCase().replace(/\s+/g, '-');
  return `${mediumSlug}-${formatSlug}-${sizeCode}`;
}

export function generateProductSku(mediumSlug: string, formatName: string, sizeCode?: string): string {
  let sku = `${mediumSlug.toUpperCase()}-${formatName.toUpperCase().replace(/\s+/g, '-')}`;
  if (sizeCode) {
    sku += `-${sizeCode.toUpperCase()}`;
  }
  return sku;
}