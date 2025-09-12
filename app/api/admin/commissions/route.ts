import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    console.log('🔍 Admin commissions API: Starting commission data fetch');
    
    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // First, let's check what's in client_orders table
    const { data: rawOrders, error: rawError, count } = await supabase
      .from('client_orders')
      .select('*', { count: 'exact' });
    
    console.log('📊 Raw client_orders count:', count);
    console.log('📊 Raw client_orders error:', rawError);
    if (rawOrders && rawOrders.length > 0) {
      console.log('📊 Sample client_orders record:', rawOrders[0]);
    }
    
    // Get all commission data from client_orders table with partner information
    // Use left join instead of inner join to avoid missing records
    const { data: commissionData, error } = await supabase
      .from('client_orders')
      .select(`
        *,
        partners (
          id,
          business_name,
          email,
          first_name,
          last_name
        )
      `)
      .order('created_at', { ascending: false });

    console.log('🔍 Commission data query error:', error);
    console.log('🔍 Commission data count:', commissionData?.length || 0);
    
    if (error) {
      console.error('❌ Error fetching commission data:', error);
      throw error;
    }
    
    if (commissionData && commissionData.length > 0) {
      console.log('📋 Sample commission record:', commissionData[0]);
    }

    // Transform data to include partner information
    const transformedData = commissionData.map((commission: any) => ({
      ...commission,
      partner_name: commission.partners?.business_name || 
                    `${commission.partners?.first_name || ''} ${commission.partners?.last_name || ''}`.trim() || 
                    'Unknown Partner',
      partner_email: commission.partners?.email || '',
      // Convert commission_amount from pennies to pennies (keep as is for consistency with existing admin code)
      commission_amount: commission.commission_amount,
      order_amount: commission.order_amount || 0
    }));

    console.log('✅ Admin commissions API: Found', transformedData.length, 'commission records');
    console.log('📤 Returning transformed data sample:', transformedData[0] || 'No data');
    return NextResponse.json(transformedData);

  } catch (error) {
    console.error('Error fetching admin commission data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commission data' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    const { commissionIds, action } = await request.json();

    if (!commissionIds || !Array.isArray(commissionIds)) {
      return NextResponse.json(
        { error: 'Commission IDs array is required' },
        { status: 400 }
      );
    }

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    if (action === 'markPaid') {
      const { error } = await supabase
        .from('client_orders')
        .update({ 
          commission_paid: true,
          updated_at: new Date().toISOString()
        })
        .in('id', commissionIds);

      if (error) {
        console.error('Error updating commissions:', error);
        throw error;
      }

      console.log('Admin commissions API: Marked', commissionIds.length, 'commissions as paid');
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
    console.error('Error updating admin commissions:', error);
    return NextResponse.json(
      { error: 'Failed to update commissions' },
      { status: 500 }
    );
  }
}