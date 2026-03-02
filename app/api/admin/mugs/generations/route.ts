import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET /api/admin/mugs/generations?status=complete&type=zodiac&startDate=2024-01-01&endDate=2024-12-31
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('mug_generations')
      .select(`
        *,
        mug_catalog:mug_catalog_id ( id, type, slug, name ),
        mug_colour:mug_colour_id ( id, name, slug, hex, overlay_hex ),
        user_profile:customer_id ( id, email, first_name, last_name )
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate + 'T23:59:59Z');

    const { data, error } = await query;
    if (error) throw error;

    // Filter by catalog type after join if provided
    const filtered = type
      ? (data || []).filter((g: any) => g.mug_catalog?.type === type)
      : (data || []);

    return NextResponse.json(filtered);

  } catch (error) {
    console.error('Error getting mug generations:', error);
    return NextResponse.json({ error: 'Failed to fetch mug generations' }, { status: 500 });
  }
}
