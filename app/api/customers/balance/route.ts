import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');

    if (!customerEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Use service role key to fetch customer data
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Fetch customer's credit balance (stored in pence as integer)
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, current_credit_balance')
      .eq('email', customerEmail.toLowerCase().trim())
      .single();

    if (error || !customer) {
      console.error('[CUSTOMER BALANCE] Failed to fetch customer balance:', {
        email: customerEmail,
        error: error?.message
      });
      return NextResponse.json({
        available_balance: 0
      });
    }

    const balancePence = customer.current_credit_balance || 0;
    console.log('[CUSTOMER BALANCE] Retrieved balance:', {
      email: customerEmail,
      customerId: customer.id,
      balancePence: balancePence,
      balancePounds: (balancePence / 100).toFixed(2)
    });

    // Return balance in pence for consistency with other pricing
    return NextResponse.json({
      available_balance: balancePence
    });

  } catch (error) {
    console.error('Customer balance API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
