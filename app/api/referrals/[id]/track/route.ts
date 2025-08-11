import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

const supabaseService = new SupabaseService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { event_type, event_data } = body;

    // Validate event type
    const validEventTypes = ['qr_scan', 'email_open', 'link_click', 'page_view', 'order_start', 'order_complete', 'signup_complete'];
    if (!validEventTypes.includes(event_type)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // Track the event
    await supabaseService.trackReferralEvent(id, event_type, event_data);

    // Update referral status based on event
    if (event_type === 'page_view' || event_type === 'qr_scan') {
      const referral = await supabaseService.getReferral(id);
      if (referral && referral.status === 'invited') {
        await supabaseService.updateReferral(id, { 
          status: 'accessed',
          last_viewed_at: new Date().toISOString()
        });
      }
    } else if (event_type === 'link_click') {
      const referral = await supabaseService.getReferral(id);
      if (referral && ['invited', 'accessed'].includes(referral.status)) {
        await supabaseService.updateReferral(id, { 
          status: 'accessed',
          last_viewed_at: new Date().toISOString()
        });
      }
    } else if (event_type === 'signup_complete') {
      const referral = await supabaseService.getReferral(id);
      if (referral && ['invited', 'accessed', 'accepted'].includes(referral.status)) {
        await supabaseService.updateReferral(id, { 
          status: 'accepted',
          last_viewed_at: new Date().toISOString()
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking referral event:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}