import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/qr/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET /api/admin/mugs/colours?activeOnly=false
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let query = supabase.from('mug_colours').select('*').order('sort_order', { ascending: true });
    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);

  } catch (error) {
    console.error('Error getting mug colours:', error);
    return NextResponse.json({ error: 'Failed to fetch mug colours' }, { status: 500 });
  }
}

// PATCH /api/admin/mugs/colours — toggle is_active only
export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json();
    const { id, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('mug_colours')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error updating mug colour:', error);
    return NextResponse.json({ error: 'Failed to update mug colour' }, { status: 500 });
  }
}
