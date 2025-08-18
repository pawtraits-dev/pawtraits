import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import { generateImageMetadata, extractColorTags } from '@/lib/metadata-generator';
import { cloudinaryService } from '@/lib/cloudinary';
import type { ImageCatalogCreate } from '@/lib/types';

const supabaseService = new SupabaseService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const breedId = searchParams.get('breed_id');
    const themeId = searchParams.get('theme_id');
    const styleId = searchParams.get('style_id');
    const formatId = searchParams.get('format_id');
    const tags = searchParams.get('tags');
    const featured = searchParams.get('featured');
    const publicOnly = searchParams.get('public') !== 'false'; // Default to public only

    const images = await supabaseService.getImages({
      page,
      limit,
      breedId,
      themeId,
      styleId,
      formatId,
      tags: tags?.split(','),
      featured: featured === 'true',
      publicOnly
    });

    // Return in the expected format for public pages
    return NextResponse.json({
      images: images,
      total_count: images.length,
      current_page: page,
      total_pages: Math.ceil(images.length / limit)
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const promptText = formData.get('prompt_text') as string;
    const description = formData.get('description') as string || '';
    const tags = JSON.parse(formData.get('tags') as string || '[]');
    const breedId = formData.get('breed_id') as string || '';
    const themeId = formData.get('theme_id') as string || '';
    const styleId = formData.get('style_id') as string || '';
    const formatId = formData.get('format_id') as string || '';
    const coatId = formData.get('coat_id') as string || '';
    const aiModel = formData.get('ai_model') as string || '';
    const generationParameters = formData.get('generation_parameters') as string || '{}';
    const rating = parseInt(formData.get('rating') as string || '0');
    const isFeatured = formData.get('is_featured') === 'true';
    const isPublic = formData.get('is_public') !== 'false'; // Default to public

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!promptText) {
      return NextResponse.json(
        { error: 'Prompt text is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (50MB limit - Cloudinary can handle larger files than Supabase)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum 50MB allowed.' },
        { status: 400 }
      );
    }

    // Get entity data for metadata generation and validate existence
    let breed = null, theme = null, style = null, format = null, coat = null;
    let validBreedId = null, validThemeId = null, validStyleId = null, validFormatId = null, validCoatId = null;
    
    // Validate and fetch entities, only keep IDs if entities exist
    if (breedId && breedId.trim() !== '') {
      try {
        breed = await supabaseService.getBreed(breedId);
        validBreedId = breedId; // Only set if fetch succeeded
      } catch (error) {
        console.warn('Breed not found:', breedId);
      }
    }
    
    if (themeId && themeId.trim() !== '') {
      try {
        theme = await supabaseService.getTheme(themeId);
        validThemeId = themeId;
      } catch (error) {
        console.warn('Theme not found:', themeId);
      }
    }
    
    if (styleId && styleId.trim() !== '') {
      try {
        style = await supabaseService.getStyle(styleId);
        validStyleId = styleId;
      } catch (error) {
        console.warn('Style not found:', styleId);
      }
    }
    
    if (formatId && formatId.trim() !== '') {
      try {
        format = await supabaseService.getFormat(formatId);
        validFormatId = formatId;
      } catch (error) {
        console.warn('Format not found:', formatId);
      }
    }
    
    if (coatId && coatId.trim() !== '') {
      try {
        coat = await supabaseService.getCoat(coatId);
        validCoatId = coatId;
      } catch (error) {
        console.warn('Coat not found:', coatId);
      }
    }

    // Generate metadata if not provided
    let finalDescription = description;
    let finalTags = tags;
    
    if (!description || tags.length === 0) {
      const generated = generateImageMetadata({
        promptText,
        breed: breed || undefined,
        theme: theme || undefined,
        style: style || undefined,
        format: format || undefined,
        coat: coat ? {
          name: coat.name,
          pattern_type: coat.pattern_type,
          rarity: coat.rarity
        } : undefined
      });
      
      if (!description) finalDescription = generated.description;
      if (tags.length === 0) {
        finalTags = generated.tags;
        
        // Add color tags if coat has color info
        if (coat?.hex_color) {
          const colorTags = extractColorTags(coat.hex_color);
          finalTags = [...finalTags, ...colorTags];
        }
        
        // Remove duplicates
        finalTags = Array.from(new Set(finalTags));
      }
    }

    // Upload to Cloudinary with full resolution (no compression)
    console.log(`🔄 Uploading ${file.name} to Cloudinary (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    
    const imageBuffer = Buffer.from(await file.arrayBuffer());
    
    // Prepare metadata for Cloudinary
    const cloudinaryMetadata = {
      breed: breed?.name || 'unknown',
      theme: theme?.name || 'portrait', 
      style: style?.name || 'professional',
      partnerId: undefined, // This is admin upload, not partner
      imageId: undefined
    };
    
    let cloudinaryResult;
    try {
      cloudinaryResult = await cloudinaryService.uploadAndProcessImage(
        imageBuffer,
        file.name,
        cloudinaryMetadata
      );
      console.log(`✅ Cloudinary upload successful: ${cloudinaryResult.public_id}`);
    } catch (error) {
      console.error('❌ Cloudinary upload failed:', error);
      return NextResponse.json(
        { error: `Failed to upload image to Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Create image catalog entry with Cloudinary data
    const imageData: ImageCatalogCreate = {
      filename: `${cloudinaryResult.public_id}.${file.name.split('.').pop()}`, // Use Cloudinary public_id as filename
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: `cloudinary:${cloudinaryResult.public_id}`, // Mark as Cloudinary storage
      public_url: cloudinaryResult.variants.mid_size.url, // Use mid_size variant for public display
      prompt_text: promptText,
      description: finalDescription,
      tags: finalTags,
      breed_id: validBreedId || undefined,
      theme_id: validThemeId || undefined,
      style_id: validStyleId || undefined,
      format_id: validFormatId || undefined,
      coat_id: validCoatId || undefined,
      ai_model: aiModel || undefined,
      generation_parameters: JSON.parse(generationParameters),
      rating: rating > 0 ? rating : undefined,
      is_featured: isFeatured,
      is_public: isPublic,
      cloudinary_public_id: cloudinaryResult.public_id,
      image_variants: cloudinaryResult.variants
    };

    const savedImage = await supabaseService.createImage(imageData);

    return NextResponse.json(savedImage);
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}