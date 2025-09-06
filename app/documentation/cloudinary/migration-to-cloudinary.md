# Cloudinary Migration & Multi-Format Image Handling

## Overview

Migrate from Supabase storage to Cloudinary for advanced image processing capabilities, including watermarking, format optimization, and QR code overlays.

## 1. Database Schema Updates

### Update image_catalog table to support Cloudinary

```sql
-- Add Cloudinary-specific fields to image_catalog table
ALTER TABLE image_catalog ADD COLUMN cloudinary_public_id TEXT;
ALTER TABLE image_catalog ADD COLUMN cloudinary_version VARCHAR(20);
ALTER TABLE image_catalog ADD COLUMN cloudinary_signature TEXT;
3
-- Add image variant tracking
ALTER TABLE image_catalog ADD COLUMN image_variants JSONB DEFAULT '{}';
-- Structure: {
--   "print_quality": {"url": "...", "secure": true},
--   "catalog_watermarked": {"url": "...", "watermark": "logo"},
--   "social_optimized": {"url": "...", "formats": ["instagram", "facebook"]},
--   "qr_overlay": {"url": "...", "qr_data": "landing_url"}
-- }

-- Add access control
ALTER TABLE image_catalog ADD COLUMN access_level TEXT DEFAULT 'public'; 
-- 'public', 'watermarked', 'premium', 'print_quality'

-- Update the view to include new fields
DROP VIEW IF EXISTS image_catalog_with_details;
CREATE VIEW image_catalog_with_details AS
SELECT 
  ic.*,
  b.name as breed_name,
  t.name as theme_name, 
  s.name as style_name,
  f.name as format_name,
  c.name as coat_name,
  c.hex_color as coat_hex_color
FROM image_catalog ic
LEFT JOIN breeds b ON ic.breed_id = b.id
LEFT JOIN themes t ON ic.theme_id = t.id  
LEFT JOIN styles s ON ic.style_id = s.id
LEFT JOIN formats f ON ic.format_id = f.id
LEFT JOIN coat_colors c ON ic.coat_id = c.id;
```

### Create QR tracking table

```sql
CREATE TABLE qr_code_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  image_id UUID REFERENCES image_catalog(id),
  partner_id UUID, -- References partner/groomer table
  qr_code_data JSONB NOT NULL, -- {"landing_url": "...", "discount_code": "...", "referral_id": "..."}
  scan_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_qr_tracking_image ON qr_code_tracking(image_id);
CREATE INDEX idx_qr_tracking_partner ON qr_code_tracking(partner_id);
```

## 2. Environment Variables Setup

```bash
# Add to .env.local
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key  
CLOUDINARY_API_SECRET=your_api_secret

# Watermark settings
CLOUDINARY_WATERMARK_PUBLIC_ID=pawtraits_watermark_logo
CLOUDINARY_WATERMARK_OPACITY=35

# QR Code settings  
QR_CODE_BASE_URL=https://pawtraits.com/shop
QR_CODE_DEFAULT_DISCOUNT=10
```

## 3. Cloudinary Configuration

### Install dependencies

```bash
npm install cloudinary qrcode sharp
npm install @types/qrcode --save-dev
```

### Cloudinary service setup

