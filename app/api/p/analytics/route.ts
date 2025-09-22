import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Use service role key for analytics
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const body = await request.json();
    const { code_id, event_type, metadata } = body;

    if (!code_id || !event_type) {
      return NextResponse.json({ error: 'Code ID and event type are required' }, { status: 400 });
    }

    // Try to record analytics event in pre_registration_analytics table if it exists
    // If table doesn't exist, just succeed silently
    try {
      const { error } = await supabase
        .from('pre_registration_analytics')
        .insert({
          code_id: code_id,
          event_type: event_type,
          metadata: metadata || {},
          ip_address: request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Analytics table insert failed:', error);
        // Continue without failing - analytics is optional
      }
    } catch (analyticsError) {
      console.error('Analytics recording failed (table may not exist):', analyticsError);
      // Continue without failing - analytics is optional
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics recording error:', error);
    // Return success even if analytics fails to prevent client errors
    return NextResponse.json({ success: true });
  }
}