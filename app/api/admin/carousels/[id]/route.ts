import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Helper function to create Supabase client inside handlers to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const { id } = params;

    // Get carousel with its slides
    const [carouselResult, slidesResult] = await Promise.all([
      supabase
        .from('carousels')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('carousel_slides')
        .select('*')
        .eq('carousel_id', id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
    ]);

    if (carouselResult.error) throw carouselResult.error;
    if (slidesResult.error) throw slidesResult.error;

    return NextResponse.json({
      carousel: carouselResult.data,
      slides: slidesResult.data || []
    });
  } catch (error) {
    console.error('Error fetching carousel:', error);
    return NextResponse.json(
      { error: 'Failed to fetch carousel' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const { id } = params;
    const updates = await request.json();

    // If setting as active, deactivate other carousels for this page type
    if (updates.is_active) {
      // First get the current carousel to know its page_type
      const { data: currentCarousel } = await supabase
        .from('carousels')
        .select('page_type')
        .eq('id', id)
        .single();

      if (currentCarousel) {
        await supabase
          .from('carousels')
          .update({ is_active: false })
          .eq('page_type', currentCarousel.page_type)
          .eq('is_active', true)
          .neq('id', id);
      }
    }

    const { data, error } = await supabase
      .from('carousels')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating carousel:', error);
    return NextResponse.json(
      { error: 'Failed to update carousel' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const { id } = params;

    // Delete carousel (slides will be deleted automatically due to CASCADE)
    const { error } = await supabase
      .from('carousels')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting carousel:', error);
    return NextResponse.json(
      { error: 'Failed to delete carousel' },
      { status: 500 }
    );
  }
}