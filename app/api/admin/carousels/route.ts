import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CarouselManagementView, CarouselFormData } from '@/lib/carousel-types';

// Helper function to create Supabase client inside handlers to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('carousel_management_view')
      .select('*')
      .order('page_type', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      carousels: data || [],
      total: data?.length || 0
    });
  } catch (error) {
    console.error('Error fetching carousels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch carousels' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body: CarouselFormData = await request.json();

    // Validate required fields
    if (!body.name || !body.page_type) {
      return NextResponse.json(
        { error: 'Name and page type are required' },
        { status: 400 }
      );
    }

    // If setting as active, deactivate other carousels for this page type
    if (body.is_active) {
      await supabase
        .from('carousels')
        .update({ is_active: false })
        .eq('page_type', body.page_type)
        .eq('is_active', true);
    }

    const { data, error } = await supabase
      .from('carousels')
      .insert([{
        name: body.name,
        page_type: body.page_type,
        description: body.description,
        auto_play_interval: body.auto_play_interval || 6000,
        show_thumbnails: body.show_thumbnails !== false,
        is_active: body.is_active !== false
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating carousel:', error);
    return NextResponse.json(
      { error: 'Failed to create carousel' },
      { status: 500 }
    );
  }
}