import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role client to bypass RLS for public pricing data
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabaseServiceRole
      .from('product_pricing')
      .select('*, country:countries(*), product:products(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching public pricing:', error);
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Public pricing API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing', details: error.message },
      { status: 500 }
    );
  }
}