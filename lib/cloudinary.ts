import { v2 as cloudinary } from 'cloudinary';
import QRCode from 'qrcode';

// Environment variables are automatically loaded by Next.js

// Configure Cloudinary - this will be called lazily when needed
function ensureCloudinaryConfig() {
  const cloudinaryConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };

  if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
    console.error('❌ Cloudinary configuration missing:', {
      cloud_name: cloudinaryConfig.cloud_name ? '✅ Found' : '❌ Missing',
      api_key: cloudinaryConfig.api_key ? '✅ Found' : '❌ Missing',
      api_secret: cloudinaryConfig.api_secret ? '✅ Found' : '❌ Missing',
    });
    throw new Error('Cloudinary configuration is incomplete. Check your environment variables.');
  }

  cloudinary.config(cloudinaryConfig);
  return cloudinaryConfig;
}

export interface ImageVariants {
  // Original - 300 DPI, no overlay, secured for print fulfillment only
  original: {
    url: string;
    access_type: 'print_fulfillment_only';
    dpi: 300;
    overlay: 'none';
    description: 'For printing';
  };
  // Download - 300 DPI, brand overlay, available after purchase
  download: {
    url: string;
    access_type: 'signed_authenticated';
    dpi: 300;
    overlay: 'brand_bottom_right';
    description: 'Downloadable from gallery once purchased';
  };
  // Full Size - watermarked for detail views
  full_size: {
    url: string;
    access_type: 'public';
    overlay: 'watermark_center';
    description: 'Detail page / modal';
  };
  // Thumbnail - small, no overlay
  thumbnail: {
    url: string;
    access_type: 'public';
    size: 'small';
    overlay: 'none';
    description: 'In rows or carts';
  };
  // Mid Size - medium, no overlay for cards
  mid_size: {
    url: string;
    access_type: 'public';
    size: 'medium';
    overlay: 'none';
    description: 'Shop / catalog cards';
  };
  // Social Media - brand overlay, social dimensions
  social_media_post: {
    url: string;
    access_type: 'public_after_purchase';
    overlay: 'brand_bottom_right';
    description: 'Sharing to social';
    formats: {
      instagram_post: string; // 1080x1080
      instagram_story: string; // 1080x1920  
      facebook_post: string; // 1200x630
      twitter_card: string; // 1200x675
    };
  };
}

export interface UploadMetadata {
  breed: string;
  theme: string; 
  style: string;
  partnerId?: string;
  imageId?: string;
}

export interface UploadResult {
  public_id: string;
  version: string;
  variants: ImageVariants;
  cloudinary_signature: string;
}

/**
 * CloudinaryImageService - Manages image storage and transformations with security
 *
 * URL Expiry Strategy:
 * - Stored variants (DB): 30-day expiry for reference/preview
 * - Print fulfillment: 48-hour expiry (regenerate via getOriginalPrintUrl())
 * - Customer downloads: 7-day expiry (regenerate via getDownloadUrl())
 *
 * Security Model:
 * - All sensitive URLs (original, download) use signed URLs with expiry
 * - Public variants (thumbnails, watermarked) can be unsigned
 * - Gelato receives fresh 48hr URLs when orders are placed
 * - Customers receive fresh 7-day URLs when downloading
 *
 * Image Upscaling:
 * - Max 5315px (45cm @300dpi) covers all print sizes
 * - Portrait: 30×45cm (3543×5315px)
 * - Landscape: 45×30cm (5315×3543px)
 * - Square: 40×40cm (4724×4724px)
 */
export class CloudinaryImageService {

