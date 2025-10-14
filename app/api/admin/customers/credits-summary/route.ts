import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check

    console.log('📊 Admin credits summary API: Calculating aggregate credit liability');

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get all customers with their credit balances
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, email, first_name, last_name, current_credit_balance, created_at')
      .order('current_credit_balance', { ascending: false });

    if (customersError) {
      console.error('❌ Error fetching customers:', customersError);
      return NextResponse.json(
        { error: 'Failed to fetch customers' },
        { status: 500 }
      );
    }

    console.log('👥 Found', customers?.length || 0, 'total customers');

    // Get all customer credits from commissions table
    const { data: allCredits, error: creditsError } = await supabase
      .from('commissions')
      .select('id, recipient_id, commission_amount, status, created_at')
      .eq('recipient_type', 'customer')
      .eq('commission_type', 'customer_credit');

    if (creditsError) {
      console.error('❌ Error fetching credits:', creditsError);
      return NextResponse.json(
        { error: 'Failed to fetch credits' },
        { status: 500 }
      );
    }

    console.log('💰 Found', allCredits?.length || 0, 'total credit records');

    // Get all redemptions
    const { data: redemptions, error: redemptionsError } = await supabase
      .from('orders')
      .select('customer_email, credit_applied')
      .gt('credit_applied', 0);

    if (redemptionsError) {
      console.warn('⚠️  Error fetching redemptions:', redemptionsError);
    }

    console.log('🎫 Found', redemptions?.length || 0, 'total redemption records');

    // Calculate aggregate metrics
    const totalOutstandingCreditsPence = customers?.reduce((sum, customer) =>
      sum + (customer.current_credit_balance || 0), 0
    ) || 0;
    const totalOutstandingCredits = totalOutstandingCreditsPence / 100;

    const totalCreditsEarnedPence = allCredits?.reduce((sum, credit) =>
      sum + (credit.commission_amount || 0), 0
    ) || 0;
    const totalCreditsEarned = totalCreditsEarnedPence / 100;

    const pendingCreditsPence = allCredits?.filter(c => c.status === 'pending')
      .reduce((sum, credit) => sum + (credit.commission_amount || 0), 0) || 0;
    const pendingCredits = pendingCreditsPence / 100;

    const approvedCreditsPence = allCredits?.filter(c => c.status === 'approved' || c.status === 'paid')
      .reduce((sum, credit) => sum + (credit.commission_amount || 0), 0) || 0;
    const approvedCredits = approvedCreditsPence / 100;

    const totalRedeemedPence = redemptions?.reduce((sum, order) =>
      sum + (order.credit_applied || 0), 0
    ) || 0;
    const totalRedeemed = totalRedeemedPence / 100;

    const customersWithCredits = customers?.filter(c => (c.current_credit_balance || 0) > 0) || [];
    const numberOfCustomersWithCredits = customersWithCredits.length;

    const averageCreditBalancePence = numberOfCustomersWithCredits > 0
      ? totalOutstandingCreditsPence / numberOfCustomersWithCredits
      : 0;
    const averageCreditBalance = averageCreditBalancePence / 100;

    // Top customers by credit balance
    const topCustomersByBalance = customersWithCredits.slice(0, 10).map(customer => ({
      id: customer.id,
      email: customer.email,
      name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email,
      credit_balance_pounds: (customer.current_credit_balance || 0) / 100,
      created_at: customer.created_at
    }));

    // Credits earned over time (group by month)
    const creditsByMonth: { [key: string]: number } = {};
    allCredits?.forEach(credit => {
      const month = new Date(credit.created_at).toISOString().substring(0, 7); // YYYY-MM
      creditsByMonth[month] = (creditsByMonth[month] || 0) + (credit.commission_amount || 0);
    });

    const monthlyCreditsEarned = Object.entries(creditsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amountPence]) => ({
        month,
        amount_pounds: amountPence / 100
      }));

    const response = {
      aggregate_summary: {
        total_outstanding_credits_pounds: totalOutstandingCredits,
        total_credits_earned_lifetime_pounds: totalCreditsEarned,
        pending_credits_pounds: pendingCredits,
        approved_credits_pounds: approvedCredits,
        total_redeemed_lifetime_pounds: totalRedeemed,
        number_of_customers_with_credits: numberOfCustomersWithCredits,
        total_customers: customers?.length || 0,
        average_credit_balance_pounds: averageCreditBalance,
        total_credit_records: allCredits?.length || 0,
        total_redemption_records: redemptions?.length || 0
      },
      top_customers_by_balance: topCustomersByBalance,
      monthly_credits_earned: monthlyCreditsEarned,
      liability_breakdown: {
        current_outstanding_liability_pounds: totalOutstandingCredits,
        pending_future_liability_pounds: pendingCredits,
        total_potential_liability_pounds: totalOutstandingCredits + pendingCredits,
        lifetime_credits_issued_pounds: totalCreditsEarned,
        lifetime_credits_redeemed_pounds: totalRedeemed,
        redemption_rate_percent: totalCreditsEarned > 0
          ? ((totalRedeemed / totalCreditsEarned) * 100).toFixed(2)
          : '0.00'
      }
    };

    console.log('✅ Admin credits summary API: Calculated aggregate metrics');
    console.log('📊 Total outstanding liability: £', totalOutstandingCredits.toFixed(2));
    console.log('👥 Customers with credits:', numberOfCustomersWithCredits);

    return NextResponse.json(response);
  } catch (error) {
    console.error('💥 Error calculating credit liability summary:', error);
    return NextResponse.json(
      { error: 'Failed to calculate credit summary' },
      { status: 500 }
    );
  }
}
