import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * PUT /api/admin/credit-packs/[id]
 * Updates a credit pack configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify admin access
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('user_type')
      .eq('email', user.email)
      .single();

    if (!userProfile || userProfile.user_type !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const updateData = await request.json();

    // Update the credit pack
    const { data: updatedPack, error: updateError } = await supabaseAdmin
      .from('customer_credit_pack_config')
      .update({
        pack_name: updateData.pack_name,
        credits_amount: updateData.credits_amount,
        price_pence: updateData.price_pence,
        price_currency: updateData.price_currency,
        order_credit_pence: updateData.order_credit_pence,
        base_variation_cost: updateData.base_variation_cost,
        multi_animal_cost: updateData.multi_animal_cost,
        format_variation_cost: updateData.format_variation_cost,
        outfit_variation_cost: updateData.outfit_variation_cost,
        free_trial_credits: updateData.free_trial_credits,
        is_active: updateData.is_active,
        is_recommended: updateData.is_recommended,
        discount_percentage: updateData.discount_percentage,
        display_order: updateData.display_order
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating credit pack:', updateError);
      return NextResponse.json({ error: 'Failed to update credit pack' }, { status: 500 });
    }

    console.log('✅ Credit pack updated:', id, updateData.pack_name);

    return NextResponse.json(updatedPack);

  } catch (error) {
    console.error('Admin credit pack update API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update credit pack' },
      { status: 500 }
    );
  }
}
