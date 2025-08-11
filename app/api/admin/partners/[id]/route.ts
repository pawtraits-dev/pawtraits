import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

const supabaseService = new SupabaseService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    
    const { data, error } = await supabaseService['supabase']
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
    
    const { data, error } = await supabaseService['supabase']
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