```typescript
// lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface ImageVariants {
  print_quality: {
    url: string;
    secure_url: string;
    access_type: 'signed';
  };
  catalog_watermarked: {
    url: string;
    watermark_applied: boolean;
  };
  social_optimized: {
    instagram_post: string; // 1080x1080
    instagram_story: string; // 1080x1920  
    facebook_post: string; // 1200x630
    twitter_card: string; // 1200x675
  };
  qr_overlay?: {
    url: string;
    qr_data: any;
  };
}

export class CloudinaryImageService {
  
  /**
   * Upload original image and generate all variants
   */
  async uploadAndProcessImage(
    imageBuffer: Buffer,
    filename: string,
    metadata: {
      breed: string;
      theme: string; 
      style: string;
      partnerId?: string;
    }
  ): Promise<{
    public_id: string;
    version: string;
    variants: ImageVariants;
  }> {
    
    // 1. Upload original high-quality image
    const uploadResult = await cloudinary.uploader.upload(
      `data:image/png;base64,${imageBuffer.toString('base64')}`,
      {
        public_id: `pawtraits/${metadata.breed}/${metadata.theme}/${filename}`,
        folder: 'pawtraits/originals',
        resource_type: 'image',
        quality: 'auto:best',
        format: 'auto',
        context: `breed=${metadata.breed}|theme=${metadata.theme}|style=${metadata.style}`,
        tags: [metadata.breed, metadata.theme, metadata.style, 'original']
      }
    );

    // 2. Generate all variants
    const variants = await this.generateImageVariants(
      uploadResult.public_id, 
      uploadResult.version,
      metadata
    );

    return {
      public_id: uploadResult.public_id,
      version: uploadResult.version.toString(),
      variants
    };
  }

  /**
   * Generate all image variants from uploaded original
   */
  private async generateImageVariants(
    publicId: string,
    version: string,
    metadata: any
  ): Promise<ImageVariants> {
    
    const baseTransform = {
      version,
      quality: 'auto',
      fetch_format: 'auto'
    };

    // Print Quality (Signed URL for security)
    const printQualityUrl = cloudinary.url(publicId, {
      ...baseTransform,
      width: 3000,
      height: 3750, // 4:5 ratio at high res
      crop: 'fill',
      quality: 100,
      format: 'png',
      sign_url: true,
      type: 'authenticated' // Requires signed access
    });

    // Catalog with Watermark
    const catalogUrl = cloudinary.url(publicId, {
      ...baseTransform,
      width: 800,
      height: 1000,
      crop: 'fill',
      quality: 85,
      overlay: process.env.CLOUDINARY_WATERMARK_PUBLIC_ID,
      opacity: parseInt(process.env.CLOUDINARY_WATERMARK_OPACITY || '35'),
      gravity: 'center'
    });

    // Social Media Variants
    const socialVariants = {
      instagram_post: cloudinary.url(publicId, {
        ...baseTransform,
        width: 1080,
        height: 1080,
        crop: 'fill',
        quality: 85
      }),
      instagram_story: cloudinary.url(publicId, {
        ...baseTransform, 
        width: 1080,
        height: 1920,
        crop: 'fill',
        quality: 85
      }),
      facebook_post: cloudinary.url(publicId, {
        ...baseTransform,
        width: 1200, 
        height: 630,
        crop: 'fill',
        quality: 85
      }),
      twitter_card: cloudinary.url(publicId, {
        ...baseTransform,
        width: 1200,
        height: 675, 
        crop: 'fill',
        quality: 85
      })
    };

    // QR Code Overlay (if partner ID provided)
    let qrOverlay;
    if (metadata.partnerId) {
      qrOverlay = await this.generateQROverlay(publicId, baseTransform, metadata);
    }

    return {
      print_quality: {
        url: printQualityUrl,
        secure_url: printQualityUrl.replace('http://', 'https://'),
        access_type: 'signed'
      },
      catalog_watermarked: {
        url: catalogUrl,
        watermark_applied: true
      },
      social_optimized: socialVariants,
      ...(qrOverlay && { qr_overlay: qrOverlay })
    };
  }

  /**
   * Generate QR code overlay for partner shops
   */
  private async generateQROverlay(
    publicId: string,
    baseTransform: any,
    metadata: any
  ) {
    // Generate QR code data
    const qrData = {
      landing_url: `${process.env.QR_CODE_BASE_URL}/shop/${publicId}`,
      partner_id: metadata.partnerId,
      discount_code: `PARTNER${process.env.QR_CODE_DEFAULT_DISCOUNT}`,
      image_id: publicId
    };

    // Create QR code as base64
    const QRCode = require('qrcode');
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
      public_id: `qr_codes/${publicId}_qr`,
      folder: 'pawtraits/qr_overlays'
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

    return {
      url: qrOverlayUrl,
      qr_data: qrData
    };
  }

  /**
   * Get signed URL for print-quality image (premium access)
   */
  async getPrintQualityUrl(publicId: string, userId: string): Promise<string> {
    // TODO: Add user permission check here
    
    return cloudinary.url(publicId, {
      width: 3000,
      height: 3750,
      crop: 'fill', 
      quality: 100,
      format: 'png',
      sign_url: true,
      type: 'authenticated',
      auth_token: {
        duration: 3600, // 1 hour access
        start_time: Math.floor(Date.now() / 1000)
      }
    });
  }

  /**
   * Get social media URLs after purchase verification
   */
  async getSocialMediaUrls(
    publicId: string, 
    userId: string,
    orderId: string
  ): Promise<ImageVariants['social_optimized']> {
    // TODO: Verify purchase/order exists
    
    const baseTransform = {
      quality: 'auto:good',
      fetch_format: 'auto'
    };

    return {
      instagram_post: cloudinary.url(publicId, {
        ...baseTransform,
        width: 1080,
        height: 1080,
        crop: 'fill'
      }),
      instagram_story: cloudinary.url(publicId, {
        ...baseTransform,
        width: 1080, 
        height: 1920,
        crop: 'fill'
      }),
      facebook_post: cloudinary.url(publicId, {
        ...baseTransform,
        width: 1200,
        height: 630,
        crop: 'fill'
      }),
      twitter_card: cloudinary.url(publicId, {
        ...baseTransform,
        width: 1200,
        height: 675,
        crop: 'fill' 
      })
    };
  }
}

export const cloudinaryService = new CloudinaryImageService();
```