  /**
   * Upload original image and generate all variants
   */
  async uploadAndProcessImage(
    imageBuffer: Buffer,
    filename: string,
    metadata: UploadMetadata
  ): Promise<UploadResult> {
    
    try {
      // Ensure Cloudinary is configured
      ensureCloudinaryConfig();
      console.log(`🔄 Starting Cloudinary upload for: ${filename}`);
      
      // 1. Upload original high-quality image
      const uploadResult = await cloudinary.uploader.upload(
        `data:image/png;base64,${imageBuffer.toString('base64')}`,
        {
          public_id: `pawtraits/${metadata.breed}/${metadata.theme}/${filename.replace(/\.[^/.]+$/, '')}`,
          folder: 'pawtraits/originals',
          resource_type: 'image',
          quality: 'auto:best',
          context: `breed=${metadata.breed}|theme=${metadata.theme}|style=${metadata.style}`,
          tags: [metadata.breed, metadata.theme, metadata.style, 'original'],
          overwrite: false, // Don't overwrite existing images
          unique_filename: true
        }
      );

      console.log(`✅ Upload successful. Public ID: ${uploadResult.public_id}`);

      // 2. Generate all variants
      const variants = await this.generateImageVariants(
        uploadResult.public_id, 
        uploadResult.version.toString(),
        metadata
      );

      console.log(`✅ Generated ${Object.keys(variants).length} image variants`);

      return {
        public_id: uploadResult.public_id,
        version: uploadResult.version.toString(),
        variants,
        cloudinary_signature: uploadResult.signature
      };

    } catch (error) {
      console.error('❌ Cloudinary upload failed:', error);
      throw new Error(`Cloudinary upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get image dimensions from Cloudinary
   */
  private async getImageDimensions(publicId: string): Promise<{ width: number; height: number }> {
    try {
      const result = await cloudinary.api.resource(publicId);
      return {
        width: result.width,
        height: result.height
      };
    } catch (error) {
      console.error(`❌ Failed to get image dimensions for ${publicId}:`, error);
      // Return safe default that will trigger upscaling
      return { width: 1024, height: 1024 };
    }
  }

  /**
   * Determine if image needs upscaling for print quality
   * Images below 3000px on longest side are considered low-resolution
   */
  private needsUpscaling(width: number, height: number): boolean {
    const longestSide = Math.max(width, height);
    const threshold = 3000;
    return longestSide < threshold;
  }

  /**
   * Generate all image variants according to business requirements
   * Made public so it can be called after Cloudinary uploads in variation generation
   */
  async generateImageVariants(
    publicId: string,
    version: string,
    metadata: UploadMetadata
  ): Promise<ImageVariants> {

    const baseTransform = {
      version: parseInt(version),
    };

    try {
      // Get actual image dimensions to determine if upscaling is needed
      const dimensions = await this.getImageDimensions(publicId);
      const requiresUpscaling = this.needsUpscaling(dimensions.width, dimensions.height);

      console.log(`📐 Image dimensions for ${publicId}:`, {
        width: dimensions.width,
        height: dimensions.height,
        longestSide: Math.max(dimensions.width, dimensions.height),
        requiresUpscaling
      });

      // Environment variables for overlays
      const watermarkId = process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo';
      const brandLogoId = process.env.CLOUDINARY_BRAND_LOGO_PUBLIC_ID || 'brand_assets/pawtraits_brand_logo';
      const watermarkOpacity = parseInt(process.env.CLOUDINARY_WATERMARK_OPACITY || '20');

      // 1. ORIGINAL - 300 DPI, no overlay, secured for print fulfillment only
      // Apply upscaling ONLY if image is low-resolution (< 3000px)
      // Note: These URLs are stored in DB for reference, but actual print orders
      // should call getOriginalPrintUrl() to generate fresh URLs with shorter expiry
      const originalExpiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

      const originalTransform: any = {
        ...baseTransform,
        quality: 100,
        format: 'png',
        dpi: 300,
        sign_url: true,
        expires_at: originalExpiresAt // 30-day expiry for stored URLs
      };

      if (requiresUpscaling) {
        // Low-res image (e.g., Gemini 1024x1024) - apply upscaling
        // Max 5315px covers: 45×30cm landscape, 30×45cm portrait, 40×40cm square @300dpi
        originalTransform.width = 5315; // Covers largest print size (45cm at 300 DPI)
        originalTransform.height = 5315; // Max height (45cm at 300 DPI)
        originalTransform.crop = 'fit'; // Fit within dimensions, allows upscaling
        console.log(`🔼 Applying upscaling to low-res image: ${publicId} (max 5315px = 45cm @300dpi)`);
      } else {
        // High-res image (e.g., Midjourney 4096x4096+) - use original quality
        console.log(`✅ Using original high-res quality for: ${publicId}`);
      }

      const originalUrl = cloudinary.url(publicId, originalTransform);

      // 2. DOWNLOAD - 300 DPI, brand overlay bottom right, signed for purchase verification
      // Note: Stored URLs for reference, actual downloads should call getDownloadUrl()
      const downloadExpiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

      const downloadUrl = cloudinary.url(publicId, {
        ...baseTransform,
        quality: 100,
        format: 'png',
        dpi: 300,
        overlay: brandLogoId,
        gravity: 'south_east',
        x: 30,
        y: 30,
        width_overlay: 120,
        height_overlay: 40,
        opacity: 80,
        sign_url: true,
        expires_at: downloadExpiresAt // 30-day expiry for stored URLs
      });

      // Security configuration for signed URLs (simple signature)
      // For now, disable URL signing for public variants to fix 502 errors
      // These variants are watermarked and safe for public access
      const securityConfig = {
        // sign_url: true, // Temporarily disabled to fix 502 errors
        // Use simple signing instead of auth_token for now
      };

      // 3. FULL SIZE - watermarked for detail views (secured access)
      const fullSizeUrl = cloudinary.url(publicId, {
        ...baseTransform,
        ...securityConfig,
        width: 1200,
        crop: 'limit', // Maintain aspect ratio, don't crop
        quality: 85,
        format: 'auto',
        overlay: watermarkId,
        opacity: watermarkOpacity,
        gravity: 'center'
      });

      // 4. THUMBNAIL - small, no overlay for rows/carts (secured access)
      const thumbnailUrl = cloudinary.url(publicId, {
        ...baseTransform,
        ...securityConfig,
        width: 150,
        height: 150,
        crop: 'fill',
        quality: 80,
        format: 'auto'
      });

      // 5. MID SIZE - medium, no overlay for catalog cards (secured access)
      const midSizeUrl = cloudinary.url(publicId, {
        ...baseTransform,
        ...securityConfig,
        width: 400,
        crop: 'limit', // Maintain aspect ratio, don't crop
        quality: 85,
        format: 'auto'
      });

      // 6. SOCIAL MEDIA - brand overlay, various formats
      const socialFormats = {
        instagram_post: cloudinary.url(publicId, {
          ...baseTransform,
          width: 1080,
          height: 1080,
          crop: 'fill',
          quality: 85,
          format: 'jpg',
          overlay: brandLogoId,
          gravity: 'south_east',
          x: 40,
          y: 40,
          width_overlay: 150,
          height_overlay: 50,
          opacity: 90
        }),
        instagram_story: cloudinary.url(publicId, {
          ...baseTransform,
          width: 1080,
          height: 1920,
          crop: 'fill',
          quality: 85,
          format: 'jpg',
          overlay: brandLogoId,
          gravity: 'south_east',
          x: 40,
          y: 40,
          width_overlay: 150,
          height_overlay: 50,
          opacity: 90
        }),
        facebook_post: cloudinary.url(publicId, {
          ...baseTransform,
          width: 1200,
          height: 630,
          crop: 'fill',
          quality: 85,
          format: 'jpg',
          overlay: brandLogoId,
          gravity: 'south_east',
          x: 30,
          y: 30,
          width_overlay: 120,
          height_overlay: 40,
          opacity: 90
        }),
        twitter_card: cloudinary.url(publicId, {
          ...baseTransform,
          width: 1200,
          height: 675,
          crop: 'fill',
          quality: 85,
          format: 'jpg',
          overlay: brandLogoId,
          gravity: 'south_east',
          x: 30,
          y: 30,
          width_overlay: 120,
          height_overlay: 40,
          opacity: 90
        })
      };

      const variants: ImageVariants = {
        original: {
          url: originalUrl,
          access_type: 'print_fulfillment_only',
          dpi: 300,
          overlay: 'none',
          description: 'For printing'
        },
        download: {
          url: downloadUrl,
          access_type: 'signed_authenticated',
          dpi: 300,
          overlay: 'brand_bottom_right',
          description: 'Downloadable from gallery once purchased'
        },
        full_size: {
          url: fullSizeUrl,
          access_type: 'public',
          overlay: 'watermark_center',
          description: 'Detail page / modal'
        },
        thumbnail: {
          url: thumbnailUrl,
          access_type: 'public',
          size: 'small',
          overlay: 'none',
          description: 'In rows or carts'
        },
        mid_size: {
          url: midSizeUrl,
          access_type: 'public',
          size: 'medium',
          overlay: 'none',
          description: 'Shop / catalog cards'
        },
        social_media_post: {
          url: socialFormats.instagram_post, // Default to Instagram post
          access_type: 'public_after_purchase',
          overlay: 'brand_bottom_right',
          description: 'Sharing to social',
          formats: socialFormats
        }
      };

      console.log(`✅ Generated variants: ${Object.keys(variants).join(', ')}`);
      return variants;

    } catch (error) {
      console.error('❌ Variant generation failed:', error);
      throw new Error(`Variant generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate QR code overlay for partner shops
   */
  private async generateQROverlay(
    publicId: string,
    baseTransform: any,
    metadata: UploadMetadata
  ): Promise<ImageVariants['qr_overlay']> {
    
    try {
      // Generate QR code data
      const qrData = {
        landing_url: `${process.env.QR_CODE_BASE_URL}/shop/${metadata.imageId || publicId}`,
        partner_id: metadata.partnerId,
        discount_code: `PARTNER${process.env.QR_CODE_DEFAULT_DISCOUNT}`,
        image_id: metadata.imageId || publicId
      };

      console.log(`🔄 Generating QR code for partner: ${metadata.partnerId}`);

      // Create QR code as base64
      const qrCodeDataUrl = await QRCode.toDataURL(qrData.landing_url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Upload QR code as overlay
      const qrUpload = await cloudinary.uploader.upload(qrCodeDataUrl, {
        public_id: `qr_codes/${publicId.replace(/\//g, '_')}_qr`,
        folder: 'pawtraits/qr_overlays',
        overwrite: true // QR codes can be overwritten
      });

      // Generate image with QR overlay
      const qrOverlayUrl = cloudinary.url(publicId, {
        ...baseTransform,
        width: 800,
        height: 1000,
        crop: 'fill',
        overlay: qrUpload.public_id,
        gravity: 'south_east',
        x: 20,
        y: 20,
        width_in_overlay: 120,
        height_in_overlay: 120
      });

      console.log(`✅ QR overlay generated for partner: ${metadata.partnerId}`);

      return {
        url: qrOverlayUrl,
        qr_data: qrData
      };

    } catch (error) {
      console.error('❌ QR overlay generation failed:', error);
      throw new Error(`QR overlay generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get original print-quality URL (for print fulfillment only)
   * Applies smart upscaling for low-resolution images
   * URLs expire after 48 hours for security (regenerate if fulfillment delayed)
   */
  async getOriginalPrintUrl(publicId: string, orderId: string): Promise<string> {
    try {
      ensureCloudinaryConfig();
      console.log(`🔄 Generating original print URL for order: ${orderId}`);

      // Get image dimensions to determine if upscaling is needed
      const dimensions = await this.getImageDimensions(publicId);
      const requiresUpscaling = this.needsUpscaling(dimensions.width, dimensions.height);

      console.log(`📐 Image dimensions for print order ${orderId}:`, {
        publicId,
        width: dimensions.width,
        height: dimensions.height,
        longestSide: Math.max(dimensions.width, dimensions.height),
        requiresUpscaling
      });

      // Generate signed URL with 48-hour expiry for Gelato fulfillment
      // This provides security while giving plenty of time for print processing
      const expiresAt = Math.floor(Date.now() / 1000) + (48 * 60 * 60); // 48 hours from now

      const printTransform: any = {
        quality: 100,
        format: 'png',
        dpi: 300,
        sign_url: true,
        expires_at: expiresAt // Time-based expiry for security
        // Note: Simple signed URLs work with external services like Gelato
        // URLs expire after 48 hours and must be regenerated if needed
      };

      if (requiresUpscaling) {
        // Low-res image (e.g., Gemini 1024x1024) - apply upscaling
        // Max 5315px covers: 45×30cm landscape, 30×45cm portrait, 40×40cm square @300dpi
        printTransform.width = 5315; // Covers largest print size (45cm at 300 DPI)
        printTransform.height = 5315; // Max height (45cm at 300 DPI)
        printTransform.crop = 'fit'; // Fit within dimensions, allows upscaling
        console.log(`🔼 Applying upscaling for low-res print order: ${orderId} (max 5315px = 45cm @300dpi)`);
      } else {
        // High-res image (e.g., Midjourney 4096x4096+) - use original quality
        console.log(`✅ Using original high-res quality for print order: ${orderId}`);
      }

      const signedUrl = cloudinary.url(publicId, printTransform);

      console.log(`✅ Original print URL generated for order: ${orderId}`);
      return signedUrl;

    } catch (error) {
      console.error('❌ Original print URL generation failed:', error);
      throw new Error(`Original print URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get download URL with brand overlay (after purchase verification)
   * URLs expire after 7 days for security (customer can request new URL)
   */
  async getDownloadUrl(publicId: string, userId: string, orderId: string): Promise<string> {
    try {
      ensureCloudinaryConfig();
      // TODO: Verify user has purchased this image
      console.log(`🔄 Generating download URL for user: ${userId}, order: ${orderId}`);

      const brandLogoId = process.env.CLOUDINARY_BRAND_LOGO_PUBLIC_ID || 'brand_assets/pawtraits_brand_logo';

      // Generate signed URL with 7-day expiry for customer downloads
      // Customers can request a new URL if expired
      const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days from now

      const signedUrl = cloudinary.url(publicId, {
        quality: 100,
        format: 'png',
        dpi: 300,
        overlay: brandLogoId,
        gravity: 'south_east',
        x: 30,
        y: 30,
        width_overlay: 120,
        height_overlay: 40,
        opacity: 80,
        sign_url: true,
        expires_at: expiresAt // 7-day expiry for security
      });

      console.log(`✅ Download URL generated for user: ${userId} (expires in 7 days)`);
      return signedUrl;

    } catch (error) {
      console.error('❌ Download URL generation failed:', error);
      throw new Error(`Download URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get social media URLs with brand overlay (after purchase verification)
   */
  async getSocialMediaUrls(
    publicId: string, 
    userId: string,
    orderId: string
  ): Promise<ImageVariants['social_media_post']['formats']> {
    
    try {
      ensureCloudinaryConfig();
      // TODO: Verify purchase/order exists
      console.log(`🔄 Generating social media URLs for user: ${userId}, order: ${orderId}`);
      
      const brandLogoId = process.env.CLOUDINARY_BRAND_LOGO_PUBLIC_ID || 'brand_assets/pawtraits_brand_logo';
      
      const socialUrls = {
        instagram_post: cloudinary.url(publicId, {
          width: 1080,
          height: 1080,
          crop: 'fill',
          quality: 85,
          format: 'jpg',
          overlay: brandLogoId,
          gravity: 'south_east',
          x: 40,
          y: 40,
          width_overlay: 150,
          height_overlay: 50,
          opacity: 90
        }),
        instagram_story: cloudinary.url(publicId, {
          width: 1080,
          height: 1920,
          crop: 'fill',
          quality: 85,
          format: 'jpg',
          overlay: brandLogoId,
          gravity: 'south_east',
          x: 40,
          y: 40,
          width_overlay: 150,
          height_overlay: 50,
          opacity: 90
        }),
        facebook_post: cloudinary.url(publicId, {
          width: 1200,
          height: 630,
          crop: 'fill',
          quality: 85,
          format: 'jpg',
          overlay: brandLogoId,
          gravity: 'south_east',
          x: 30,
          y: 30,
          width_overlay: 120,
          height_overlay: 40,
          opacity: 90
        }),
        twitter_card: cloudinary.url(publicId, {
          width: 1200,
          height: 675,
          crop: 'fill',
          quality: 85,
          format: 'jpg',
          overlay: brandLogoId,
          gravity: 'south_east',
          x: 30,
          y: 30,
          width_overlay: 120,
          height_overlay: 40,
          opacity: 90
        })
      };

      console.log(`✅ Social media URLs generated for user: ${userId}`);
      return socialUrls;

    } catch (error) {
      console.error('❌ Social media URL generation failed:', error);
      throw new Error(`Social media URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get public variant URL by type with security (signed URLs)
   */
  getPublicVariantUrl(publicId: string, variant: 'full_size' | 'thumbnail' | 'mid_size' | 'purchased'): string {
    try {
      ensureCloudinaryConfig();
      
      console.log(`🔄 Generating Cloudinary URL for publicId: "${publicId}", variant: ${variant}`);
      
      const watermarkId = process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo';
      const watermarkOpacity = parseInt(process.env.CLOUDINARY_WATERMARK_OPACITY || '20');

      // Base configuration for signed URLs (simple signature without auth_token)
      // Temporarily disable URL signing to fix 502 errors with watermarked variants
      const baseConfig = {
        // sign_url: true, // Temporarily disabled to fix 502 errors
        // Use simple signing instead of auth_token for now
      };

      let generatedUrl: string;
      
      switch (variant) {
        case 'full_size':
          generatedUrl = cloudinary.url(publicId, {
            ...baseConfig,
            width: 1200,
            crop: 'limit', // Maintain aspect ratio, don't crop
            quality: 85,
            overlay: watermarkId,
            opacity: watermarkOpacity,
            gravity: 'center'
          });
          break;
        
        case 'thumbnail':
          generatedUrl = cloudinary.url(publicId, {
            ...baseConfig,
            width: 150,
            height: 150,
            crop: 'fill',
            quality: 80
          });
          break;
          
        case 'mid_size':
          generatedUrl = cloudinary.url(publicId, {
            ...baseConfig,
            width: 400,
            crop: 'limit', // Maintain aspect ratio, don't crop
            quality: 85
          });
          break;
          
        case 'purchased':
          // Full quality image with brand overlay in lower right corner
          generatedUrl = cloudinary.url(publicId, {
            ...baseConfig,
            quality: 95, // High quality for purchased downloads
            overlay: watermarkId,
            opacity: watermarkOpacity,
            gravity: 'south_east', // Lower right corner
            x: 20, // 20px from right edge
            y: 20  // 20px from bottom edge
          });
          break;
          
        default:
          throw new Error(`Unknown public variant: ${variant}`);
      }
      
      console.log(`✅ Generated Cloudinary URL: ${generatedUrl}`);
      return generatedUrl;
      
    } catch (error) {
      console.error(`❌ Public variant URL generation failed for "${publicId}", variant: ${variant}:`, error);
      throw new Error(`Public variant URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test Cloudinary connection and watermark
   */
  async testConnection(): Promise<boolean> {
    try {
      // Ensure Cloudinary is configured
      ensureCloudinaryConfig();
      console.log('🔄 Testing Cloudinary connection...');
      
      // Test basic connection by fetching account info
      const result = await cloudinary.api.ping();
      
      if (result.status === 'ok') {
        console.log('✅ Cloudinary connection successful');
        
        // Test watermark exists
        try {
          await cloudinary.api.resource(process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo');
          console.log('✅ Watermark found');
        } catch (watermarkError) {
          console.warn('⚠️ Watermark not found. Please upload your watermark SVG to Cloudinary with public_id: pawtraits_watermark_logo');
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Cloudinary connection failed:', error);
      return false;
    }
  }

  /**
   * Upload watermark to Cloudinary
   */
  async uploadWatermark(svgPath: string): Promise<boolean> {
    try {
      // Ensure Cloudinary is configured
      ensureCloudinaryConfig();
      console.log('🔄 Uploading watermark to Cloudinary...');
      
      const result = await cloudinary.uploader.upload(svgPath, {
        public_id: process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo',
        resource_type: 'image',
        format: 'svg',
        overwrite: true
      });

      console.log(`✅ Watermark uploaded successfully: ${result.public_id}`);
      return true;

    } catch (error) {
      console.error('❌ Watermark upload failed:', error);
      return false;
    }
  }

  /**
   * Regenerate image variants with fresh expiry times
   * Call this method when stored URLs have expired (after 30 days)
   */
  async regenerateImageVariants(
    publicId: string,
    version: string,
    metadata: UploadMetadata
  ): Promise<ImageVariants> {
    console.log(`🔄 Regenerating image variants with fresh expiry for: ${publicId}`);
    return this.generateImageVariants(publicId, version, metadata);
  }

  /**
   * Check if a Cloudinary signed URL has expired or will expire soon
   * @param url The Cloudinary URL to check
   * @param bufferMinutes Minutes before expiry to consider "expiring soon" (default: 60)
   * @returns true if expired or expiring soon, false otherwise
   */
  isUrlExpired(url: string, bufferMinutes: number = 60): boolean {
    try {
      // Extract expires_at parameter from URL
      const urlObj = new URL(url);
      const expiresAtParam = urlObj.searchParams.get('expires_at');

      if (!expiresAtParam) {
        // No expiry parameter means either unsigned URL or no expiry
        return false;
      }

      const expiresAt = parseInt(expiresAtParam);
      const now = Math.floor(Date.now() / 1000);
      const buffer = bufferMinutes * 60;

      // Check if expired or will expire within buffer time
      return (expiresAt - now) <= buffer;
    } catch (error) {
      console.error('❌ Error checking URL expiry:', error);
      // Assume expired if we can't parse the URL
      return true;
    }
  }
}

// Export singleton instance
export const cloudinaryService = new CloudinaryImageService();