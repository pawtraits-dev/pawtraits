import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET /api/mugs/catalog/[slug]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { slug } = await params;

    const { data, error } = await supabase
      .from('mug_catalog')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Catalog entry not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching mug catalog entry:', error);
    return NextResponse.json({ error: 'Failed to fetch catalog entry' }, { status: 500 });
  }
}
