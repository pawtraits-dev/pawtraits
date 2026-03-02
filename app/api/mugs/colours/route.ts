import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET /api/mugs/colours — all active mug colours
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await supabase
      .from('mug_colours')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);

  } catch (error) {
    console.error('Error fetching mug colours:', error);
    return NextResponse.json({ error: 'Failed to fetch mug colours' }, { status: 500 });
  }
}
