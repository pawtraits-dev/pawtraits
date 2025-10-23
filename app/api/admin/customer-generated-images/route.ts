import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/admin/customer-generated-images
 * Returns list of all customer-generated images with user profile information
 *
 * Query parameters:
 * - limit: number of records to return (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify admin access
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('user_type')
      .eq('email', user.email)
      .single();

    if (!userProfile || userProfile.user_type !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get limit from query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    console.log('🖼️  Fetching customer generated images...');

    // Get generated images with user profile information
    const { data: images, error: imagesError } = await supabaseAdmin
      .from('customer_generated_images')
      .select(`
        *,
        user_profiles!inner (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (imagesError) {
      console.error('Error fetching generated images:', imagesError);
      return NextResponse.json({ error: 'Failed to fetch generated images' }, { status: 500 });
    }

    console.log(`✅ Found ${images?.length || 0} generated images`);

    return NextResponse.json(images || []);

  } catch (error) {
    console.error('Admin generated images API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch generated images' },
      { status: 500 }
    );
  }
}
