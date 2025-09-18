import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role client to bypass RLS for public breed data
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabaseServiceRole
      .from('breeds')
      .select('*')
      .order('popularity_rank', { ascending: true });

    if (error) {
      console.error('Error fetching public breeds:', error);
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Public breeds API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch breeds', details: error.message },
      { status: 500 }
    );
  }
}