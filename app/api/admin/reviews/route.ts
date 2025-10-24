import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { Review, ReviewStatistics } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/admin/reviews
 *
 * List all reviews with optional filtering
 *
 * Query params:
 * - status: filter by status (pending, approved, rejected, hidden)
 * - rating: filter by rating (1-5)
 * - search: search in customer name, email, or comment
 * - limit: number of results (default: 50)
 * - offset: pagination offset (default: 0)
 * - stats: if true, returns statistics only
 *
 * Authentication: Admin only (service role key)
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const ratingFilter = searchParams.get('rating');
    const searchQuery = searchParams.get('search');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const statsOnly = searchParams.get('stats') === 'true';

    // If stats only, call the helper function
    if (statsOnly) {
      const { data: stats, error: statsError } = await supabaseAdmin
        .rpc('get_review_statistics');

      if (statsError) {
        console.error('Error fetching review statistics:', statsError);
        return NextResponse.json(
          { error: 'Failed to fetch statistics' },
          { status: 500 }
        );
      }

      const statistics: ReviewStatistics = stats?.[0] || {
        total_reviews: 0,
        pending_reviews: 0,
        approved_reviews: 0,
        rejected_reviews: 0,
        published_reviews: 0,
        average_rating: 0,
        five_star_count: 0,
        four_star_count: 0,
        three_star_count: 0,
        two_star_count: 0,
        one_star_count: 0,
      };

      return NextResponse.json({ statistics });
    }

    // Parse pagination
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // Build query
    let query = supabaseAdmin
      .from('reviews')
      .select('*, customers!inner(email)', { count: 'exact' });

    // Apply filters
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (ratingFilter) {
      const rating = parseInt(ratingFilter, 10);
      if (!isNaN(rating) && rating >= 1 && rating <= 5) {
        query = query.eq('rating', rating);
      }
    }

    if (searchQuery) {
      // Search in customer name, email, or comment
      query = query.or(`customer_first_name.ilike.%${searchQuery}%,comment.ilike.%${searchQuery}%,customers.email.ilike.%${searchQuery}%`);
    }

    // Sort by creation date, newest first
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: reviews, error, count } = await query;

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reviews: reviews as Review[],
      count: count || 0,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Error in GET /api/admin/reviews:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/reviews
 *
 * Update a review (status, admin response, publication)
 *
 * Body:
 * - review_id: string (required)
 * - status?: 'pending' | 'approved' | 'rejected' | 'hidden'
 * - is_published?: boolean
 * - admin_response?: string
 * - admin_responder_id?: string
 *
 * Authentication: Admin only (service role key)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json();
    const {
      review_id,
      status,
      is_published,
      admin_response,
      admin_responder_id,
    } = body;

    if (!review_id) {
      return NextResponse.json(
        { error: 'review_id is required' },
        { status: 400 }
      );
    }

    // Build update object
    const updates: Partial<Review> = {};

    if (status !== undefined) {
      if (!['pending', 'approved', 'rejected', 'hidden'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status value' },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    if (is_published !== undefined) {
      updates.is_published = is_published;
    }

    if (admin_response !== undefined) {
      if (admin_response && admin_response.trim().length > 500) {
        return NextResponse.json(
          { error: 'Admin response must be 500 characters or less' },
          { status: 400 }
        );
      }
      updates.admin_response = admin_response.trim() || null;
      updates.admin_responded_at = admin_response ? new Date().toISOString() : null;
    }

    if (admin_responder_id !== undefined) {
      updates.admin_responder_id = admin_responder_id;
    }

    // Perform update
    const { data: updatedReview, error: updateError } = await supabaseAdmin
      .from('reviews')
      .update(updates)
      .eq('id', review_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating review:', updateError);
      return NextResponse.json(
        { error: 'Failed to update review' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      review: updatedReview as Review,
    });

  } catch (error) {
    console.error('Error in PATCH /api/admin/reviews:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/reviews
 *
 * Soft delete a review (set status to 'hidden')
 *
 * Query params:
 * - id: review ID to delete
 *
 * Authentication: Admin only (service role key)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get('id');

    if (!reviewId) {
      return NextResponse.json(
        { error: 'Review ID is required' },
        { status: 400 }
      );
    }

    // Soft delete by setting status to 'hidden'
    const { error: updateError } = await supabaseAdmin
      .from('reviews')
      .update({
        status: 'hidden',
        is_published: false,
      })
      .eq('id', reviewId);

    if (updateError) {
      console.error('Error hiding review:', updateError);
      return NextResponse.json(
        { error: 'Failed to hide review' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Review hidden successfully',
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/reviews:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
