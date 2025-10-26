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

    // Configure cloudinary for clean URL generation
    const cloudinary = require('cloudinary').v2;

    // Test URLs at different sizes to find limits
    // Calculate aspect-ratio appropriate sizes
    const aspectRatio = dimensions.width / dimensions.height;
    const isPortrait = dimensions.height > dimensions.width;
    const isSquare = Math.abs(aspectRatio - 1) < 0.1;

    const testSizes = [
      // Small test (baseline)
      { label: '2000px (test)', width: 2000, height: 2000, printSize: '~17×17cm @300dpi' },

      // Proposed reduced max sizes (30×45cm portrait, 40×40cm square)
      {
        label: '3543px (30cm)',
        width: isPortrait ? 3543 : Math.round(3543 * aspectRatio),
        height: isPortrait ? Math.round(3543 / aspectRatio) : 3543,
        printSize: '30×45cm portrait @300dpi'
      },
      {
        label: '4724px (40cm)',
        width: 4724,
        height: 4724,
        printSize: '40×40cm square @300dpi'
      },
      {
        label: '5315px (45cm)',
        width: isPortrait ? 5315 : Math.round(5315 * aspectRatio),
        height: isPortrait ? Math.round(5315 / aspectRatio) : 5315,
        printSize: '45cm longest side @300dpi'
      },

      // Current max sizes (40×60cm portrait, 50×50cm square)
      {
        label: '7087px (60cm)',
        width: isPortrait ? 7087 : Math.round(7087 * aspectRatio),
        height: isPortrait ? Math.round(7087 / aspectRatio) : 7087,
        printSize: '60cm longest side @300dpi (current max)'
      },
      {
        label: '8500px (test)',
        width: 8500,
        height: 8500,
        printSize: '~72cm @300dpi (aggressive test)'
      }
    ];

    // Generate clean public URLs without auth parameters
    const baseUrlConfig = {
      quality: 100,
      secure: true, // Use HTTPS
      sign_url: false, // No signature for testing
      format: 'png'
    };

    const publicOriginalUrl = cloudinary.url(imageData.cloudinary_public_id, baseUrlConfig);

    // Test upscaled URLs at different sizes
    const upscaledUrls = testSizes.map(size => {
      const targetLongestSide = Math.max(size.width, size.height);
      const upscaleRatio = targetLongestSide / Math.max(dimensions.width, dimensions.height);

      return {
        size: size.label,
        printSize: size.printSize,
        dimensions: `${size.width}×${size.height}`,
        upscaleRatio: `${upscaleRatio.toFixed(1)}×`,
        url: cloudinary.url(imageData.cloudinary_public_id, {
          ...baseUrlConfig,
          width: size.width,
          height: size.height,
          crop: 'fit' // 'fit' allows upscaling, 'limit' prevents it
        })
      };
    });

    // Also test with 'scale' crop mode as alternative
    const upscaledUrlsScale = testSizes.map(size => {
      const targetLongestSide = Math.max(size.width, size.height);
      const upscaleRatio = targetLongestSide / Math.max(dimensions.width, dimensions.height);

      return {
        size: size.label,
        printSize: size.printSize,
        dimensions: `${size.width}×${size.height}`,
        upscaleRatio: `${upscaleRatio.toFixed(1)}×`,
        url: cloudinary.url(imageData.cloudinary_public_id, {
          ...baseUrlConfig,
          width: size.width,
          height: size.height,
          crop: 'scale' // Alternative upscaling method
        })
      };
    });

    return NextResponse.json({
      success: true,
      imageId: imageData.id,
      publicId: imageData.cloudinary_public_id,
      originalDimensions: dimensions,
      longestSide: Math.max(dimensions.width, dimensions.height),
      needsUpscaling,
      upscalingThreshold: 3000,
      urls: {
        // Original (no transformation)
        original: publicOriginalUrl,

        // Service method URL (uses current implementation)
        servicePrintUrl: printUrl,

        // Test URLs with 'fit' crop mode at different sizes
        upscaledWithFit: upscaledUrls,

        // Test URLs with 'scale' crop mode at different sizes
        upscaledWithScale: upscaledUrlsScale,
      },
      transformation: {
        needsUpscaling,
        originalSize: `${dimensions.width}x${dimensions.height}`,
        upscalingRatio: Math.round(5315 / Math.max(dimensions.width, dimensions.height) * 10) / 10,
        targetSize: '5315x5315 (fit) - 45cm @300dpi',
        estimatedResult: dimensions.width > dimensions.height
          ? `5315 x ${Math.round(5315 * dimensions.height / dimensions.width)}`
          : `${Math.round(5315 * dimensions.width / dimensions.height)} x 5315`,
        maxPrintSizes: {
          portrait: '30×45cm (3543×5315px)',
          landscape: '45×30cm (5315×3543px)',
          square: '40×40cm (4724×4724px)'
        }
      },
      testing: {
        instructions: 'Test each URL in browser to see which work',
        cropModes: {
          fit: 'Fits within bounds, maintains aspect ratio, allows upscaling',
          scale: 'Scales to exact dimensions, may distort, allows upscaling',
          limit: 'Limits to bounds, maintains aspect ratio, NO upscaling'
        },
        expectedBehavior: 'fit and scale should upscale, limit should not'
      },
      storedVariants: imageData.image_variants || null
    });

  } catch (error) {
    console.error('Test upscale error:', error);

    // Enhanced error logging for Cloudinary issues
    const errorDetails: any = {
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error?.constructor?.name,
    };

    // Capture additional Cloudinary-specific error info
    if (error && typeof error === 'object') {
      if ('http_code' in error) errorDetails.httpCode = error.http_code;
      if ('error' in error) errorDetails.cloudinaryError = error.error;
      if ('statusCode' in error) errorDetails.statusCode = error.statusCode;
    }

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
      errorDetails.stack = error.stack;
    }

    return NextResponse.json(errorDetails, { status: 500 });
  }
}
