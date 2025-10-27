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

    // Fetch customer generated images with AI descriptions and related data
    const { data: generatedImages, error } = await supabaseAdmin
      .from('customer_generated_images')
      .select(`
        id,
        cloudinary_public_id,
        public_url,
        prompt_text,
        generation_metadata,
        breed_id,
        theme_id,
        style_id,
        format_id,
        created_at,
        breeds(id, name, animal_type),
        themes(id, name)
      `)
      .eq('customer_id', userProfile.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching generated images:', error);
      return NextResponse.json({ error: 'Failed to fetch generated images' }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        images: generatedImages || []
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
