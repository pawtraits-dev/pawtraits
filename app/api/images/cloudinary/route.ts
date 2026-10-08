import { NextRequest, NextResponse, after } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { autoTagNew } from '@/lib/collections/auto-tag';
import { SupabaseService } from '@/lib/supabase';
import { registerCloudinaryImage } from '@/lib/catalog/register-image';

const supabaseService = new SupabaseService();

interface PrintQualityResult {
  meetsRequirements: boolean;
  qualityLevel: 'Optimal' | 'Acceptable' | 'Below Minimum';
  dpi: 300 | 150;
  recommendedSize: string;
  maxSizeRecommendation: string;
  maxRequiredPixels: string;
}

/**
 * Validate image dimensions against Gelato print requirements
 * Based on updated gelato.md specifications supporting up to 60×40 cm
 */
function validateGelatoPrintQuality(width: number, height: number): PrintQualityResult {
  // Gelato print format requirements (300 DPI optimal)
  const formats300DPI = {
    // Square formats (1:1)
    square_20: { width: 2362, height: 2362, size: '20×20 cm' },
    square_30: { width: 3543, height: 3543, size: '30×30 cm' },
    square_40: { width: 4724, height: 4724, size: '40×40 cm' },
    
    // Rectangular formats (3:2 landscape)
    landscape_20x30: { width: 2362, height: 3543, size: '20×30 cm' },
    landscape_30x45: { width: 3543, height: 5315, size: '30×45 cm' },
    landscape_40x60: { width: 4724, height: 7087, size: '40×60 cm' },
    
    // Rectangular formats (2:3 portrait) 
    portrait_30x20: { width: 3543, height: 2362, size: '30×20 cm' },
    portrait_45x30: { width: 5315, height: 3543, size: '45×30 cm' },
    portrait_60x40: { width: 7087, height: 4724, size: '60×40 cm' }, // Largest format
  };

  // 150 DPI acceptable alternatives
  const formats150DPI = {
    square_20: { width: 1181, height: 1181, size: '20×20 cm' },
    square_30: { width: 1772, height: 1772, size: '30×30 cm' },
    square_40: { width: 2362, height: 2362, size: '40×40 cm' },
    landscape_20x30: { width: 1181, height: 1772, size: '20×30 cm' },
    landscape_30x45: { width: 1772, height: 2657, size: '30×45 cm' },
    landscape_40x60: { width: 2362, height: 3543, size: '40×60 cm' },
    portrait_30x20: { width: 1772, height: 1181, size: '30×20 cm' },
    portrait_45x30: { width: 2657, height: 1772, size: '45×30 cm' },
    portrait_60x40: { width: 3543, height: 2362, size: '60×40 cm' },
  };

  // Find the largest format this image can support at 300 DPI
  let bestFormat300 = null;
  let bestFormat150 = null;

  for (const [key, format] of Object.entries(formats300DPI)) {
    // Check if image meets minimum requirements (accounting for aspect ratio flexibility)
    const meetsWidth = width >= format.width || height >= format.width;
    const meetsHeight = height >= format.height || width >= format.height;
    
    if (meetsWidth && meetsHeight) {
      bestFormat300 = format;
    }
  }

  for (const [key, format] of Object.entries(formats150DPI)) {
    const meetsWidth = width >= format.width || height >= format.width;
    const meetsHeight = height >= format.height || width >= format.height;
    
    if (meetsWidth && meetsHeight) {
      bestFormat150 = format;
    }
  }

  // Determine result based on what format can be supported
  if (bestFormat300) {
    return {
      meetsRequirements: true,
      qualityLevel: 'Optimal',
      dpi: 300,
      recommendedSize: bestFormat300.size,
      maxSizeRecommendation: bestFormat300.size,
      maxRequiredPixels: `${formats300DPI.portrait_60x40.width}×${formats300DPI.portrait_60x40.height}px (60×40 cm max)`
    };
  } else if (bestFormat150) {
    return {
      meetsRequirements: true,
      qualityLevel: 'Acceptable',
      dpi: 150,
      recommendedSize: bestFormat150.size,
      maxSizeRecommendation: bestFormat150.size,
      maxRequiredPixels: `${formats300DPI.portrait_60x40.width}×${formats300DPI.portrait_60x40.height}px (60×40 cm optimal)`
    };
  } else {
    return {
      meetsRequirements: false,
      qualityLevel: 'Below Minimum',
      dpi: 150,
      recommendedSize: 'Not suitable for printing',
      maxSizeRecommendation: 'Up to 20×20 cm with quality loss',
      maxRequiredPixels: `${formats300DPI.portrait_60x40.width}×${formats300DPI.portrait_60x40.height}px (60×40 cm optimal)`
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const {
      cloudinary_public_id,
      cloudinary_secure_url,
      cloudinary_signature,
      original_filename,
      file_size,
      mime_type,
      width,
      height,
      prompt_text,
      description,
      tags,
      breed_id,
      theme_id,
      style_id,
      format_id,
      coat_id,
      rating,
      is_featured,
      is_public
    } = data;

    if (!cloudinary_public_id || !cloudinary_secure_url) {
      return NextResponse.json(
        { error: 'Missing required Cloudinary data' },
        { status: 400 }
      );
    }

    console.log(`💾 Saving metadata for Cloudinary image: ${cloudinary_public_id}`);
    console.log(`   Dimensions: ${width}×${height}px (${(file_size / 1024 / 1024).toFixed(2)}MB)`);
    
    // Validate print quality using updated gelato.md requirements
    const printQuality = validateGelatoPrintQuality(width, height);
    
    if (printQuality.meetsRequirements) {
      console.log(`✅ Image meets Gelato print quality requirements (${printQuality.recommendedSize})`);
      console.log(`   Quality level: ${printQuality.qualityLevel} (${printQuality.dpi} DPI)`);
    } else {
      console.warn(`⚠️ Image may not meet optimal print quality requirements`);
      console.warn(`   Current: ${width}×${height}px`);
      console.warn(`   Maximum recommended: ${printQuality.maxSizeRecommendation}`);
    }

    // Variant URLs, id checks and the image_catalog insert (shared with variation saves)
    const savedImage = await registerCloudinaryImage(supabaseService.getClient(), {
      cloudinary_public_id, cloudinary_secure_url, original_filename, file_size, mime_type,
      prompt_text, description, tags, breed_id, theme_id, style_id, format_id, coat_id,
      rating, is_featured, is_public,
    });
    
    console.log(`✅ Image catalog entry created: ID ${savedImage.id}`);
    after(() => autoTagNew(serviceClient(), savedImage.id));
    console.log(`   Print-ready URL: ${cloudinary_secure_url}`);

    return NextResponse.json({
      ...savedImage,
      print_quality: {
        width,
        height,
        meets_gelato_requirements: printQuality.meetsRequirements,
        quality_level: printQuality.qualityLevel,
        dpi: printQuality.dpi,
        recommended_size: printQuality.recommendedSize,
        max_format_supported: printQuality.maxSizeRecommendation,
        largest_format_pixels: printQuality.maxRequiredPixels
      }
    });

  } catch (error) {
    console.error('❌ Error saving Cloudinary image metadata:', error);
    console.error('   Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.split('\n')[0] : 'No stack'
    });
    return NextResponse.json(
      { error: `Failed to save image metadata: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}