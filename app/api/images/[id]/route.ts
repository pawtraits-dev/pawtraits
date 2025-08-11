import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import { CloudinaryImageService, cloudinaryService } from '@/lib/cloudinary';
import type { ImageCatalogUpdate } from '@/lib/types';

const supabaseService = new SupabaseService();
const cloudinaryImageService = new CloudinaryImageService();

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Generate dynamic variant URLs for images that don't have them stored
async function generateDynamicVariant(
  publicId: string, 
  variant: string, 
  userId: string | null, 
  orderId: string | null
) {
  try {
    switch (variant) {
      case 'original':
        if (!orderId) {
          return NextResponse.json(
            { error: 'Order ID required for original quality' },
            { status: 401 }
          );
        }
        const originalUrl = await cloudinaryService.getOriginalPrintUrl(publicId, orderId);
        return NextResponse.json({
          url: originalUrl,
          variant: variant,
          access_type: 'print_fulfillment_only',
          generated: true
        });

      case 'download':
        if (!userId || !orderId) {
          return NextResponse.json(
            { error: 'User ID and Order ID required for download' },
            { status: 401 }
          );
        }
        const downloadUrl = await cloudinaryService.getDownloadUrl(publicId, userId, orderId);
        return NextResponse.json({
          url: downloadUrl,
          variant: variant,
          access_type: 'signed_authenticated',
          generated: true
        });

      case 'social_media_post':
        if (!userId || !orderId) {
          return NextResponse.json(
            { error: 'User ID and Order ID required for social media' },
            { status: 401 }
          );
        }
        const socialUrls = await cloudinaryService.getSocialMediaUrls(publicId, userId, orderId);
        return NextResponse.json({
          urls: socialUrls,
          variant: variant,
          access_type: 'public_after_purchase',
          generated: true
        });

      case 'full_size':
      case 'thumbnail':
      case 'mid_size':
        const publicUrl = cloudinaryService.getPublicVariantUrl(publicId, variant as any);
        return NextResponse.json({
          url: publicUrl,
          variant: variant,
          access_type: 'public',
          generated: true
        });

      default:
        return NextResponse.json(
          { error: `Cannot generate variant '${variant}'` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error generating dynamic variant:', error);
    return NextResponse.json(
      { error: 'Failed to generate image variant' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // Check if requesting specific variant
    const variant = searchParams.get('variant');
    const userId = searchParams.get('userId');
    const orderId = searchParams.get('orderId');
    
    if (variant) {
      // Return Cloudinary variant with access control
      return handleVariantRequest(id, variant, userId, orderId);
    }
    
    // Default behavior - return basic image data
    const image = await supabaseService.getImage(id);
    
    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(image);
  } catch (error) {
    console.error('Error fetching image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}

async function handleVariantRequest(
  imageId: string, 
  variant: string, 
  userId: string | null, 
  orderId: string | null
) {
  try {
    // Get image data from database first
    const image = await supabaseService.getImage(imageId);
    
    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Check if image has been migrated to Cloudinary
    if (!image.cloudinary_public_id) {
      console.log(`Image ${imageId} not migrated yet, returning legacy URL`);
      return NextResponse.json({
        url: image.image_url,
        variant: variant,
        legacy: true,
        message: 'Image not yet migrated to Cloudinary'
      });
    }

    // Get variant data from JSONB column
    const imageVariants = image.image_variants || {};
    const variantData = imageVariants[variant];

    // If variant doesn't exist but we have a cloudinary_public_id, generate it dynamically
    if (!variantData && image.cloudinary_public_id) {
      console.log(`Variant '${variant}' not found, generating dynamically for image ${imageId}`);
      return generateDynamicVariant(image.cloudinary_public_id, variant, userId, orderId);
    }

    if (!variantData) {
      // Try legacy fallback URLs
      if (image.image_url || image.public_url) {
        console.log(`Using legacy URL fallback for image ${imageId}`);
        return NextResponse.json({
          url: image.image_url || image.public_url,
          variant: variant,
          legacy: true,
          message: 'Using legacy image URL'
        });
      }
      
      return NextResponse.json(
        { error: `Variant '${variant}' not available for this image` },
        { status: 404 }
      );
    }

    // Handle access control for different variants
    switch (variant) {
      case 'original':
        // Original quality for print fulfillment only - requires order verification
        if (!orderId) {
          return NextResponse.json(
            { error: 'Order ID required for original quality' },
            { status: 401 }
          );
        }
        // TODO: Verify this is a valid order and the order contains this image
        return NextResponse.json({
          url: variantData.url,
          variant: variant,
          access_type: 'print_fulfillment_only'
        });

      case 'download':
        // High quality with brand overlay - requires purchase verification
        if (!userId || !orderId) {
          return NextResponse.json(
            { error: 'User ID and Order ID required for download' },
            { status: 401 }
          );
        }
        // TODO: Verify user has purchased this image in the specified order
        return NextResponse.json({
          url: variantData.url,
          variant: variant,
          access_type: 'signed_authenticated'
        });

      case 'social_media_post':
        // Social media formats with brand overlay - requires purchase verification
        if (!userId || !orderId) {
          return NextResponse.json(
            { error: 'User ID and Order ID required for social media' },
            { status: 401 }
          );
        }
        // TODO: Verify user has purchased this image
        return NextResponse.json({
          urls: variantData.formats || variantData,
          variant: variant,
          access_type: 'public_after_purchase'
        });

      case 'full_size':
      case 'thumbnail':
      case 'mid_size':
        // Public variants - no authentication required
        return NextResponse.json({
          url: variantData.url,
          variant: variant,
          access_type: 'public'
        });

      // Legacy variants for backward compatibility
      case 'print_quality':
      case 'catalog_watermarked':
      case 'social':
      case 'social_optimized':
      case 'qr_overlay':
      default:
        // Public variants - no authentication required
        return NextResponse.json({
          url: variantData.url,
          variant: variant,
          access_type: 'public'
        });
    }

  } catch (error) {
    console.error('Error handling variant request:', error);
    return NextResponse.json(
      { error: 'Failed to process variant request' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const updateData: ImageCatalogUpdate = {
      description: body.description,
      tags: body.tags,
      rating: body.rating,
      is_featured: body.is_featured,
      is_public: body.is_public,
      generation_parameters: body.generation_parameters
    };

    const updatedImage = await supabaseService.updateImage(id, updateData);

    if (!updatedImage) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedImage);
  } catch (error) {
    console.error('Error updating image:', error);
    return NextResponse.json(
      { error: 'Failed to update image' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Get image details first to delete from storage
    const image = await supabaseService.getImage(id);
    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Delete from storage
    const deleteResult = await supabaseService.deleteImageFile(image.storage_path);
    if (!deleteResult.success) {
      console.warn('Failed to delete image file from storage:', deleteResult.error);
    }

    // Delete from database
    const success = await supabaseService.deleteImage(id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete image' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}