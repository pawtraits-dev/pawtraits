import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CarouselSlideFormData } from '@/lib/carousel-types';

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client inside handler to avoid build-time errors
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body: CarouselSlideFormData = await request.json();
    console.log('Creating carousel slide with data:', JSON.stringify(body, null, 2));

    // Validate required fields
    if (!body.carousel_id || !body.image_url) {
      console.error('Validation failed - missing required fields:', {
        carousel_id: body.carousel_id,
        image_url: body.image_url
      });
      return NextResponse.json(
        { 
          error: 'Carousel ID and image URL are required',
          received: {
            carousel_id: !!body.carousel_id,
            image_url: !!body.image_url
          }
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('carousel_slides')
      .insert([{
        carousel_id: body.carousel_id,
        image_url: body.image_url,
        image_alt: body.image_alt,
        cloudinary_public_id: body.cloudinary_public_id,
        title: body.title,
        subtitle: body.subtitle,
        description: body.description,
        cta_text: body.cta_text,
        cta_url: body.cta_url,
        cta_style: body.cta_style || 'primary',
        text_position: body.text_position || 'center',
        text_color: body.text_color || 'white',
        show_overlay: body.show_overlay !== false,
        overlay_opacity: body.overlay_opacity || 40,
        sort_order: body.sort_order || 0,
        is_active: body.is_active !== false
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating carousel slide:', error);
    return NextResponse.json(
      { error: 'Failed to create carousel slide' },
      { status: 500 }
    );
  }
}