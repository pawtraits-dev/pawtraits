import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    
    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .eq('id', id)
      .not('business_name', 'is', null) // Ensure this is a real business partner
      .single();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching partner:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    const body = await request.json();
    
    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const { data, error } = await supabase
      .from('partners')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // TODO: Log admin action
    // await logAdminAction(adminId, 'update_partner', 'partner', params.id, oldData, data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating partner:', error);
    return NextResponse.json(
      { error: 'Failed to update partner' },
      { status: 500 }
    );
  }
}