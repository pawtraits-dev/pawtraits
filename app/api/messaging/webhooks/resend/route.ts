// =====================================================
// RESEND WEBHOOK HANDLER
// =====================================================
// Handles delivery status updates from Resend

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * POST /api/messaging/webhooks/resend
 * Webhook endpoint for Resend email delivery events
 *
 * Resend sends webhooks for these events:
 * - email.sent: Email was accepted by recipient's mail server
 * - email.delivered: Email was successfully delivered
 * - email.bounced: Email bounced (hard or soft)
 * - email.complained: Recipient marked email as spam
 * - email.opened: Email was opened by recipient
 * - email.clicked: Link in email was clicked
 *
 * Configure in Resend dashboard: https://resend.com/webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('📧 Resend webhook received:', body.type);

    // Extract event data
    const eventType = body.type;
    const emailId = body.data?.email_id;
    const timestamp = body.created_at;

    if (!emailId) {
      console.error('No email ID in webhook payload');
      return NextResponse.json({ received: true });
    }

    // Find message in queue by provider message ID
    const { data: messages } = await supabase
      .from('message_queue')
      .select('*')
      .eq('provider_message_id', emailId)
      .eq('channel', 'email');

    if (!messages || messages.length === 0) {
      console.log(`No message found for email ID: ${emailId}`);
      return NextResponse.json({ received: true });
    }

    const message = messages[0];

    // Log event
    await supabase.from('message_events').insert({
      message_queue_id: message.id,
      event_type: mapResendEventType(eventType),
      event_data: body.data || {},
      event_timestamp: timestamp,
    });

    // Update message status based on event type
    if (eventType === 'email.bounced' || eventType === 'email.complained') {
      await supabase
        .from('message_queue')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_message: `Email ${eventType}: ${body.data?.reason || 'Unknown reason'}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', message.id);

      console.log(`❌ Email ${eventType} for message ${message.id}`);
    } else if (eventType === 'email.delivered') {
      // Mark as successfully delivered
      await supabase
        .from('message_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', message.id);

      console.log(`✅ Email delivered for message ${message.id}`);
    }

    return NextResponse.json({
      received: true,
      messageId: message.id,
      eventType,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Resend webhook error:', errorMessage);

    // Always return 200 to prevent webhook retries
    return NextResponse.json({
      received: true,
      error: errorMessage,
    });
  }
}

/**
 * Map Resend event types to our internal event types
 */
function mapResendEventType(resendType: string): string {
  const mapping: Record<string, string> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.bounced': 'bounced',
    'email.complained': 'bounced',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
  };

  return mapping[resendType] || resendType;
}

/**
 * GET /api/messaging/webhooks/resend
 * Webhook configuration info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/messaging/webhooks/resend',
    method: 'POST',
    description: 'Webhook endpoint for Resend email delivery events',
    supportedEvents: [
      'email.sent',
      'email.delivered',
      'email.bounced',
      'email.complained',
      'email.opened',
      'email.clicked',
    ],
    configuration: {
      url: `${process.env.VERCEL_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/messaging/webhooks/resend`,
      instructions: 'Configure this URL in Resend dashboard: https://resend.com/webhooks',
    },
  });
}
