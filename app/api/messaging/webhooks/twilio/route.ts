// =====================================================
// TWILIO WEBHOOK HANDLER
// =====================================================
// Handles SMS delivery status updates from Twilio

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
 * POST /api/messaging/webhooks/twilio
 * Webhook endpoint for Twilio SMS status callbacks
 *
 * Twilio sends status callbacks for these message statuses:
 * - queued: Message queued in Twilio
 * - sent: Message sent to carrier
 * - delivered: Message delivered to recipient
 * - undelivered: Message failed to deliver
 * - failed: Message failed to send
 *
 * Configure in Twilio when sending message via statusCallback parameter
 * (already configured in sms-provider.ts)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data (Twilio sends as application/x-www-form-urlencoded)
    const formData = await request.formData();
    const body: Record<string, string> = {};

    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    console.log('📱 Twilio webhook received:', body.MessageStatus);

    // Extract event data
    const messageSid = body.MessageSid;
    const messageStatus = body.MessageStatus;
    const errorCode = body.ErrorCode;
    const errorMessage = body.ErrorMessage;

    if (!messageSid) {
      console.error('No message SID in webhook payload');
      return NextResponse.json({ received: true });
    }

    // Find message in queue by provider message ID
    const { data: messages } = await supabase
      .from('message_queue')
      .select('*')
      .eq('provider_message_id', messageSid)
      .eq('channel', 'sms');

    if (!messages || messages.length === 0) {
      console.log(`No message found for SID: ${messageSid}`);
      return NextResponse.json({ received: true });
    }

    const message = messages[0];

    // Log event
    await supabase.from('message_events').insert({
      message_queue_id: message.id,
      event_type: mapTwilioStatus(messageStatus),
      event_data: body,
      event_timestamp: new Date().toISOString(),
    });

    // Update message status based on Twilio status
    if (messageStatus === 'delivered') {
      await supabase
        .from('message_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', message.id);

      console.log(`✅ SMS delivered for message ${message.id}`);
    } else if (messageStatus === 'undelivered' || messageStatus === 'failed') {
      await supabase
        .from('message_queue')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_message: errorMessage
            ? `Twilio error ${errorCode}: ${errorMessage}`
            : `SMS ${messageStatus}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', message.id);

      console.log(`❌ SMS ${messageStatus} for message ${message.id}`);
    } else if (messageStatus === 'sent') {
      // Update to processing status (sent to carrier, awaiting delivery)
      await supabase
        .from('message_queue')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', message.id);

      console.log(`📤 SMS sent to carrier for message ${message.id}`);
    }

    return NextResponse.json({
      received: true,
      messageId: message.id,
      status: messageStatus,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Twilio webhook error:', errorMessage);

    // Always return 200 to prevent webhook retries
    return NextResponse.json({
      received: true,
      error: errorMessage,
    });
  }
}

/**
 * Map Twilio status to our internal event types
 */
function mapTwilioStatus(twilioStatus: string): string {
  const mapping: Record<string, string> = {
    queued: 'queued',
    sent: 'sent',
    delivered: 'delivered',
    undelivered: 'failed',
    failed: 'failed',
  };

  return mapping[twilioStatus] || twilioStatus;
}

/**
 * GET /api/messaging/webhooks/twilio
 * Webhook configuration info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/messaging/webhooks/twilio',
    method: 'POST',
    description: 'Webhook endpoint for Twilio SMS status callbacks',
    supportedStatuses: ['queued', 'sent', 'delivered', 'undelivered', 'failed'],
    configuration: {
      url: `${process.env.VERCEL_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/messaging/webhooks/twilio`,
      instructions:
        'This URL is automatically configured in sms-provider.ts as statusCallback parameter',
    },
  });
}
