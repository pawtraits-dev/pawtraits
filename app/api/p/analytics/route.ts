import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabaseService = new SupabaseService();
    const body = await request.json();
    const { code_id, event_type, metadata } = body;

    if (!code_id || !event_type) {
      return NextResponse.json({ error: 'Code ID and event type are required' }, { status: 400 });
    }

    // Record analytics event (using database function for proper handling)
    const { error } = await supabaseService.getClient()
      .rpc('record_pre_registration_analytics', {
        p_code_id: code_id,
        p_event_type: event_type,
        p_metadata: metadata || {},
        p_ip_address: request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown',
        p_user_agent: request.headers.get('user-agent') || 'unknown'
      });

    if (error) {
      console.error('Failed to record pre-registration analytics:', error);
      // Don't fail the request if analytics fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics recording error:', error);
    // Return success even if analytics fails to prevent client errors
    return NextResponse.json({ success: true });
  }
}