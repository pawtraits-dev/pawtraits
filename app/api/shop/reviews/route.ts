import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import type { CreateReviewRequest, CreateReviewResponse, Review } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/shop/reviews
 *
 * Create a new review for an order item
 *
 * Authentication: Email-based (customer must own the order)
 * Auto-approval: 4-5 stars auto-approved and published, 1-3 stars pending
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseService = new SupabaseService();

    // Authenticate the user
    const { data: { user }, error: authError } =
      await supabaseService.getClient().auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CreateReviewRequest = await request.json();
    const { order_item_id, rating, comment } = body;

    // Validation
    if (!order_item_id || !rating || !comment) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: order_item_id, rating, comment' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json(
        { success: false, error: 'Rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    const trimmedComment = comment.trim();
    if (trimmedComment.length < 10 || trimmedComment.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Comment must be between 10 and 1000 characters' },
        { status: 400 }
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
        { success: false, error: 'Customer profile not found' },
        { status: 404 }
      );
    }

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id, email, first_name')
      .eq('id', userProfile.customer_id)
      .single();

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer record not found' },
        { status: 404 }
      );
    }

    // Get order item and verify ownership
    const { data: orderItem, error: orderItemError } = await supabaseAdmin
      .from('order_items')
      .select(`
        *,
        order:orders!inner(
          id,
          order_number,
          customer_email,
          status,
          shipping_city,
          shipping_country
        )
      `)
      .eq('id', order_item_id)
      .single();

    if (orderItemError || !orderItem) {
      return NextResponse.json(
        { success: false, error: 'Order item not found' },
        { status: 404 }
      );
    }

    // Verify customer owns this order
    if (orderItem.order.customer_email !== customer.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Order does not belong to this customer' },
        { status: 403 }
      );
    }

    // Verify order is delivered
    if (orderItem.order.status !== 'delivered') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot review order that is not delivered. Current status: ${orderItem.order.status}`
        },
        { status: 400 }
      );
    }

    // Check for existing review
    const { data: existingReview } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('order_item_id', order_item_id)
      .eq('customer_id', customer.id)
      .single();

    if (existingReview) {
      return NextResponse.json(
        { success: false, error: 'You have already reviewed this item' },
        { status: 409 }
      );
    }

    // Get breed name from image if available
    let breedName: string | null = null;
    if (orderItem.image_id) {
      const { data: image } = await supabaseAdmin
        .from('image_catalog')
        .select('breed_id, breeds!inner(name)')
        .eq('id', orderItem.image_id)
        .single();

      if (image && image.breeds) {
        breedName = (image.breeds as any).name;
      }
    }

    // Get thumbnail URL from image variants
    let thumbnailUrl: string | null = orderItem.image_url;
    if (orderItem.image_id) {
      const { data: image } = await supabaseAdmin
        .from('image_catalog')
        .select('image_variants, public_url')
        .eq('id', orderItem.image_id)
        .single();

      if (image?.image_variants && typeof image.image_variants === 'object') {
        const variants = image.image_variants as Record<string, any>;
        thumbnailUrl = variants.thumbnail || image.public_url || orderItem.image_url;
      }
    }

    // Determine auto-approval (4-5 stars auto-approved)
    const isAutoApproved = rating >= 4;
    const status = isAutoApproved ? 'approved' : 'pending';
    const isPublished = isAutoApproved;

    // Create the review
    const { data: newReview, error: createError } = await supabaseAdmin
      .from('reviews')
      .insert({
        order_item_id,
        order_id: orderItem.order.id,
        customer_id: customer.id,
        rating,
        comment: trimmedComment,
        customer_first_name: customer.first_name || 'Anonymous',
        customer_city: orderItem.order.shipping_city,
        customer_country: orderItem.order.shipping_country,
        image_id: orderItem.image_id,
        image_url: orderItem.image_url || '',
        image_thumbnail_url: thumbnailUrl,
        breed_name: breedName,
        status,
        is_auto_approved: isAutoApproved,
        is_published: isPublished,
        is_early_adopter: false,
        published_at: isPublished ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating review:', createError);
      return NextResponse.json(
        { success: false, error: 'Failed to create review' },
        { status: 500 }
      );
    }

    // Success response
    const response: CreateReviewResponse = {
      success: true,
      review: newReview as Review,
      message: isAutoApproved
        ? 'Thank you for your review! It has been published.'
        : 'Thank you for your review! It will be published after admin review.',
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/shop/reviews:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
