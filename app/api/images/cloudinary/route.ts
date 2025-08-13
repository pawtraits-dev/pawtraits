import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import { cloudinaryService } from '@/lib/cloudinary';
import type { ImageCatalogCreate } from '@/lib/types';

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

    // Generate image variant URLs using Cloudinary service
    let imageVariants;
    try {
      imageVariants = {
        // Original image at full resolution (300 DPI for print)
        original: {
          url: cloudinary_secure_url, // Use the direct secure URL for original
          access_type: 'print_fulfillment_only',
          dpi: 300,
          overlay: 'none',
          description: 'For printing'
        },
        // Public variants with different sizes
        full_size: {
          url: cloudinaryService.getPublicVariantUrl(cloudinary_public_id, 'full_size'),
          access_type: 'public',
          overlay: 'watermark_center',
          description: 'Detail page / modal'
        },
        thumbnail: {
          url: cloudinaryService.getPublicVariantUrl(cloudinary_public_id, 'thumbnail'),
          access_type: 'public',
          size: 'small',
          overlay: 'none',
          description: 'In rows or carts'
        },
        mid_size: {
          url: cloudinaryService.getPublicVariantUrl(cloudinary_public_id, 'mid_size'),
          access_type: 'public',
          size: 'medium',
          overlay: 'none',
          description: 'Shop / catalog cards'
        }
      };
      
      console.log(`✅ Generated ${Object.keys(imageVariants).length} image variants for print fulfillment`);
      
    } catch (variantError) {
      console.error('❌ Failed to generate image variants:', variantError);
      // Fallback variants using direct URLs
      imageVariants = {
        original: { url: cloudinary_secure_url, access_type: 'print_fulfillment_only' },
        public: { url: cloudinary_secure_url, access_type: 'public' }
      };
    }

    // Create image catalog entry
    const imageData: ImageCatalogCreate = {
      filename: `${cloudinary_public_id}.${original_filename.split('.').pop()}`,
      original_filename,
      file_size,
      mime_type,
      storage_path: `cloudinary:${cloudinary_public_id}`,
      public_url: imageVariants.mid_size?.url || cloudinary_secure_url,
      prompt_text,
      description: description || '',
      tags: Array.isArray(tags) ? tags : [],
      breed_id: breed_id || undefined,
      theme_id: theme_id || undefined,
      style_id: style_id || undefined,
      format_id: format_id || undefined,
      coat_id: coat_id || undefined,
      rating: rating || undefined,
      is_featured: is_featured || false,
      is_public: is_public !== false, // Default to true
      cloudinary_public_id,
      image_variants: imageVariants
    };

    const savedImage = await supabaseService.createImage(imageData);
    
    console.log(`✅ Image catalog entry created: ID ${savedImage.id}`);
    console.log(`   Print-ready URL: ${imageVariants.original?.url || 'N/A'}`);

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
    return NextResponse.json(
      { error: `Failed to save image metadata: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}