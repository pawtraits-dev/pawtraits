import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import type { ReviewableOrderItem } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/shop/orders/reviewable
 *
 * Returns delivered orders with items that can be reviewed
 *
 * Authentication: Email-based (customer must be authenticated)
 * Uses helper function: get_reviewable_order_items(customer_email)
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseService = new SupabaseService();

    // Authenticate the user
    const { data: { user }, error: authError } =
      await supabaseService.getClient().auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Use service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get customer record for this user
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('customer_id, email')
      .eq('user_id', user.id)
      .eq('user_type', 'customer')
      .single();

    if (!userProfile || !userProfile.customer_id) {
      return NextResponse.json(
        { error: 'Customer profile not found' },
        { status: 404 }
      );
    }

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('email')
      .eq('id', userProfile.customer_id)
      .single();

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer record not found' },
        { status: 404 }
      );
    }

    // Call the helper function to get reviewable order items
    const { data: reviewableItems, error: rpcError } = await supabaseAdmin
      .rpc('get_reviewable_order_items', {
        customer_email_param: customer.email
      });

    if (rpcError) {
      console.error('Error calling get_reviewable_order_items:', rpcError);
      return NextResponse.json(
        { error: 'Failed to fetch reviewable orders' },
        { status: 500 }
      );
    }

    // Group by order_id for better organization
    const orderMap = new Map<string, {
      order_id: string;
      order_number: string;
      delivered_at?: string;
      items: ReviewableOrderItem[];
    }>();

    for (const item of reviewableItems || []) {
      if (!orderMap.has(item.order_id)) {
        orderMap.set(item.order_id, {
          order_id: item.order_id,
          order_number: item.order_number,
          delivered_at: item.delivered_at,
          items: [],
        });
      }
      orderMap.get(item.order_id)!.items.push(item);
    }

    const orders = Array.from(orderMap.values());

    return NextResponse.json({
      orders,
      total_reviewable_items: reviewableItems?.filter(item => !item.has_review).length || 0,
    });

  } catch (error) {
    console.error('Error in GET /api/shop/orders/reviewable:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
