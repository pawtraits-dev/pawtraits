import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer email is required' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS for reading image data
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // First try to load from customer_generated_images
    const { data: generatedImage, error: genError } = await supabaseAdmin
      .from('customer_generated_images')
      .select(`
        *,
        breed:breeds(id, name, slug, animal_type),
        theme:themes(id, name, slug),
        style:styles(id, name, slug),
        coat:coats(id, name, slug),
        format:formats(id, name, slug),
        outfit:outfits(id, name, slug)
      `)
      .eq('id', id)
      .single();

    if (!genError && generatedImage) {
      // Map customer_generated_images structure to unified format
      const imageResult = {
        id: generatedImage.id,
        public_url: generatedImage.public_url,
        cloudinary_public_id: generatedImage.cloudinary_public_id,
        prompt_text: generatedImage.prompt_text,
        description: generatedImage.generation_metadata?.ai_description || generatedImage.prompt_text,
        breed_id: generatedImage.breed_id,
        coat_id: generatedImage.coat_id,
        theme_id: generatedImage.theme_id,
        style_id: generatedImage.style_id,
        format_id: generatedImage.format_id,
        outfit_id: generatedImage.outfit_id,
        breed_name: generatedImage.breed?.name,
        coat_name: generatedImage.coat?.name,
        theme_name: generatedImage.theme?.name,
        style_name: generatedImage.style?.name,
        format_name: generatedImage.format?.name,
        outfit_name: generatedImage.outfit?.name,
        breed: generatedImage.breed,
        theme: generatedImage.theme,
        style: generatedImage.style,
        coat: generatedImage.coat,
        format: generatedImage.format,
        outfit: generatedImage.outfit,
        created_at: generatedImage.created_at,
        is_active: true
      };

      return NextResponse.json({
        success: true,
        image: imageResult,
        source: 'generated'
      });
    }

    // Fallback to image_catalog
    const { data: catalogImage, error: catalogError } = await supabaseAdmin
      .from('image_catalog')
      .select(`
        *,
        breed:breeds(id, name, slug, animal_type),
        theme:themes(id, name, slug),
        style:styles(id, name, slug),
        coat:coats(id, name, slug),
        format:formats(id, name, slug)
      `)
      .eq('id', id)
      .single();

    if (catalogError || !catalogImage) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      image: catalogImage,
      source: 'catalog'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
