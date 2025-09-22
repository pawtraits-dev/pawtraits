import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const body = await request.json();
    const { code, partner_id, partner_email } = body;

    if (!code || !partner_id || !partner_email) {
      return NextResponse.json({ error: 'Code, partner ID, and email are required' }, { status: 400 });
    }

    // Mark pre-registration code as used using database function
    const { data, error } = await supabase.rpc('convert_pre_registration_code', {
      p_code: code,
      p_partner_id: partner_id,
      p_partner_email: partner_email
    });

    if (error) {
      console.error('Failed to convert pre-registration code:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Code not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to convert code' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Pre-registration code converted successfully',
      conversion_id: data?.[0]?.id || null
    });
  } catch (error) {
    console.error('Pre-registration code conversion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}