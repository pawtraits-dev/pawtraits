import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    console.log('🔍 Admin commissions API: Starting commission data fetch from new commissions table');

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get all commission data from new commissions table with related information
    const { data: commissionData, error } = await supabase
      .from('commissions')
      .select(`
        id,
        order_id,
        order_amount,
        recipient_type,
        recipient_id,
        recipient_email,
        referrer_type,
        referrer_id,
        referral_code,
        commission_type,
        commission_rate,
        commission_amount,
        status,
        payment_date,
        created_at,
        updated_at,
        metadata,
        orders (
          order_number,
          customer_email,
          shipping_first_name,
          shipping_last_name
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

    // Transform data to match expected admin UI format
    const transformedData = await Promise.all(commissionData.map(async (commission: any) => {
      let partner_name = 'Unknown Partner';
      let partner_email = commission.recipient_email;

      // For partner commissions, get partner details
      if (commission.recipient_type === 'partner' && commission.recipient_id) {
        const { data: partnerData } = await supabase
          .from('partners')
          .select('business_name, first_name, last_name, email')
          .eq('id', commission.recipient_id)
          .single();

        if (partnerData) {
          partner_name = partnerData.business_name ||
                         `${partnerData.first_name || ''} ${partnerData.last_name || ''}`.trim() ||
                         'Unknown Partner';
          partner_email = partnerData.email || commission.recipient_email;
        }
      }

      // For customer credits, use customer name format
      if (commission.recipient_type === 'customer') {
        partner_name = `Customer Credit (${commission.recipient_email})`;
      }

      return {
        id: commission.id,
        partner_id: commission.recipient_id,
        partner_name,
        partner_email,
        order_id: commission.order_id,
        order_amount: commission.order_amount,
        commission_rate: commission.commission_rate, // Already in percentage
        commission_amount: commission.commission_amount, // Already in pennies
        status: commission.status, // New table has proper status field
        created_at: commission.created_at,
        paid_at: commission.payment_date,
        referral_code: commission.referral_code || commission.orders?.order_number || commission.order_id,
        customer_name: commission.orders ?
          `${commission.orders.shipping_first_name || ''} ${commission.orders.shipping_last_name || ''}`.trim() ||
          commission.orders.customer_email :
          'Unknown Customer',
        commission_type: commission.commission_type,
        recipient_type: commission.recipient_type
      };
    }));

    console.log('✅ Admin commissions API: Found', transformedData.length, 'commission records from new table');
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
        .from('commissions')
        .update({
          status: 'paid',
          payment_date: new Date().toISOString(),
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

    if (action === 'approve') {
      const { error } = await supabase
        .from('commissions')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .in('id', commissionIds)
        .eq('status', 'pending'); // Only approve pending commissions

      if (error) {
        console.error('Error approving commissions:', error);
        throw error;
      }

      console.log('Admin commissions API: Approved', commissionIds.length, 'commissions');
      return NextResponse.json({
        success: true,
        message: `Approved ${commissionIds.length} commissions`
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