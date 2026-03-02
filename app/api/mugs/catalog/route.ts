import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET /api/mugs/catalog?type=zodiac&animal=dog
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const animal = searchParams.get('animal');

    let query = supabase
      .from('mug_catalog')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (type) query = query.eq('type', type);
    if (animal) query = query.or(`animal_type.eq.${animal},animal_type.eq.both`);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);

  } catch (error) {
    console.error('Error fetching mug catalog:', error);
    return NextResponse.json({ error: 'Failed to fetch mug catalog' }, { status: 500 });
  }
}