## 4. Migration Script

```typescript
// scripts/migrate-to-cloudinary.ts

import { createClient } from '@supabase/supabase-js';
import { cloudinaryService } from '../lib/cloudinary';
import fs from 'fs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrateImagesToCloudinary() {
  console.log('🚀 Starting Cloudinary migration...');

  // Get all images from current storage
  const { data: images, error } = await supabase
    .from('image_catalog_with_details') 
    .select('*')
    .is('cloudinary_public_id', null) // Only unmigrated images
    .limit(10); // Process in batches

  if (error) {
    console.error('❌ Error fetching images:', error);
    return;
  }

  console.log(`📦 Found ${images.length} images to migrate`);

  for (const image of images) {
    try {
      console.log(`🔄 Processing: ${image.filename}`);

      // Download from Supabase storage
      const { data: fileData } = await supabase.storage
        .from('generated-images')
        .download(image.storage_path);

      if (!fileData) {
        console.error(`❌ Could not download: ${image.filename}`);
        continue;
      }

      // Convert to buffer
      const buffer = Buffer.from(await fileData.arrayBuffer());

      // Upload to Cloudinary and generate variants
      const result = await cloudinaryService.uploadAndProcessImage(
        buffer,
        image.filename,
        {
          breed: image.breed_name,
          theme: image.theme_name,
          style: image.style_name
        }
      );

      // Update database record
      const { error: updateError } = await supabase
        .from('image_catalog')
        .update({
          cloudinary_public_id: result.public_id,
          cloudinary_version: result.version,
          image_variants: result.variants,
          updated_at: new Date().toISOString()
        })
        .eq('id', image.id);

      if (updateError) {
        console.error(`❌ Database update failed for ${image.filename}:`, updateError);
      } else {
        console.log(`✅ Migrated: ${image.filename}`);
      }

    } catch (error) {
      console.error(`❌ Migration failed for ${image.filename}:`, error);
    }
  }

  console.log('🎉 Migration batch complete!');
}

// Run migration
migrateImagesToCloudinary();
```

## 5. API Routes for Image Access

```typescript
// app/api/images/[imageId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cloudinaryService } from '@/lib/cloudinary';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { imageId: string } }
) {
  const { searchParams } = new URL(request.url);
  const variant = searchParams.get('variant') || 'catalog_watermarked';
  const userId = searchParams.get('userId');
  const orderId = searchParams.get('orderId');

  try {
    // Get image data
    const { data: image, error } = await supabase
      .from('image_catalog_with_details')
      .select('*')
      .eq('id', params.imageId)
      .single();

    if (error || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Handle different variant requests
    switch (variant) {
      case 'print_quality':
        if (!userId) {
          return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        
        // TODO: Verify user has purchased this image
        const printUrl = await cloudinaryService.getPrintQualityUrl(
          image.cloudinary_public_id, 
          userId
        );
        
        return NextResponse.json({ url: printUrl });

      case 'social':
        if (!userId || !orderId) {
          return NextResponse.json({ error: 'Purchase verification required' }, { status: 401 });
        }

        // TODO: Verify order exists and belongs to user
        const socialUrls = await cloudinaryService.getSocialMediaUrls(
          image.cloudinary_public_id,
          userId, 
          orderId
        );

        return NextResponse.json({ urls: socialUrls });

      case 'catalog_watermarked':
      default:
        // Public access with watermark
        const catalogUrl = image.image_variants?.catalog_watermarked?.url;
        
        if (!catalogUrl) {
          return NextResponse.json({ error: 'Variant not available' }, { status: 404 });
        }

        return NextResponse.json({ url: catalogUrl });
    }

  } catch (error) {
    console.error('Image access error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## 6. QR Code Landing Page

```typescript
// app/shop/[imageId]/page.tsx

