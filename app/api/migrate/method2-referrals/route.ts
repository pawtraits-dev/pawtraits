import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: NextRequest) {
  try {
    console.log('Starting Method 2 referral functions migration...');

    // Function 1: update_method2_referral_customer
    const updateMethod2Function = `
      CREATE OR REPLACE FUNCTION update_method2_referral_customer(
          p_referral_code TEXT,
          p_customer_email TEXT,
          p_customer_name TEXT,
          p_customer_phone TEXT DEFAULT NULL
      )
      RETURNS referrals
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
          updated_referral referrals;
      BEGIN
          -- Update Method 2 referrals (image_share type) with actual customer details
          UPDATE public.referrals 
          SET 
              client_email = LOWER(p_customer_email),
              client_name = p_customer_name,
              client_phone = p_customer_phone,
              status = CASE 
                  WHEN status IN ('invited', 'accessed') THEN 'accepted'
                  ELSE status -- Don't change if already applied
              END,
              updated_at = NOW()
          WHERE referral_code = UPPER(p_referral_code)
          AND referral_type = 'image_share'
          AND expires_at > NOW()
          AND (client_email IS NULL OR client_email = '')
          RETURNING * INTO updated_referral;
          
          RETURN updated_referral;
      END;
      $$;
    `;

    // Function 2: mark_referral_accepted_enhanced
    const enhancedAcceptedFunction = `
      CREATE OR REPLACE FUNCTION mark_referral_accepted_enhanced(
          p_referral_code TEXT, 
          p_customer_email TEXT,
          p_customer_name TEXT DEFAULT NULL,
          p_customer_phone TEXT DEFAULT NULL
      )
      RETURNS referrals
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
          updated_referral referrals;
          referral_type_check TEXT;
      BEGIN
          -- First, check the referral type
          SELECT referral_type INTO referral_type_check
          FROM public.referrals 
          WHERE referral_code = UPPER(p_referral_code)
          AND expires_at > NOW();
          
          IF referral_type_check = 'image_share' THEN
              -- Method 2: Update with customer details (client_email might be empty)
              UPDATE public.referrals 
              SET 
                  client_email = LOWER(p_customer_email),
                  client_name = COALESCE(p_customer_name, client_name),
                  client_phone = COALESCE(p_customer_phone, client_phone),
                  status = CASE 
                      WHEN status IN ('invited', 'accessed') THEN 'accepted'
                      ELSE status
                  END,
                  updated_at = NOW()
              WHERE referral_code = UPPER(p_referral_code)
              AND expires_at > NOW()
              RETURNING * INTO updated_referral;
          ELSE
              -- Method 1: Original logic requiring email match
              UPDATE public.referrals 
              SET 
                  status = CASE 
                      WHEN status IN ('invited', 'accessed') THEN 'accepted'
                      ELSE status
                  END,
                  updated_at = NOW()
              WHERE referral_code = UPPER(p_referral_code)
              AND client_email = LOWER(p_customer_email)
              AND expires_at > NOW()
              RETURNING * INTO updated_referral;
          END IF;
          
          RETURN updated_referral;
      END;
      $$;
    `;

    // Execute the functions
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql: updateMethod2Function
    });

    if (error1) {
      // Try direct execution if exec_sql doesn't exist
      const { error: directError1 } = await supabase.sql`${updateMethod2Function}`;
      if (directError1) {
        console.error('Error creating update_method2_referral_customer function:', directError1);
        throw directError1;
      }
    }

    const { error: error2 } = await supabase.rpc('exec_sql', {
      sql: enhancedAcceptedFunction
    });

    if (error2) {
      // Try direct execution if exec_sql doesn't exist
      const { error: directError2 } = await supabase.sql`${enhancedAcceptedFunction}`;
      if (directError2) {
        console.error('Error creating mark_referral_accepted_enhanced function:', directError2);
        throw directError2;
      }
    }

    // Grant permissions
    const permissions = [
      'GRANT EXECUTE ON FUNCTION update_method2_referral_customer TO anon',
      'GRANT EXECUTE ON FUNCTION update_method2_referral_customer TO authenticated',
      'GRANT EXECUTE ON FUNCTION mark_referral_accepted_enhanced TO anon',
      'GRANT EXECUTE ON FUNCTION mark_referral_accepted_enhanced TO authenticated'
    ];

    for (const permission of permissions) {
      const { error } = await supabase.rpc('exec_sql', { sql: permission });
      if (error) {
        const { error: directError } = await supabase.sql`${permission}`;
        if (directError) {
          console.warn('Warning: Could not grant permission:', permission, directError);
        }
      }
    }

    console.log('✅ Method 2 referral functions migration completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Method 2 referral functions created successfully',
      functions: [
        'update_method2_referral_customer',
        'mark_referral_accepted_enhanced'
      ]
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json(
      { 
        error: 'Migration failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}