import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Add admin authentication check

    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Code ID is required' }, { status: 400 });
    }

    // Get pre-registration code details with partner information
    const { data, error } = await supabase.rpc('get_pre_registration_code_details', {
      p_code_id: id
    });

    if (error) {
      console.error('Failed to fetch pre-registration code details:', error);
      return NextResponse.json({ error: 'Failed to fetch code details' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    return NextResponse.json(data[0]);
  } catch (error) {
    console.error('Pre-registration code details API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Add admin authentication check

    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { id } = params;
    const body = await request.json();
    const { status, business_category, marketing_campaign, expiration_date } = body;

    if (!id) {
      return NextResponse.json({ error: 'Code ID is required' }, { status: 400 });
    }

    // Update pre-registration code
    const { data, error } = await supabase
      .from('pre_registration_codes')
      .update({
        status,
        business_category,
        marketing_campaign,
        expiration_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update pre-registration code:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Code not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to update code' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Pre-registration code update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Add admin authentication check

    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Code ID is required' }, { status: 400 });
    }

    // Delete pre-registration code
    const { error } = await supabase
      .from('pre_registration_codes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete pre-registration code:', error);
      return NextResponse.json({ error: 'Failed to delete code' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pre-registration code deletion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}