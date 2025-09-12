import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const carouselId = searchParams.get('carousel_id');

    if (!carouselId) {
      return NextResponse.json(
        { error: 'carousel_id parameter is required' },
        { status: 400 }
      );
    }

    // Get carousel content with full details
    const { data: content, error } = await supabaseAdmin
      .from('carousel_content_with_details')
      .select('*')
      .eq('carousel_id', carouselId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;

    // Also get available themes and breeds for the admin interface
    const [themesResult, breedsResult] = await Promise.all([
      supabaseAdmin.from('themes').select('*').eq('is_active', true).order('name'),
      supabaseAdmin.from('breeds').select('*').eq('is_active', true).order('name')
    ]);

    if (themesResult.error) throw themesResult.error;
    if (breedsResult.error) throw breedsResult.error;

    const dogBreeds = breedsResult.data?.filter(breed => breed.animal_type === 'dog') || [];
    const catBreeds = breedsResult.data?.filter(breed => breed.animal_type === 'cat') || [];

    return NextResponse.json({
      content: content || [],
      available_themes: themesResult.data || [],
      available_dog_breeds: dogBreeds,
      available_cat_breeds: catBreeds
    });
  } catch (error) {
    console.error('Error fetching carousel content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch carousel content' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { carousel_id, selected_themes, selected_dog_breeds, selected_cat_breeds } = body;

    if (!carousel_id) {
      return NextResponse.json(
        { error: 'carousel_id is required' },
        { status: 400 }
      );
    }

    // Start transaction: delete existing selections and insert new ones
    const { error: deleteError } = await supabaseAdmin
      .from('carousel_content_selections')
      .delete()
      .eq('carousel_id', carousel_id);

    if (deleteError) throw deleteError;

    // Prepare new selections
    const selections: any[] = [];
    let sortOrder = 0;

    // Add theme selections
    if (selected_themes && Array.isArray(selected_themes)) {
      for (const themeId of selected_themes) {
        selections.push({
          carousel_id,
          content_type: 'theme',
          content_id: themeId,
          sort_order: sortOrder++,
          is_active: true
        });
      }
    }

    // Add dog breed selections
    if (selected_dog_breeds && Array.isArray(selected_dog_breeds)) {
      for (const breedId of selected_dog_breeds) {
        selections.push({
          carousel_id,
          content_type: 'dog_breed',
          content_id: breedId,
          sort_order: sortOrder++,
          is_active: true
        });
      }
    }

    // Add cat breed selections
    if (selected_cat_breeds && Array.isArray(selected_cat_breeds)) {
      for (const breedId of selected_cat_breeds) {
        selections.push({
          carousel_id,
          content_type: 'cat_breed',
          content_id: breedId,
          sort_order: sortOrder++,
          is_active: true
        });
      }
    }

    // Insert new selections
    if (selections.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('carousel_content_selections')
        .insert(selections);

      if (insertError) throw insertError;
    }

    // Return updated content
    const { data: updatedContent, error: fetchError } = await supabaseAdmin
      .from('carousel_content_with_details')
      .select('*')
      .eq('carousel_id', carousel_id)
      .eq('is_active', true)
      .order('sort_order');

    if (fetchError) throw fetchError;

    return NextResponse.json({
      success: true,
      content: updatedContent || []
    });
  } catch (error) {
    console.error('Error updating carousel content:', error);
    return NextResponse.json(
      { error: 'Failed to update carousel content' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { selections } = body; // Array of {id, sort_order, is_active}

    if (!selections || !Array.isArray(selections)) {
      return NextResponse.json(
        { error: 'selections array is required' },
        { status: 400 }
      );
    }

    // Update each selection
    for (const selection of selections) {
      const { error } = await supabaseAdmin
        .from('carousel_content_selections')
        .update({
          sort_order: selection.sort_order,
          is_active: selection.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', selection.id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating carousel content order:', error);
    return NextResponse.json(
      { error: 'Failed to update carousel content order' },
      { status: 500 }
    );
  }
}