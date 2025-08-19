// Carousel Management Types

export type PageType = 'home' | 'dogs' | 'cats' | 'themes';

export type TextPosition = 
  | 'center' 
  | 'left' 
  | 'right' 
  | 'bottom-left' 
  | 'bottom-center'
  | 'bottom-right' 
  | 'top-left' 
  | 'top-right';

export type TextColor = 'white' | 'black' | 'purple' | 'blue';

export type CTAStyle = 'primary' | 'secondary' | 'outline';

export interface Carousel {
  id: string;
  name: string;
  page_type: PageType;
  description?: string;
  is_active: boolean;
  auto_play_interval: number;
  show_thumbnails: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CarouselSlide {
  id: string;
  carousel_id: string;
  
  // Image information
  image_url: string;
  image_alt?: string;
  cloudinary_public_id?: string;
  
  // Content overlay information
  title?: string;
  subtitle?: string;
  description?: string;
  
  // Call-to-action button
  cta_text?: string;
  cta_url?: string;
  cta_style: CTAStyle;
  
  // Display settings
  text_position: TextPosition;
  text_color: TextColor;
  show_overlay: boolean;
  overlay_opacity: number;
  
  // Ordering and status
  sort_order: number;
  is_active: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CarouselWithSlides extends Carousel {
  slides: CarouselSlide[];
}

export interface CarouselManagementView extends Carousel {
  slide_count: number;
  active_slide_count: number;
}

// Form interfaces for creating/editing
export interface CarouselFormData {
  name: string;
  page_type: PageType;
  description?: string;
  auto_play_interval: number;
  show_thumbnails: boolean;
  is_active: boolean;
}

export interface CarouselSlideFormData {
  carousel_id: string;
  
  // Image information
  image_file?: File;
  image_url?: string;
  image_alt?: string;
  
  // Content overlay information
  title?: string;
  subtitle?: string;
  description?: string;
  
  // Call-to-action button
  cta_text?: string;
  cta_url?: string;
  cta_style: CTAStyle;
  
  // Display settings
  text_position: TextPosition;
  text_color: TextColor;
  show_overlay: boolean;
  overlay_opacity: number;
  
  // Ordering
  sort_order: number;
  is_active: boolean;
}

// API Response interfaces
export interface CarouselAPIResponse {
  carousel: Carousel;
  slides: CarouselSlide[];
}

export interface CarouselListResponse {
  carousels: CarouselManagementView[];
  total: number;
}

// Carousel display props for components
export interface CarouselDisplayProps {
  pageType: PageType;
  className?: string;
  showControls?: boolean;
  showThumbnails?: boolean;
  autoPlayOverride?: number;
}

// Upload response interface
export interface ImageUploadResponse {
  url: string;
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
}

// Validation helpers
export const PageTypeOptions: { label: string; value: PageType }[] = [
  { label: 'Home Page', value: 'home' },
  { label: 'Dogs Page', value: 'dogs' },
  { label: 'Cats Page', value: 'cats' },
  { label: 'Themes Page', value: 'themes' }
];

export const TextPositionOptions: { label: string; value: TextPosition }[] = [
  { label: 'Center', value: 'center' },
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' },
  { label: 'Bottom Left', value: 'bottom-left' },
  { label: 'Bottom Center', value: 'bottom-center' },
  { label: 'Bottom Right', value: 'bottom-right' },
  { label: 'Top Left', value: 'top-left' },
  { label: 'Top Right', value: 'top-right' }
];

export const TextColorOptions: { label: string; value: TextColor }[] = [
  { label: 'White', value: 'white' },
  { label: 'Black', value: 'black' },
  { label: 'Purple', value: 'purple' },
  { label: 'Blue', value: 'blue' }
];

export const CTAStyleOptions: { label: string; value: CTAStyle }[] = [
  { label: 'Primary', value: 'primary' },
  { label: 'Secondary', value: 'secondary' },
  { label: 'Outline', value: 'outline' }
];

// Default values
export const DefaultCarouselSettings: Partial<CarouselFormData> = {
  auto_play_interval: 6000,
  show_thumbnails: true,
  is_active: true
};

export const DefaultSlideSettings: Partial<CarouselSlideFormData> = {
  cta_style: 'primary',
  text_position: 'center',
  text_color: 'white',
  show_overlay: true,
  overlay_opacity: 40,
  sort_order: 0,
  is_active: true
};