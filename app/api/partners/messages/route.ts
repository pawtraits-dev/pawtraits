// =====================================================
// PARTNER MESSAGES API
// =====================================================
// Manages partner inbox messages

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/partners/messages
 * Fetch partner's inbox messages
 *
 * Query params:
 * - unread_only: boolean (filter to unread messages)
 * - limit: number (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get authenticated user from email query param
    const partnerEmail = searchParams.get('email');

    if (!partnerEmail) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      );
    }

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user profile to get user_id
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, user_type')
      .eq('email', partnerEmail)
      .eq('user_type', 'partner')
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'Partner profile not found' },
        { status: 404 }
      );
    }

    // Build query
    let query = supabase
      .from('user_messages')
      .select('*')
      .eq('user_type', 'partner')
      .eq('user_id', userProfile.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by unread if requested
    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('Failed to fetch partner messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('user_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_type', 'partner')
      .eq('user_id', userProfile.id)
      .eq('is_read', false)
      .eq('is_archived', false);

    return NextResponse.json({
      success: true,
      messages: messages || [],
      unread_count: unreadCount || 0,
    });
  } catch (error) {
    console.error('Error fetching partner messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/partners/messages
 * Mark message as read or archive
 *
 * Body:
 * - message_id: string
 * - action: 'mark_read' | 'archive'
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { message_id, action, email } = body;

    if (!message_id || !action || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: message_id, action, email' },
        { status: 400 }
      );
    }

    // Use service role client
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify user owns this message
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .eq('user_type', 'partner')
      .single();

    if (!userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: message } = await supabase
      .from('user_messages')
      .select('id, user_id')
      .eq('id', message_id)
      .single();

    if (!message || message.user_id !== userProfile.id) {
      return NextResponse.json(
        { error: 'Message not found or unauthorized' },
        { status: 404 }
      );
    }

    // Perform action
    let updateData: any = {};

    if (action === 'mark_read') {
      updateData = {
        is_read: true,
        read_at: new Date().toISOString(),
      };
    } else if (action === 'archive') {
      updateData = {
        is_archived: true,
        archived_at: new Date().toISOString(),
      };
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const { data: updatedMessage, error: updateError } = await supabase
      .from('user_messages')
      .update(updateData)
      .eq('id', message_id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update message:', updateError);
      return NextResponse.json(
        { error: 'Failed to update message' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: updatedMessage,
    });
  } catch (error) {
    console.error('Error updating partner message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
