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

interface RouteParams {
  params: Promise<{ itemId: string }>;
}

// PUT /api/cart/[itemId] - Update cart item quantity
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { itemId } = await params;
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

    const { quantity } = await request.json();

    if (typeof quantity !== 'number' || quantity < 0) {
      return NextResponse.json(
        { error: 'Quantity must be a non-negative number' },
        { status: 400 }
      );
    }

    const itemId = params.itemId;

    if (quantity === 0) {
      // Remove item if quantity is 0
      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id); // Ensure user can only delete their own items

      if (deleteError) {
        console.error('Error removing cart item:', deleteError);
        return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 });
      }

      return NextResponse.json({ success: true, deleted: true });
    } else {
      // Update quantity
      const { data: updatedItem, error: updateError } = await supabase
        .from('cart_items')
        .update({ 
          quantity: quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .eq('user_id', user.id) // Ensure user can only update their own items
        .select()
        .single();

      if (updateError) {
        console.error('Error updating cart item:', updateError);
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
      }

      return NextResponse.json({ success: true, cartItem: updatedItem });
    }

  } catch (error) {
    console.error('Cart item UPDATE error:', error);
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}

// DELETE /api/cart/[itemId] - Remove specific cart item
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { itemId } = await params;
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

    const itemId = params.itemId;

    // Remove specific item
    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', user.id); // Ensure user can only delete their own items

    if (deleteError) {
      console.error('Error removing cart item:', deleteError);
      return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Cart item DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to remove item' },
      { status: 500 }
    );
  }
}