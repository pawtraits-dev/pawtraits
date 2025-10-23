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

    console.log('🔍 Admin customer credits API: Fetching credit data for customer:', id);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user profile first (admin pages use user_profiles.id)
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, created_at')
      .eq('id', id)
      .eq('user_type', 'customer')
      .single();

    if (profileError || !userProfile) {
      console.error('❌ Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get corresponding customer record (for credit balance)
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, current_credit_balance')
      .eq('email', userProfile.email)
      .maybeSingle();

    if (customerError) {
      console.error('❌ Error fetching customer record:', customerError);
    }

    const customerId = customer?.id;
    const currentCreditBalance = customer?.current_credit_balance || 0;

    console.log('📊 Found user profile:', userProfile.email, 'customer ID:', customerId);

    // Get all credits earned (from commissions table) - only if customer record exists
    let earnedCredits = null;
    if (customerId) {
      const { data, error: creditsError } = await supabase
        .from('commissions')
        .select(`
          id,
          order_id,
          order_amount,
          commission_amount,
          commission_rate,
          status,
          created_at,
          metadata,
          orders!inner (
            id,
            order_number,
            customer_email,
            subtotal_amount,
            total_amount,
            created_at
          )
        `)
        .eq('recipient_type', 'customer')
        .eq('recipient_id', customerId)
        .eq('commission_type', 'customer_credit')
        .order('created_at', { ascending: false });

      if (creditsError) {
        console.error('❌ Error fetching earned credits:', creditsError);
      } else {
        earnedCredits = data;
      }
    }

    console.log('💰 Found', earnedCredits?.length || 0, 'earned credit records');

    // Get redemption history (orders where customer used credits)
    const { data: redemptions, error: redemptionsError } = await supabase
      .from('orders')
      .select('id, order_number, created_at, subtotal_amount, total_amount, credit_applied')
      .eq('customer_email', userProfile.email)
      .gt('credit_applied', 0)
      .order('created_at', { ascending: false });

    if (redemptionsError) {
      console.warn('⚠️  Error fetching redemptions:', redemptionsError);
    }

    console.log('🎫 Found', redemptions?.length || 0, 'redemption records');

    // Calculate summary metrics
    const totalEarnedPence = earnedCredits?.reduce((sum, credit) => sum + (credit.commission_amount || 0), 0) || 0;
    const totalEarned = totalEarnedPence / 100; // Convert to pounds

    const pendingCreditsPence = earnedCredits?.filter(c => c.status === 'pending')
      .reduce((sum, credit) => sum + (credit.commission_amount || 0), 0) || 0;
    const pendingCredits = pendingCreditsPence / 100;

    const approvedCreditsPence = earnedCredits?.filter(c => c.status === 'approved' || c.status === 'paid')
      .reduce((sum, credit) => sum + (credit.commission_amount || 0), 0) || 0;
    const approvedCredits = approvedCreditsPence / 100;

    const currentBalance = currentCreditBalance / 100;

    const totalRedeemedPence = redemptions?.reduce((sum, order) => sum + (order.credit_applied || 0), 0) || 0;
    const totalRedeemed = totalRedeemedPence / 100;

    // Format earned credits for display
    const formattedEarnedCredits = earnedCredits?.map(credit => ({
      id: credit.id,
      order_id: credit.order_id,
      order_number: credit.orders?.order_number || 'N/A',
      referred_customer_email: credit.metadata?.referred_customer_email || 'Unknown',
      order_amount_pounds: (credit.order_amount || 0) / 100,
      credit_amount_pounds: (credit.commission_amount || 0) / 100,
      credit_rate: credit.commission_rate,
      status: credit.status,
      earned_date: credit.created_at,
      order_date: credit.orders?.created_at
    })) || [];

    // Format redemptions for display
    const formattedRedemptions = redemptions?.map(order => ({
      id: order.id,
      order_number: order.order_number,
      redeemed_date: order.created_at,
      order_total_pounds: (order.total_amount || 0) / 100,
      credit_used_pounds: (order.credit_applied || 0) / 100,
      amount_paid_pounds: ((order.total_amount || 0) - (order.credit_applied || 0)) / 100
    })) || [];

    const response = {
      customer: {
        id: customerId || id,
        email: userProfile.email,
        name: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.email,
        created_at: userProfile.created_at
      },
      summary: {
        current_balance_pounds: currentBalance,
        total_earned_pounds: totalEarned,
        pending_credits_pounds: pendingCredits,
        approved_credits_pounds: approvedCredits,
        total_redeemed_pounds: totalRedeemed,
        total_earned_credits_count: earnedCredits?.length || 0,
        total_redemptions_count: redemptions?.length || 0
      },
      earned_credits: formattedEarnedCredits,
      redemptions: formattedRedemptions
    };

    console.log('✅ Admin customer credits API: Returning data for customer', id);
    console.log('📊 Summary:', response.summary);

    return NextResponse.json(response);
  } catch (error) {
    console.error('💥 Error fetching customer credit data for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/customers/[id]/credits
 * Manually adjust customer customization credits (add or remove)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id: customerId } = await params;
    const { amount, reason } = await request.json();

    if (!amount || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    console.log(`🔧 Admin adjusting customization credits for customer ${customerId}: ${amount > 0 ? '+' : ''}${amount}`);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get current credit balance from customer_customization_credits
    const { data: currentCredits, error: fetchError } = await supabase
      .from('customer_customization_credits')
      .select('credits_remaining, customer_id')
      .eq('customer_id', customerId)
      .single();

    if (fetchError) {
      console.error('Error fetching customer credits:', fetchError);

      // If no record exists, create one first
      if (fetchError.code === 'PGRST116') {
        console.log('⚠️  No credit record exists. Creating one...');

        const { data: newRecord, error: insertError } = await supabase
          .from('customer_customization_credits')
          .insert({
            customer_id: customerId,
            credits_remaining: Math.max(0, amount), // Can't have negative on first create
            free_trial_credits_granted: 0, // Not a trial, this is admin adjustment
            credits_purchased: 0,
            credits_used: 0,
            total_generations: 0
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Failed to create credit record:', insertError);
          return NextResponse.json({ error: 'Failed to create credit record' }, { status: 500 });
        }

        console.log('✅ Credit record created with balance:', newRecord.credits_remaining);

        return NextResponse.json({
          success: true,
          previousBalance: 0,
          adjustment: amount,
          newBalance: newRecord.credits_remaining,
          credits: newRecord
        });
      }

      return NextResponse.json({ error: 'Customer credit record not found' }, { status: 404 });
    }

    const newBalance = currentCredits.credits_remaining + amount;

    // Ensure balance doesn't go negative
    if (newBalance < 0) {
      return NextResponse.json({
        error: `Cannot remove ${Math.abs(amount)} credits. Customer only has ${currentCredits.credits_remaining} credits.`
      }, { status: 400 });
    }

    // Update credits
    const { data: updatedCredits, error: updateError } = await supabase
      .from('customer_customization_credits')
      .update({
        credits_remaining: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', customerId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating credits:', updateError);
      return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 });
    }

    console.log('✅ Customization credits adjusted:', {
      customerId,
      previousBalance: currentCredits.credits_remaining,
      adjustment: amount,
      newBalance,
      reason: reason || 'Admin manual adjustment'
    });

    return NextResponse.json({
      success: true,
      previousBalance: currentCredits.credits_remaining,
      adjustment: amount,
      newBalance,
      credits: updatedCredits
    });

  } catch (error) {
    console.error('Admin credit adjustment API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to adjust credits' },
      { status: 500 }
    );
  }
}
