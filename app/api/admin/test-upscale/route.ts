import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cloudinaryService } from '@/lib/cloudinary';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { imageId } = await request.json();

    if (!imageId) {
      return NextResponse.json({ error: 'Image ID required' }, { status: 400 });
    }

    // Get image from catalog or customer_generated_images
    let imageData: any = null;

    // Try image_catalog first
    const { data: catalogImage } = await supabase
      .from('image_catalog')
      .select('id, cloudinary_public_id, image_variants, filename')
      .eq('id', imageId)
      .single();

    if (catalogImage?.cloudinary_public_id) {
      imageData = catalogImage;
    } else {
      // Try customer_generated_images
      const { data: customerImage } = await supabase
        .from('customer_generated_images')
        .select('id, cloudinary_public_id, image_variants, cloudinary_public_id')
        .eq('id', imageId)
        .single();

      if (customerImage?.cloudinary_public_id) {
        imageData = customerImage;
      }
    }

    if (!imageData?.cloudinary_public_id) {
      return NextResponse.json({
        error: 'Image not found or missing Cloudinary public ID'
      }, { status: 404 });
    }

    console.log('🧪 Testing upscale for:', imageData.cloudinary_public_id);

    // Get image dimensions from Cloudinary
    const dimensions = await (cloudinaryService as any).getImageDimensions(
      imageData.cloudinary_public_id
    );

    // Check if upscaling is needed
    const needsUpscaling = (cloudinaryService as any).needsUpscaling(
      dimensions.width,
      dimensions.height
    );

    // Generate the print URL (with smart upscaling if needed)
    const printUrl = await cloudinaryService.getOriginalPrintUrl(
      imageData.cloudinary_public_id,
      `test-${imageId}`
    );

    // Generate a regular URL without upscaling for comparison
    const cloudinary = require('cloudinary').v2;
    const regularUrl = cloudinary.url(imageData.cloudinary_public_id, {
      quality: 100,
      format: 'png',
      sign_url: true
    });

    // Also generate a public unsigned URL for easy viewing
    const publicOriginalUrl = cloudinary.url(imageData.cloudinary_public_id, {
      quality: 100,
      format: 'png'
    });

    const publicUpscaledUrl = cloudinary.url(imageData.cloudinary_public_id, {
      quality: 100,
      format: 'png',
      width: 8500,
      crop: 'fit', // 'fit' allows upscaling, 'limit' prevents it
      flags: 'progressive.lossy'
    });

    return NextResponse.json({
      success: true,
      imageId: imageData.id,
      publicId: imageData.cloudinary_public_id,
      filename: imageData.filename,
      originalDimensions: dimensions,
      longestSide: Math.max(dimensions.width, dimensions.height),
      needsUpscaling,
      upscalingThreshold: 3000,
      urls: {
        // Authenticated URLs (may require auth token to access)
        authenticatedOriginal: regularUrl,
        authenticatedUpscaled: printUrl,

        // Public unsigned URLs (easier for testing)
        publicOriginal: publicOriginalUrl,
        publicUpscaled: publicUpscaledUrl,
      },
      transformation: {
        applied: needsUpscaling,
        parameters: needsUpscaling ? {
          width: 8500,
          crop: 'fit',
          flags: 'progressive.lossy'
        } : 'none (image already high-res)'
      },
      expectedUpscaledSize: needsUpscaling ? {
        calculation: `Aspect ratio ${dimensions.width}:${dimensions.height}`,
        estimatedDimensions: dimensions.width > dimensions.height
          ? `8500 x ${Math.round(8500 * dimensions.height / dimensions.width)}`
          : `${Math.round(8500 * dimensions.width / dimensions.height)} x 8500`
      } : 'Original dimensions maintained',
      storedVariants: imageData.image_variants || null
    });

  } catch (error) {
    console.error('Test upscale error:', error);
    return NextResponse.json(
      {
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
