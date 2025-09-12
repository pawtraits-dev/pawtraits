import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageType = searchParams.get('page_type');

    if (!pageType) {
      return NextResponse.json(
        { error: 'page_type parameter is required' },
        { status: 400 }
      );
    }

    // Get active carousel for this page type
    const { data: carousels, error: carouselError } = await supabase
      .from('carousels')
      .select('*')
      .eq('page_type', pageType)
      .eq('is_active', true)
      .limit(1);

    if (carouselError) throw carouselError;

    if (!carousels || carousels.length === 0) {
      return NextResponse.json({
        carousel: null,
        content: []
      });
    }

    const carousel = carousels[0];

    // Get carousel content with full details
    const { data: content, error: contentError } = await supabase
      .from('carousel_content_with_details')
      .select('*')
      .eq('carousel_id', carousel.id)
      .eq('is_active', true)
      .order('sort_order');

    if (contentError) throw contentError;

    return NextResponse.json({
      carousel,
      content: content || []
    });
  } catch (error) {
    console.error('Error fetching public carousel content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch carousel content' },
      { status: 500 }
    );
  }
}