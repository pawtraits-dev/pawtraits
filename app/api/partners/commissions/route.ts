import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No auth header found for partner commissions');
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      );
    }

    const partnerId = user.id; // Partner ID is the user ID

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'paid' or 'unpaid'

    console.log('Partner commissions API: Fetching commission data for partner:', partnerId);

    // Get commission data from new commissions table
    let query = supabase
      .from('commissions')
      .select(`
        id,
        recipient_id,
        recipient_type,
        order_id,
        commission_amount,
        commission_rate,
        status,
        created_at,
        updated_at,
        metadata
      `)
      .eq('recipient_id', partnerId)
      .eq('recipient_type', 'partner');

    if (status === 'paid') {
      query = query.eq('status', 'paid');
    } else if (status === 'unpaid') {
      query = query.neq('status', 'paid');
    }

    const { data: commissions, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching commission records:', error);
      throw error;
    }

    // Calculate totals (amounts are stored in cents)
    const unpaidCommissions = commissions?.filter(c => c.status !== 'paid') || [];
    const paidCommissions = commissions?.filter(c => c.status === 'paid') || [];

    const unpaidTotal = unpaidCommissions.reduce((sum, commission) =>
      sum + ((commission.commission_amount || 0) / 100), 0
    );

    const paidTotal = paidCommissions.reduce((sum, commission) =>
      sum + ((commission.commission_amount || 0) / 100), 0
    );

    const totalCommissions = unpaidTotal + paidTotal;

    // Count initial vs lifetime commissions based on metadata
    const initialCommissions = commissions?.filter(c =>
      c.metadata && typeof c.metadata === 'object' && c.metadata.commission_type === 'initial'
    ) || [];
    const lifetimeCommissions = commissions?.filter(c =>
      c.metadata && typeof c.metadata === 'object' && c.metadata.commission_type === 'lifetime'
    ) || [];

    const response = {
      summary: {
        totalCommissions: totalCommissions.toFixed(2),
        unpaidTotal: unpaidTotal.toFixed(2),
        paidTotal: paidTotal.toFixed(2),
        unpaidCount: unpaidCommissions.length,
        paidCount: paidCommissions.length,
        initialOrdersCount: initialCommissions.length,
        subsequentOrdersCount: lifetimeCommissions.length
      },
      commissions: commissions || [],
      unpaidCommissions,
      paidCommissions
    };

    console.log('Partner commissions API: Found', commissions?.length || 0, 'commission records for partner', partnerId);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching partner commission data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commission data' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      );
    }

    const partnerId = user.id; // Partner ID is the user ID

    const { commissionIds, action } = await request.json();

    if (!commissionIds || !Array.isArray(commissionIds)) {
      return NextResponse.json(
        { error: 'Commission IDs array is required' },
        { status: 400 }
      );
    }

    if (action === 'markPaid') {
      // Verify all commissions belong to this partner before updating
      const { data: existingCommissions, error: verifyError } = await supabase
        .from('commissions')
        .select('id')
        .eq('recipient_id', partnerId)
        .eq('recipient_type', 'partner')
        .in('id', commissionIds);

      if (verifyError || !existingCommissions || existingCommissions.length !== commissionIds.length) {
        return NextResponse.json(
          { error: 'Invalid commission IDs or unauthorized' },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from('commissions')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .in('id', commissionIds);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: `Marked ${commissionIds.length} commissions as paid`
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error updating commissions:', error);
    return NextResponse.json(
      { error: 'Failed to update commissions' },
      { status: 500 }
    );
  }
}