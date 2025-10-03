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
          customer_email
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
      console.log('📋 Sample commission record:', JSON.stringify(commissionData[0], null, 2));
      console.log('📋 Sample orders data:', JSON.stringify(commissionData[0].orders, null, 2));
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

      // Just use the customer email
      const customer_name = commission.orders?.customer_email || 'Unknown Customer';

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
        referral_code: commission.referral_code || commission.order_id,
        customer_name,
        commission_type: commission.commission_type,
        recipient_type: commission.recipient_type,
        orders: commission.orders // Include the orders data
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
      // First get the commission records to group by partner
      const { data: commissions, error: fetchError } = await supabase
        .from('commissions')
        .select('id, recipient_id, commission_amount')
        .in('id', commissionIds)
        .eq('recipient_type', 'partner');

      if (fetchError) {
        console.error('Error fetching commissions for payment:', fetchError);
        throw fetchError;
      }

      if (!commissions || commissions.length === 0) {
        return NextResponse.json(
          { error: 'No valid commissions found' },
          { status: 400 }
        );
      }

      // Group commissions by partner (recipient_id)
      const partnerGroups = commissions.reduce((groups: any, commission) => {
        const partnerId = commission.recipient_id;
        if (!groups[partnerId]) {
          groups[partnerId] = {
            partner_id: partnerId,
            commission_ids: [],
            total_amount: 0
          };
        }
        groups[partnerId].commission_ids.push(commission.id);
        groups[partnerId].total_amount += commission.commission_amount;
        return groups;
      }, {});

      const paymentDate = new Date().toISOString();

      // Create commission_payment records for each partner and update commissions
      for (const partnerGroup of Object.values(partnerGroups) as any[]) {
        // Create commission payment record
        const { data: paymentRecord, error: paymentError } = await supabase
          .from('commission_payments')
          .insert({
            partner_id: partnerGroup.partner_id,
            payment_period_start: new Date().toISOString().split('T')[0],
            payment_period_end: new Date().toISOString().split('T')[0],
            total_amount: partnerGroup.total_amount / 100, // Convert cents to pounds
            referral_count: partnerGroup.commission_ids.length,
            initial_commission_amount: partnerGroup.total_amount / 100,
            lifetime_commission_amount: 0,
            status: 'paid',
            payment_method: 'manual',
            paid_at: paymentDate
          })
          .select('id')
          .single();

        if (paymentError) {
          console.error('Error creating commission payment:', paymentError);
          throw paymentError;
        }

        // Update commission records with payment_id and status
        const { error: updateError } = await supabase
          .from('commissions')
          .update({
            status: 'paid',
            payment_date: paymentDate,
            commission_payment_id: paymentRecord.id,
            updated_at: paymentDate
          })
          .in('id', partnerGroup.commission_ids);

        if (updateError) {
          console.error('Error updating commissions with payment_id:', updateError);
          throw updateError;
        }
      }

      console.log('Admin commissions API: Created payments and marked', commissionIds.length, 'commissions as paid');
      return NextResponse.json({
        success: true,
        message: `Created ${Object.keys(partnerGroups).length} payment records and marked ${commissionIds.length} commissions as paid`
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