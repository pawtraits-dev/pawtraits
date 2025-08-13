import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import { cloudinaryService } from '@/lib/cloudinary';
import type { ImageCatalogCreate } from '@/lib/types';

const supabaseService = new SupabaseService();

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
    
    // Validate print quality
    const minPixelsFor40cm = 4724; // 40×40 cm at 300 DPI per gelato.md
    const meetsPrintQuality = width >= minPixelsFor40cm && height >= minPixelsFor40cm;
    
    if (meetsPrintQuality) {
      console.log('✅ Image meets Gelato print quality requirements (300 DPI for 40×40 cm)');
    } else {
      console.warn(`⚠️ Image may not meet optimal print quality requirements`);
      console.warn(`   Current: ${width}×${height}px, Recommended: ${minPixelsFor40cm}×${minPixelsFor40cm}px`);
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
        meets_gelato_requirements: meetsPrintQuality,
        recommended_for_size: meetsPrintQuality ? '40×40 cm' : '20×20 cm'
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