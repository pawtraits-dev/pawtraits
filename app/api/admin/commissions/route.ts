import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

const supabaseService = new SupabaseService();

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    console.log('Admin commissions API: Fetching all commission data');
    
    // Get all commission data from client_orders table with partner information
    const { data: commissionData, error } = await supabaseService['supabase']
      .from('client_orders')
      .select(`
        *,
        partners!inner (
          id,
          business_name,
          email,
          first_name,
          last_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching commission data:', error);
      throw error;
    }

    // Transform data to include partner information
    const transformedData = commissionData.map((commission: any) => ({
      ...commission,
      partner_name: commission.partners.business_name || 
                    `${commission.partners.first_name} ${commission.partners.last_name}`.trim() || 
                    'Unknown Partner',
      partner_email: commission.partners.email,
      // Convert commission_amount from pennies to pennies (keep as is for consistency with existing admin code)
      commission_amount: commission.commission_amount,
      order_amount: commission.order_amount || 0
    }));

    console.log('Admin commissions API: Found', transformedData.length, 'commission records');
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

    if (action === 'markPaid') {
      const { error } = await supabaseService['supabase']
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