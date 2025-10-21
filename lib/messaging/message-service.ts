// =====================================================
// MESSAGE SERVICE - MAIN ORCHESTRATOR
// =====================================================
// High-level service for sending messages across all channels
// NOTE: Architectural violations temporarily allowed - parked feature pending external API setup

/* eslint-disable no-restricted-imports */
/* eslint-disable no-restricted-syntax */

import { createClient } from '@supabase/supabase-js';
import { renderTemplate } from './template-engine';
import { sendEmail } from './providers/email-provider';
import { sendSMS } from './providers/sms-provider';
import {
  enqueueMessage,
  getPendingMessages,
  markMessageSent,
  markMessageFailed,
  createInboxMessage,
} from './message-queue';
import type {
  EnqueueMessageParams,
  MessageTemplate,
  ProcessQueueResult,
  UserType,
  MessageChannel,
} from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Send a message using a template
 * This is the main entry point for sending messages
 *
 * @param params - Message parameters with template key and variables
 * @returns Result of message enqueueing
 *
 * @example
 * ```typescript
 * await sendMessage({
 *   templateKey: 'order_confirmation',
 *   recipientType: 'customer',
 *   recipientId: customerId,
 *   recipientEmail: 'customer@example.com',
 *   variables: {
 *     customer_name: 'John Doe',
 *     order_number: 'ORD-12345',
 *     total_amount: 4999
 *   },
 *   priority: 'high'
 * });
 * ```
 */