import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface QRLandingPageProps {
  params: { imageId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function QRLandingPage({ 
  params, 
  searchParams 
}: QRLandingPageProps) {
  
  const partnerId = searchParams.partner_id as string;
  const discountCode = searchParams.discount as string || 'PARTNER10';

  // Track QR code scan
  if (partnerId) {
    await supabase.rpc('increment_qr_scan', {
      p_image_id: params.imageId,
      p_partner_id: partnerId
    });
  }

  // Get image details
  const { data: image } = await supabase
    .from('image_catalog_with_details')
    .select('*')
    .eq('cloudinary_public_id', params.imageId)
    .single();

  if (!image) {
    redirect('/404');
  }

  // Auto-add to cart with discount
  const addToCartUrl = `/cart/add?image=${image.id}&discount=${discountCode}&ref=${partnerId}`;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          
          {/* Header with discount banner */}
          <div className="bg-purple-600 text-white text-center py-4">
            <h1 className="text-2xl font-bold">Special Partner Discount!</h1>
            <p className="text-purple-100">Get {discountCode.slice(-2)}% off this beautiful portrait</p>
          </div>

          {/* Image display */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
            <div>
              <img
                src={image.image_variants?.catalog_watermarked?.url}
                alt={`${image.breed_name} ${image.theme_name} portrait`}
                className="w-full rounded-lg shadow-md"
              />
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  {image.breed_name} - {image.theme_name}
                </h2>
                <p className="text-gray-600 mt-2">{image.description}</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {image.breed_name}
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    {image.theme_name}
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                    {image.style_name}
                  </span>
                </div>

                <div className="border-t pt-4">
                  <div className="text-2xl font-bold text-gray-900 mb-2">
                    <span className="line-through text-gray-500">£32.50</span>
                    <span className="text-green-600 ml-2">£29.25</span>
                  </div>
                  <p className="text-sm text-green-600">
                    Partner discount applied: {discountCode}
                  </p>
                </div>

                <a
                  href={addToCartUrl}
                  className="w-full bg-purple-600 text-white py-4 px-6 rounded-lg font-semibold text-center hover:bg-purple-700 transition-colors block"
                >
                  Add to Cart with Discount
                </a>

                <div className="text-sm text-gray-500 space-y-1">
                  <p>✅ High-quality print delivery</p>
                  <p>✅ Multiple size options</p>
                  <p>✅ Social media sharing pack</p>
                  <p>✅ 100% satisfaction guarantee</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## 7. Frontend Components

```typescript
// components/ImageDisplay.tsx

import { useState, useEffect } from 'react';

interface ImageDisplayProps {
  imageId: string;
  variant?: 'catalog_watermarked' | 'social' | 'print_quality';
  userId?: string;
  orderId?: string;
  className?: string;
}

export function ImageDisplay({ 
  imageId, 
  variant = 'catalog_watermarked',
  userId,
  orderId,
  className = ''
}: ImageDisplayProps) {
  
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function fetchImage() {
      try {
        const params = new URLSearchParams({
          variant,
          ...(userId && { userId }),
          ...(orderId && { orderId })
        });

        const response = await fetch(`/api/images/${imageId}?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load image');
        }

        if (variant === 'social') {
          setImageUrl(data.urls.instagram_post); // Default to Instagram
        } else {
          setImageUrl(data.url);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchImage();
  }, [imageId, variant, userId, orderId]);

  if (loading) {
    return (
      <div className={`bg-gray-200 animate-pulse rounded-lg ${className}`}>
        <div className="h-full w-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded ${className}`}>
        Error: {error}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt="Pet portrait"
      className={`rounded-lg shadow-md ${className}`}
    />
  );
}
```

## 8. Testing & Deployment Steps

1. **Set up Cloudinary account and configure environment variables**

2. **Run database migrations**
   ```bash
   # Apply schema changes in Supabase SQL editor
   ```

3. **Test image upload pipeline**
   ```bash
   npm run dev
   # Test uploading a single image and verify all variants are generated
   ```

4. **Run migration script in batches**
   ```bash
   npx tsx scripts/migrate-to-cloudinary.ts
   # Monitor progress and run multiple times for all images
   ```

5. **Update frontend components to use new API**

6. **Test QR codes and landing pages**

7. **Set up monitoring for Cloudinary usage and costs**

## 9. Additional Considerations

- **Cloudinary costs**: Monitor transformation usage and storage costs
- **Backup strategy**: Keep original images in both Supabase and Cloudinary during transition
- **CDN performance**: Cloudinary provides global CDN automatically
- **Watermark design**: Create branded watermark image in Cloudinary
- **Access control**: Implement proper authentication for print-quality images
- **Analytics**: Track QR code scans and conversion rates

This architecture provides you with professional image processing capabilities while maintaining security and providing the multi-format support you need for different use cases.