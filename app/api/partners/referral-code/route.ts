import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Use service role key to fetch partner data
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Fetch partner's personal referral code
    const { data: partner, error } = await supabaseAdmin
      .from('partners')
      .select('id, personal_referral_code')
      .eq('email', user.email)
      .single();

    if (error || !partner) {
      console.error('Failed to fetch partner referral code:', error);
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (!partner.personal_referral_code) {
      return NextResponse.json({ error: 'No referral code found for partner' }, { status: 404 });
    }

    // Return code and share URL
    return NextResponse.json({
      code: partner.personal_referral_code,
      share_url: `/p/${partner.personal_referral_code}`
    });

  } catch (error) {
    console.error('Partner referral code API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
