import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { imageIds } = await request.json();

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json(
        { error: 'Image IDs array is required' },
        { status: 400 }
      );
    }

    console.log('Image catalog API: Fetching data for', imageIds.length, 'images');

    const supabaseService = new SupabaseService();

    // Use the same query structure as the browse page
    const { data: images, error } = await supabaseService.getClient()
      .from('image_catalog')
      .select(`
        *,
        breeds(id, name, slug, animal_type),
        themes(id, name),
        styles(id, name),
        formats(id, name),
        coats(id, name, hex_color, animal_type)
      `)
      .in('id', imageIds);

    if (error) {
      console.error('Error fetching image catalog data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch image catalog data' },
        { status: 500 }
      );
    }

    console.log('Image catalog API: Found', images?.length || 0, 'images');

    return NextResponse.json(images || []);

  } catch (error) {
    console.error('Error in image catalog API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}