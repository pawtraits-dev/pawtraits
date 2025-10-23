import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/admin/customer-customization-credits
 * Returns list of all customer credit records with user profile information
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

    console.log('📊 Fetching customer customization credits...');

    // Get all customer credit records with user profile information
    const { data: credits, error: creditsError } = await supabaseAdmin
      .from('customer_customization_credits')
      .select(`
        *,
        user_profiles!inner (
          id,
          email,
          first_name,
          last_name,
          created_at
        )
      `)
      .order('updated_at', { ascending: false });

    if (creditsError) {
      console.error('Error fetching customer credits:', creditsError);
      return NextResponse.json({ error: 'Failed to fetch customer credits' }, { status: 500 });
    }

    console.log(`✅ Found ${credits?.length || 0} customer credit records`);

    return NextResponse.json(credits || []);

  } catch (error) {
    console.error('Admin customer credits API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch customer credits' },
      { status: 500 }
    );
  }
}
