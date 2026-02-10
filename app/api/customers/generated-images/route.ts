// API endpoint for fetching customer generated images
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Use service role client for database operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user profile to verify customer_id
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, user_type')
      .eq('user_id', user.id)
      .single();

    if (!userProfile || userProfile.user_type !== 'customer') {
      return NextResponse.json({ error: 'Customer account required' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get customer record
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    // Fetch customer custom images (generated via /customise page)
    const { data: generatedImages, error } = await supabaseAdmin
      .from('customer_custom_images')
      .select(`
        id,
        generated_cloudinary_id,
        generated_image_url,
        generation_prompt,
        generation_metadata,
        pet_breed_id,
        rating,
        created_at,
        generated_at,
        metadata
      `)
      .eq('customer_id', customer.id)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching generated images:', error);
      return NextResponse.json({ error: 'Failed to fetch generated images' }, { status: 500 });
    }

    // Transform to match gallery expected format
    const transformedImages = (generatedImages || []).map((img: any) => ({
      id: img.id,
      cloudinary_public_id: img.generated_cloudinary_id,
      public_url: img.generated_image_url,
      prompt_text: img.generation_prompt,
      generation_metadata: {
        ...img.generation_metadata,
        ai_description: img.metadata?.catalog_theme && img.metadata?.catalog_style
          ? `Custom ${img.metadata.catalog_theme} ${img.metadata.catalog_style} portrait`
          : 'Custom portrait'
      },
      breed_id: img.pet_breed_id,
      theme_id: img.generation_metadata?.catalog_theme_id,
      style_id: img.generation_metadata?.catalog_style_id,
      format_id: null,
      rating: img.rating,
      created_at: img.created_at || img.generated_at,
      breeds: img.pet_breed_id ? { id: img.pet_breed_id, name: img.metadata?.catalog_breed || 'Pet' } : null,
      themes: img.metadata?.catalog_theme ? { id: null, name: img.metadata.catalog_theme } : null
    }));

    return NextResponse.json(
      {
        success: true,
        images: transformedImages
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=30'
        }
      }
    );

  } catch (error) {
    console.error('Unexpected error fetching generated images:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
