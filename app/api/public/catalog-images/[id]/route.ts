import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CloudinaryImageService } from '@/lib/cloudinary';

// Use service role client to bypass RLS for public catalog data
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const cloudinaryService = new CloudinaryImageService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Catalog image ID is required' },
        { status: 400 }
      );
    }

    // Fetch catalog image with related metadata
    const { data: catalogImage, error } = await supabaseServiceRole
      .from('image_catalog')
      .select(`
        id,
        cloudinary_public_id,
        prompt_text,
        description,
        breed_id,
        theme_id,
        style_id,
        format_id,
        breed:breeds(
          id,
          name,
          display_name,
          animal_type
        ),
        theme:themes(
          id,
          name,
          display_name,
          base_prompt_template
        ),
        style:styles(
          id,
          name,
          display_name,
          prompt_suffix
        ),
        format:formats(
          id,
          name,
          aspect_ratio
        )
      `)
      .eq('id', id)
      .eq('is_public', true)
      .single();

    if (error) {
      console.error('Error fetching catalog image:', error);

      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Catalog image not found or not public' },
          { status: 404 }
        );
      }

      throw error;
    }

    // Generate Cloudinary URLs for different variants
    const imageUrl = catalogImage.cloudinary_public_id
      ? cloudinaryService.getPublicVariantUrl(catalogImage.cloudinary_public_id, 'full_size')
      : null;

    const thumbnailUrl = catalogImage.cloudinary_public_id
      ? cloudinaryService.getPublicVariantUrl(catalogImage.cloudinary_public_id, 'thumbnail')
      : null;

    // Format response
    const response = {
      id: catalogImage.id,
      cloudinaryPublicId: catalogImage.cloudinary_public_id,
      imageUrl,
      thumbnailUrl,
      prompt: catalogImage.prompt_text,
      description: catalogImage.description,
      breed: catalogImage.breed ? {
        id: catalogImage.breed.id,
        name: catalogImage.breed.name,
        displayName: catalogImage.breed.display_name,
        animalType: catalogImage.breed.animal_type
      } : null,
      theme: catalogImage.theme ? {
        id: catalogImage.theme.id,
        name: catalogImage.theme.name,
        displayName: catalogImage.theme.display_name
      } : null,
      style: catalogImage.style ? {
        id: catalogImage.style.id,
        name: catalogImage.style.name,
        displayName: catalogImage.style.display_name
      } : null,
      format: catalogImage.format ? {
        id: catalogImage.format.id,
        name: catalogImage.format.name,
        aspectRatio: catalogImage.format.aspect_ratio
      } : null
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Public catalog image API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch catalog image', details: error.message },
      { status: 500 }
    );
  }
}
