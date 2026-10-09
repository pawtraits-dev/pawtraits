import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/qr/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// GET /api/admin/mugs/catalog?activeOnly=false
// GET /api/admin/mugs/catalog?id=uuid
// GET /api/admin/mugs/catalog?colours=true&activeOnly=true
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const coloursRequest = searchParams.get('colours') === 'true';

    if (coloursRequest) {
      let query = supabase.from('mug_colours').select('*').order('sort_order', { ascending: true });
      if (activeOnly) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (id) {
      const { data, error } = await supabase
        .from('mug_catalog')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    let query = supabase.from('mug_catalog').select('*').order('sort_order', { ascending: true });
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);

  } catch (error) {
    console.error('Error getting mug catalog:', error);
    return NextResponse.json({ error: 'Failed to fetch mug catalog' }, { status: 500 });
  }
}

// POST /api/admin/mugs/catalog
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const supabase = getAdminClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('mug_catalog')
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error creating mug catalog entry:', error);
    return NextResponse.json({ error: 'Failed to create mug catalog entry' }, { status: 500 });
  }
}

// PUT /api/admin/mugs/catalog
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const supabase = getAdminClient();
    const body = await request.json();
    const { id, ...updateData } = body;

    const { data, error } = await supabase
      .from('mug_catalog')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error updating mug catalog entry:', error);
    return NextResponse.json({ error: 'Failed to update mug catalog entry' }, { status: 500 });
  }
}

// PATCH /api/admin/mugs/catalog — partial update (e.g. toggle is_active)
export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const supabase = getAdminClient();
    const body = await request.json();
    const { id, ...updateData } = body;

    const { data, error } = await supabase
      .from('mug_catalog')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error patching mug catalog entry:', error);
    return NextResponse.json({ error: 'Failed to patch mug catalog entry' }, { status: 500 });
  }
}

// DELETE /api/admin/mugs/catalog?id=uuid
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Catalog entry ID is required' }, { status: 400 });
    }

    const { error } = await supabase.from('mug_catalog').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting mug catalog entry:', error);
    return NextResponse.json({ error: 'Failed to delete mug catalog entry' }, { status: 500 });
  }
}
