import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PageType } from '@/lib/carousel-types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { pageType: string } }
) {
  try {
    const { pageType } = params;

    // Validate page type
    const validPageTypes: PageType[] = ['home', 'dogs', 'cats', 'themes'];
    if (!validPageTypes.includes(pageType as PageType)) {
      return NextResponse.json(
        { error: 'Invalid page type' },
        { status: 400 }
      );
    }

    // Get active carousel for this page type
    const { data: carousel, error: carouselError } = await supabase
      .from('carousels')
      .select('*')
      .eq('page_type', pageType)
      .eq('is_active', true)
      .single();

    if (carouselError) {
      // If no carousel found, return empty result
      if (carouselError.code === 'PGRST116') {
        return NextResponse.json({
          carousel: null,
          slides: []
        });
      }
      throw carouselError;
    }

    // Get active slides for this carousel
    const { data: slides, error: slidesError } = await supabase
      .from('carousel_slides')
      .select('*')
      .eq('carousel_id', carousel.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (slidesError) throw slidesError;

    return NextResponse.json({
      carousel,
      slides: slides || []
    });
  } catch (error) {
    console.error('Error fetching carousel:', error);
    return NextResponse.json(
      { error: 'Failed to fetch carousel' },
      { status: 500 }
    );
  }
}