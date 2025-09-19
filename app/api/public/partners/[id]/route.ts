import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role client to bypass RLS for public partner data
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseServiceRole
      .from('partners')
      .select(`
        id,
        business_name,
        contact_name,
        status,
        created_at,
        is_active
      `)
      .eq('id', id)
      .eq('status', 'approved') // Only return approved partners for public access
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching public partner:', error);
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Partner not found or not approved' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Public partner API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner', details: error.message },
      { status: 500 }
    );
  }
}