export async function sendMessage(params: EnqueueMessageParams): Promise<{
  success: boolean;
  messageIds: string[];
  errors: string[];
}> {
  try {
    // Get template
    const { data: template, error: templateError } = await supabase
      .from('message_templates')
      .select('*')
      .eq('template_key', params.templateKey)
      .eq('is_active', true)
      .single<MessageTemplate>();

    if (templateError || !template) {
      throw new Error(`Template not found: ${params.templateKey}`);
    }

    // Check if template is enabled for this user type
    if (!template.user_types.includes(params.recipientType)) {
      throw new Error(`Template ${params.templateKey} not available for ${params.recipientType}`);
    }

    // TODO: Check user preferences (implement in Phase 4)
    // For now, we'll send to all channels defined in the template

    const messageIds: string[] = [];
    const errors: string[] = [];

    // Send to each channel defined in template
    for (const channel of template.channels) {
      try {
        let renderedBody = '';
        let renderedSubject: string | undefined;
        let renderedTitle: string | undefined;

        // Render templates based on channel
        if (channel === 'email' && template.email_body_template) {
          renderedBody = renderTemplate(template.email_body_template, params.variables);
          if (template.email_subject_template) {
            renderedSubject = renderTemplate(template.email_subject_template, params.variables);
          }
        } else if (channel === 'sms' && template.sms_body_template) {
          renderedBody = renderTemplate(template.sms_body_template, params.variables);
        } else if (channel === 'inbox' && template.inbox_body_template) {
          renderedBody = renderTemplate(template.inbox_body_template, params.variables);
          if (template.inbox_title_template) {
            renderedTitle = renderTemplate(template.inbox_title_template, params.variables);
          }
        } else {
          // Channel not configured for this template
          continue;
        }

        // Validate recipient information based on channel
        if (channel === 'email' && !params.recipientEmail) {
          errors.push(`Email channel requires recipientEmail`);
          continue;
        }
        if (channel === 'sms' && !params.recipientPhone) {
          errors.push(`SMS channel requires recipientPhone`);
          continue;
        }
        if (channel === 'inbox' && !params.recipientId) {
          errors.push(`Inbox channel requires recipientId`);
          continue;
        }

        // Enqueue message
        const { data: queuedMessage, error: enqueueError } = await enqueueMessage({
          templateKey: params.templateKey,
          recipientType: params.recipientType,
          recipientId: params.recipientId,
          recipientEmail: params.recipientEmail,
          recipientPhone: params.recipientPhone,
          channel,
          subject: renderedSubject,
          body: renderedBody,
          inboxTitle: renderedTitle,
          inboxActionUrl: template.inbox_action_url
            ? renderTemplate(template.inbox_action_url, params.variables)
            : undefined,
          inboxActionLabel: template.inbox_action_label,
          inboxIcon: template.inbox_icon,
          variables: params.variables,
          priority: params.priority || template.priority,
          scheduledFor: params.scheduledFor,
          metadata: params.metadata,
        });

        if (enqueueError) {
          errors.push(`Failed to enqueue ${channel} message: ${enqueueError.message}`);
        } else if (queuedMessage) {
          messageIds.push(queuedMessage.id);
        }
      } catch (channelError) {
        const error = channelError instanceof Error ? channelError.message : 'Unknown error';
        errors.push(`Channel ${channel} error: ${error}`);
      }
    }

    return {
      success: messageIds.length > 0,
      messageIds,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Send message failed:', errorMessage);
    return {
      success: false,
      messageIds: [],
      errors: [errorMessage],
    };
  }
}

/**
 * Process message queue
 * Called by cron job to send pending messages
 *
 * @param batchSize - Number of messages to process
 * @returns Processing results
 */
export async function processMessageQueue(
  batchSize: number = 100
): Promise<ProcessQueueResult> {
  console.log(`🔄 Processing message queue (batch size: ${batchSize})`);

  const result: ProcessQueueResult = {
    processed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Get pending messages
    const { data: messages, error: fetchError } = await getPendingMessages(batchSize);

    if (fetchError) {
      throw new Error(`Failed to fetch messages: ${fetchError.message}`);
    }

    if (!messages || messages.length === 0) {
      console.log('📭 No pending messages in queue');
      return result;
    }

    console.log(`📬 Found ${messages.length} pending messages`);

    // Process each message
    for (const message of messages) {
      try {
        // Mark as processing
        await supabase
          .from('message_queue')
          .update({ status: 'processing' })
          .eq('id', message.id);

        // Send based on channel
        if (message.channel === 'email') {
          const emailResult = await sendEmail({
            to: message.recipient_email!,
            subject: message.subject!,
            html: message.body,
            tags: [
              { name: 'template_key', value: message.template_key },
              { name: 'recipient_type', value: message.recipient_type },
            ],
            metadata: message.metadata,
          });

          if (emailResult.success) {
            await markMessageSent(message.id, emailResult.messageId);
            result.processed++;
          } else {
            await markMessageFailed(message.id, emailResult.error || 'Email send failed');
            result.failed++;
            result.errors.push({
              messageId: message.id,
              error: emailResult.error || 'Email send failed',
            });
          }
        } else if (message.channel === 'sms') {
          const smsResult = await sendSMS({
            to: message.recipient_phone!,
            body: message.body,
            metadata: message.metadata,
          });

          if (smsResult.success) {
            await markMessageSent(message.id, smsResult.messageId);
            result.processed++;
          } else {
            await markMessageFailed(message.id, smsResult.error || 'SMS send failed');
            result.failed++;
            result.errors.push({
              messageId: message.id,
              error: smsResult.error || 'SMS send failed',
            });
          }
        } else if (message.channel === 'inbox') {
          const inboxResult = await createInboxMessage({
            userType: message.recipient_type,
            userId: message.recipient_id!,
            messageType: message.template_key,
            title: message.inbox_title!,
            body: message.body,
            actionUrl: message.inbox_action_url,
            actionLabel: message.inbox_action_label,
            icon: message.inbox_icon,
            metadata: message.metadata,
          });

          if (inboxResult.error) {
            await markMessageFailed(message.id, inboxResult.error.message);
            result.failed++;
            result.errors.push({
              messageId: message.id,
              error: inboxResult.error.message,
            });
          } else {
            await markMessageSent(message.id, inboxResult.data?.id);
            result.processed++;
          }
        } else {
          // Unknown channel
          await markMessageFailed(message.id, `Unknown channel: ${message.channel}`, false);
          result.skipped++;
        }
      } catch (messageError) {
        const error = messageError instanceof Error ? messageError.message : 'Unknown error';
        console.error(`Error processing message ${message.id}:`, error);
        await markMessageFailed(message.id, error);
        result.failed++;
        result.errors.push({
          messageId: message.id,
          error,
        });
      }
    }

    console.log(`✅ Queue processing complete:`, result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Queue processing failed:', errorMessage);
    result.errors.push({
      messageId: 'N/A',
      error: errorMessage,
    });
    return result;
  }
}

/**
 * Send message immediately (bypass queue)
 * Use sparingly - mostly for testing or critical messages
 *
 * @param channel - Channel to send on
 * @param recipient - Recipient details
 * @param content - Message content
 * @returns Send result
 */
export async function sendMessageImmediate(params: {
  channel: MessageChannel;
  recipientEmail?: string;
  recipientPhone?: string;
  subject?: string;
  body: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (params.channel === 'email' && params.recipientEmail) {
      return await sendEmail({
        to: params.recipientEmail,
        subject: params.subject || 'Message from Pawtraits',
        html: params.body,
      });
    } else if (params.channel === 'sms' && params.recipientPhone) {
      return await sendSMS({
        to: params.recipientPhone,
        body: params.body,
      });
    } else {
      return {
        success: false,
        error: 'Invalid channel or missing recipient information',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
