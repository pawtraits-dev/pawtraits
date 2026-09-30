import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withFormatIds } from '@/lib/products/catalogue';

// Use service role client to bypass RLS for public product data
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabaseServiceRole
      .from('products')
      .select(`
        *,
        medium:media(*),
        format:formats(*)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching public products:', error);
      throw error;
    }

    // format_ids: the formats each product is offered on (shape families span portrait + landscape)
    return NextResponse.json(await withFormatIds(supabaseServiceRole, [...(data || [])].sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))));
  } catch (error: any) {
    console.error('Public products API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error.message },
      { status: 500 }
    );
  }
}