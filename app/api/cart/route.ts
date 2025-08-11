import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// GET /api/cart - Get user's cart
export async function GET(request: NextRequest) {
  try {
    // Get user from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get user's cart using database function
    const { data: cartItems, error: cartError } = await supabase
      .rpc('get_user_cart', { p_user_id: user.id });

    if (cartError) {
      console.error('Error fetching cart:', cartError);
      return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 });
    }

    // Calculate totals
    const totalItems = cartItems?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
    const totalPrice = cartItems?.reduce((sum: number, item: any) => sum + item.item_total, 0) || 0;

    return NextResponse.json({
      items: cartItems || [],
      totalItems,
      totalPrice
    });

  } catch (error) {
    console.error('Cart GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cart' },
      { status: 500 }
    );
  }
}

// POST /api/cart - Add item to cart
export async function POST(request: NextRequest) {
  try {
    // Get user from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const {
      productId,
      imageId,
      imageUrl,
      imageTitle,
      quantity = 1,
      pricing,
      product,
      partnerId,
      discountCode
    } = await request.json();

    if (!productId || !imageId || !imageUrl || !imageTitle || !pricing || !product) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, imageId, imageUrl, imageTitle, pricing, product' },
        { status: 400 }
      );
    }

    // Add item to cart using database function
    const { data: cartItem, error: cartError } = await supabase
      .rpc('upsert_cart_item', {
        p_user_id: user.id,
        p_product_id: productId,
        p_image_id: imageId,
        p_image_url: imageUrl,
        p_image_title: imageTitle,
        p_quantity: quantity,
        p_pricing_data: pricing,
        p_product_data: product,
        p_partner_id: partnerId || null,
        p_discount_code: discountCode || null
      });

    if (cartError) {
      console.error('Error adding to cart:', cartError);
      return NextResponse.json({ error: 'Failed to add item to cart' }, { status: 500 });
    }

    return NextResponse.json({ success: true, cartItem });

  } catch (error) {
    console.error('Cart POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add item to cart' },
      { status: 500 }
    );
  }
}

// DELETE /api/cart - Clear cart
export async function DELETE(request: NextRequest) {
  try {
    // Get user from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Clear user's cart
    const { data: deletedCount, error: deleteError } = await supabase
      .rpc('clear_user_cart', { p_user_id: user.id });

    if (deleteError) {
      console.error('Error clearing cart:', deleteError);
      return NextResponse.json({ error: 'Failed to clear cart' }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedCount });

  } catch (error) {
    console.error('Cart DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cart' },
      { status: 500 }
    );
  }
}