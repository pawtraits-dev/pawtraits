import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: { email: string } }
) {
  try {
    // Use service role key for partner lookup
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { email } = params;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Decode the email from URL encoding
    const decodedEmail = decodeURIComponent(email);

    // Get partner by email including commission rates
    const { data: partner, error } = await supabase
      .from('partners')
      .select('id, email, first_name, last_name, business_name, business_type, commission_rate, lifetime_commission_rate')
      .eq('email', decodedEmail)
      .eq('is_active', true)
      .eq('is_verified', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
      }
      console.error('Failed to fetch partner:', error);
      return NextResponse.json({ error: 'Failed to fetch partner' }, { status: 500 });
    }

    return NextResponse.json(partner);
  } catch (error) {
    console.error('Partner lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}