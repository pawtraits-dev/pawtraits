import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`\n🔍 [${timestamp}] AUTH CHECK START`);

  try {
    const cookieStore = await cookies();

    // Log all cookies for debugging
    const allCookies = cookieStore.getAll();
    console.log(`📋 [${timestamp}] Total cookies found: ${allCookies.length}`);

    const supabaseCookies = allCookies.filter(c => c.name.startsWith('sb-'));
    console.log(`🍪 [${timestamp}] Supabase cookies found: ${supabaseCookies.length}`);
    supabaseCookies.forEach(cookie => {
      console.log(`  - ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
    });

    // Create Supabase route handler client
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    console.log(`⚡ [${timestamp}] Calling supabase.auth.getUser()`);
    // Get current user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log(`👤 [${timestamp}] Auth result:`, {
      user: user ? { id: user.id, email: user.email } : null,
      error: authError ? authError.message : null
    });

    if (authError || !user) {
      console.log(`❌ [${timestamp}] No authenticated user found`);
      const response = {
        isAuthenticated: false,
        user: null
      };
      console.log(`📤 [${timestamp}] Returning:`, response);
      return NextResponse.json(response);
    }

    console.log(`✅ [${timestamp}] User authenticated, fetching profile...`);

    // Try to get basic user profile using service role
    const { createClient } = await import('@supabase/supabase-js');
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      const { data: profile, error: profileError } = await serviceRoleSupabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.log(`⚠️ [${timestamp}] Profile fetch error:`, profileError.message);
      } else {
        console.log(`🎯 [${timestamp}] Profile loaded:`, {
          user_type: profile?.user_type,
          first_name: profile?.first_name
        });
      }

      // Fetch additional user-type specific data
      let additionalData: any = {};

      if (profile?.user_type === 'customer' && profile?.customer_id) {
        const { data: customer } = await serviceRoleSupabase
          .from('customers')
          .select('personal_referral_code, personal_qr_code_url, referral_code_used, referral_type')
          .eq('id', profile.customer_id)
          .single();

        if (customer) {
          additionalData.customer_referral = {
            code: customer.personal_referral_code,
            share_url: customer.personal_referral_code ? `/c/${customer.personal_referral_code}` : null,
            qr_code_url: customer.personal_qr_code_url,
            referral_code_used: customer.referral_code_used,
            referral_type: customer.referral_type
          };
        }
      } else if (profile?.user_type === 'partner' && profile?.partner_id) {
        const { data: partner } = await serviceRoleSupabase
          .from('partners')
          .select('personal_referral_code, personal_qr_code_url')
          .eq('id', profile.partner_id)
          .single();

        if (partner) {
          additionalData.partner_referral = {
            code: partner.personal_referral_code,
            share_url: partner.personal_referral_code ? `/p/${partner.personal_referral_code}` : null,
            qr_code_url: partner.personal_qr_code_url
          };
        }
      }

      const response = {
        isAuthenticated: true,
        user: {
          id: user.id,
          email: user.email,
          ...profile,
          ...additionalData,
          // Ensure user_type defaults to customer if not set
          user_type: profile?.user_type || 'customer'
        }
      };
      return NextResponse.json(response);
    } catch (profileError) {
      console.log(`🚨 [${timestamp}] Profile fetch exception:`, profileError);

      // Return basic auth info even if profile fails
      const response = {
        isAuthenticated: true,
        user: {
          id: user.id,
          email: user.email
        }
      };
      console.log(`📤 [${timestamp}] Returning without profile:`, response);
      return NextResponse.json(response);
    }

  } catch (error) {
    console.error(`💥 [${timestamp}] Auth check exception:`, error);
    const response = {
      isAuthenticated: false,
      user: null
    };
    console.log(`📤 [${timestamp}] Returning error response:`, response);
    return NextResponse.json(response);
  }
}