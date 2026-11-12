// =====================================================
// MESSAGE QUEUE PROCESSOR API ENDPOINT
// =====================================================
// Cron job endpoint for processing pending messages in the queue

import { NextResponse } from 'next/server';
import { getPendingMessages, updateMessageStatus } from '@/lib/messaging/message-queue';
import { sendEmail } from '@/lib/messaging/providers/email-provider';
import { sendSMS } from '@/lib/messaging/providers/sms-provider';
import { createInboxMessage } from '@/lib/messaging/message-queue';
import { getQueueStats } from '@/lib/messaging/message-queue';
import { requireAdmin } from '@/lib/qr/server';

/**
 * POST /api/messaging/process
 * Process pending messages in the queue
 *
 * This is called automatically by Vercel Cron every minute
 * Can also be triggered manually from admin panel
 */
export async function POST(request: Request) {
  try {
    // Allow the cron secret; anything else must be a signed-in admin (manual trigger from admin panel)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isVercelCron) {
      const denied = await requireAdmin();
      if (denied) return denied;
    }

    const { limit = 100 } = await request.json().catch(() => ({}));

    console.log('🔄 Starting message queue processing...');

    // Get pending messages
    const { data: messages, error: fetchError } = await getPendingMessages(limit);

    if (fetchError) {
      console.error('Failed to fetch pending messages:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch pending messages' },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      console.log('✅ No pending messages to process');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No pending messages',
      });
    }

    console.log(`📧 Processing ${messages.length} pending messages...`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each message
    for (const message of messages) {
      try {
        results.processed++;

        // Mark as processing
        await updateMessageStatus(message.id, { status: 'processing' });

        // Process based on channel
        switch (message.channel) {
          case 'email':
            if (!message.recipient_email || !message.subject || !message.body) {
              throw new Error('Missing required email fields');
            }

            const emailResult = await sendEmail({
              to: message.recipient_email,
              subject: message.subject,
              html: message.body,
              metadata: message.metadata,
            });

            if (!emailResult.success) {
              throw new Error(emailResult.error || 'Email sending failed');
            }

            await updateMessageStatus(message.id, {
              status: 'sent',
              sent_at: new Date().toISOString(),
              provider_message_id: emailResult.messageId,
            });

            results.sent++;
            console.log(`✅ Email sent: ${message.id}`);
            break;

          case 'sms':
            if (!message.recipient_phone || !message.body) {
              throw new Error('Missing required SMS fields');
            }

            const smsResult = await sendSMS({
              to: message.recipient_phone,
              body: message.body,
              metadata: message.metadata,
            });

            if (!smsResult.success) {
              throw new Error(smsResult.error || 'SMS sending failed');
            }

            await updateMessageStatus(message.id, {
              status: 'sent',
              sent_at: new Date().toISOString(),
              provider_message_id: smsResult.messageId,
            });

            results.sent++;
            console.log(`✅ SMS sent: ${message.id}`);
            break;

          case 'inbox':
            if (!message.recipient_id || !message.inbox_title || !message.body) {
              throw new Error('Missing required inbox fields');
            }

            const inboxResult = await createInboxMessage({
              userType: message.recipient_type,
              userId: message.recipient_id,
              messageType: message.template_key,
              title: message.inbox_title,
              body: message.body,
              actionUrl: message.inbox_action_url,
              actionLabel: message.inbox_action_label,
              icon: message.inbox_icon,
              metadata: message.metadata,
            });

            if (inboxResult.error) {
              throw new Error(inboxResult.error.message || 'Inbox message creation failed');
            }

            await updateMessageStatus(message.id, {
              status: 'sent',
              sent_at: new Date().toISOString(),
            });

            results.sent++;
            console.log(`✅ Inbox message created: ${message.id}`);
            break;

          default:
            throw new Error(`Unsupported channel: ${message.channel}`);
        }
      } catch (error) {
        console.error(`❌ Failed to process message ${message.id}:`, error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed++;
        results.errors.push(`${message.id}: ${errorMessage}`);

        // Mark as failed (will retry if applicable)
        await updateMessageStatus(message.id, {
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_message: errorMessage,
          retry_count: (message.retry_count || 0) + 1,
        });
      }
    }

    console.log(`✅ Processing complete: ${results.sent} sent, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Message queue processing failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Processing failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/messaging/process
 * Vercel cron uses GET by default, so we process on GET as well
 * Also allows checking queue stats
 */
export async function GET(request: Request) {
  try {
    // Check if this is a cron trigger
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

    // Vercel cron calls this handler (GET). If CRON_SECRET is not set, keep processing
    // for any caller so email delivery does not stop - set CRON_SECRET to close this.
    if (!cronSecret) {
      console.warn('CRON_SECRET is not set - /api/messaging/process (GET) is processing the queue without authentication');
    }
    const allowProcessing = isVercelCron || !cronSecret;

    // Not the cron: only admins may read queue stats
    if (!allowProcessing) {
      const denied = await requireAdmin();
      if (denied) return denied;
    }

    // If it's a cron call, process the queue
    if (allowProcessing) {
      console.log('🔄 Cron triggered - processing queue via GET...');

      // Get pending messages
      const { data: messages, error: fetchError } = await getPendingMessages(100);

      if (fetchError || !messages || messages.length === 0) {
        console.log('✅ No pending messages to process');
        return NextResponse.json({
          success: true,
          processed: 0,
          message: 'No pending messages',
        });
      }

      console.log(`📧 Processing ${messages.length} pending messages...`);

      const results = {
        processed: 0,
        sent: 0,
        failed: 0,
        errors: [] as string[],
      };

      // Process each message
      for (const message of messages) {
        try {
          results.processed++;
          await updateMessageStatus(message.id, { status: 'processing' });

          switch (message.channel) {
            case 'email':
              if (!message.recipient_email || !message.subject || !message.body) {
                throw new Error('Missing required email fields');
              }

              const emailResult = await sendEmail({
                to: message.recipient_email,
                subject: message.subject,
                html: message.body,
                metadata: message.metadata,
              });

              if (!emailResult.success) {
                throw new Error(emailResult.error || 'Email sending failed');
              }

              await updateMessageStatus(message.id, {
                status: 'sent',
                sent_at: new Date().toISOString(),
                provider_message_id: emailResult.messageId,
              });

              results.sent++;
              console.log(`✅ Email sent: ${message.id}`);
              break;

            case 'sms':
              if (!message.recipient_phone || !message.body) {
                throw new Error('Missing required SMS fields');
              }

              const smsResult = await sendSMS({
                to: message.recipient_phone,
                body: message.body,
                metadata: message.metadata,
              });

              if (!smsResult.success) {
                throw new Error(smsResult.error || 'SMS sending failed');
              }

              await updateMessageStatus(message.id, {
                status: 'sent',
                sent_at: new Date().toISOString(),
                provider_message_id: smsResult.messageId,
              });

              results.sent++;
              console.log(`✅ SMS sent: ${message.id}`);
              break;

            case 'inbox':
              if (!message.recipient_id || !message.inbox_title || !message.body) {
                throw new Error('Missing required inbox fields');
              }

              const inboxResult = await createInboxMessage({
                userType: message.recipient_type,
                userId: message.recipient_id,
                messageType: message.template_key,
                title: message.inbox_title,
                body: message.body,
                actionUrl: message.inbox_action_url,
                actionLabel: message.inbox_action_label,
                icon: message.inbox_icon,
                metadata: message.metadata,
              });

              if (inboxResult.error) {
                throw new Error(inboxResult.error.message || 'Inbox message creation failed');
              }

              await updateMessageStatus(message.id, {
                status: 'sent',
                sent_at: new Date().toISOString(),
              });

              results.sent++;
              console.log(`✅ Inbox message created: ${message.id}`);
              break;

            default:
              throw new Error(`Unsupported channel: ${message.channel}`);
          }
        } catch (error) {
          console.error(`❌ Failed to process message ${message.id}:`, error);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.failed++;
          results.errors.push(`${message.id}: ${errorMessage}`);

          await updateMessageStatus(message.id, {
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_message: errorMessage,
            retry_count: (message.retry_count || 0) + 1,
          });
        }
      }

      console.log(`✅ Processing complete: ${results.sent} sent, ${results.failed} failed`);

      return NextResponse.json({
        success: true,
        ...results,
      });
    }

    // Otherwise, just return stats
    const stats = await getQueueStats();

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get stats',
      },
      { status: 500 }
    );
  }
}
