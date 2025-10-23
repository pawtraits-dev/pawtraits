import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/admin/credit-packs
 * Returns all credit pack configurations for admin management
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

    // Fetch all credit packs
    const { data: packs, error: packsError } = await supabaseAdmin
      .from('customer_credit_pack_config')
      .select('*')
      .order('display_order', { ascending: true });

    if (packsError) {
      console.error('Error fetching credit packs:', packsError);
      return NextResponse.json({ error: 'Failed to fetch credit packs' }, { status: 500 });
    }

    return NextResponse.json(packs || []);

  } catch (error) {
    console.error('Admin credit packs API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch credit packs' },
      { status: 500 }
    );
  }
}
