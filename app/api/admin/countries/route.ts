import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const supportedOnly = searchParams.get('supportedOnly') !== 'false';

    let query = supabase
      .from('countries')
      .select('*')
      .order('display_order', { ascending: true });

    if (supportedOnly) {
      query = query.eq('is_supported', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);

  } catch (error) {
    console.error('Error getting countries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch countries' },
      { status: 500 }
    );
  }
}