import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const serviceRoleSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// POST /api/cart/migrate - Migrate guest cart items to authenticated user's cart
export async function POST(request: NextRequest) {
  try {
    // Get user from session cookies
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const requestData = await request.json();
    const { items: guestItems } = requestData;

    if (!Array.isArray(guestItems) || guestItems.length === 0) {
      return NextResponse.json({ success: true, migratedCount: 0 });
    }

    console.log(`🔄 Migrating ${guestItems.length} guest cart items to server for user ${user.id}`);

    let migratedCount = 0;
    const errors = [];

    // Migrate each guest cart item
    for (const guestItem of guestItems) {
      try {
        // Validate required fields
        if (!guestItem.productId || !guestItem.imageId || !guestItem.imageUrl || !guestItem.imageTitle || !guestItem.pricing || !guestItem.product) {
          console.warn('Skipping invalid guest cart item:', guestItem);
          errors.push(`Invalid item: missing required fields`);
          continue;
        }

        // Add item to server cart using the same function as regular POST
        const { data: cartItem, error: cartError } = await serviceRoleSupabase
          .rpc('upsert_cart_item', {
            p_user_id: user.id,
            p_product_id: guestItem.productId,
            p_image_id: guestItem.imageId,
            p_image_url: guestItem.imageUrl,
            p_image_title: guestItem.imageTitle,
            p_quantity: guestItem.quantity || 1,
            p_pricing_data: guestItem.pricing,
            p_product_data: guestItem.product,
            p_partner_id: guestItem.partnerId || null,
            p_discount_code: guestItem.discountCode || null
          });

        if (cartError) {
          console.error('Error migrating cart item:', cartError);
          errors.push(`Failed to migrate item: ${cartError.message}`);
        } else {
          migratedCount++;
          console.log(`✅ Migrated cart item: ${guestItem.imageTitle}`);
        }

      } catch (itemError) {
        console.error('Error processing guest cart item:', itemError);
        errors.push(`Processing error: ${itemError.message}`);
      }
    }

    console.log(`🎉 Cart migration completed: ${migratedCount}/${guestItems.length} items migrated`);

    return NextResponse.json({
      success: true,
      migratedCount,
      totalItems: guestItems.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Cart migration error:', error);
    return NextResponse.json(
      { error: 'Failed to migrate cart items' },
      { status: 500 }
    );
  }
}