// =====================================================
// MESSAGE QUEUE SERVICE
// =====================================================
// Manages message queue operations (enqueue, process, retry)
// NOTE: Architectural violations temporarily allowed - parked feature pending external API setup

/* eslint-disable no-restricted-imports */
/* eslint-disable no-restricted-syntax */

import { createClient } from '@supabase/supabase-js';
import type {
  MessageQueue,
  MessageQueueCreate,
  MessageQueueUpdate,
  MessageChannel,
  UserType,
  MessagePriority,
  UserMessage,
  UserMessageCreate,
} from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role client to bypass RLS
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Add a message to the queue
 *
 * @param params - Message parameters
 * @returns Created message queue entry
 */
export async function enqueueMessage(params: {
  templateKey: string;
  recipientType: UserType;
  recipientId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channel: MessageChannel;
  subject?: string;
  body: string;
  inboxTitle?: string;
  inboxActionUrl?: string;
  inboxActionLabel?: string;
  inboxIcon?: string;
  variables?: Record<string, any>;
  priority?: MessagePriority;
  scheduledFor?: Date | string;
  metadata?: Record<string, any>;
}): Promise<{ data: MessageQueue | null; error: any }> {
  const message: Omit<MessageQueue, 'id' | 'created_at' | 'updated_at'> = {
    template_key: params.templateKey,
    recipient_type: params.recipientType,
    recipient_id: params.recipientId,
    recipient_email: params.recipientEmail,
    recipient_phone: params.recipientPhone,
    channel: params.channel,
    subject: params.subject,
    body: params.body,
    inbox_title: params.inboxTitle,
    inbox_action_url: params.inboxActionUrl,
    inbox_action_label: params.inboxActionLabel,
    inbox_icon: params.inboxIcon,
    variables: params.variables || {},
    status: 'pending',
    priority: params.priority || 'normal',
    scheduled_for: params.scheduledFor
      ? new Date(params.scheduledFor).toISOString()
      : new Date().toISOString(),
    retry_count: 0,
    max_retries: 3,
    metadata: params.metadata || {},
  };

  const { data, error } = await supabase
    .from('message_queue')
    .insert(message)
    .select()
    .single();

  if (error) {
    console.error('Failed to enqueue message:', error);
  } else {
    console.log(`✅ Message enqueued: ${data.id} (${data.channel})`);
  }

  return { data, error };
}

/**
 * Get pending messages from queue
 *
 * @param limit - Maximum number of messages to fetch
 * @returns Array of pending messages
 */
export async function getPendingMessages(
  limit: number = 100
): Promise<{ data: MessageQueue[]; error: any }> {
  const { data, error } = await supabase
    .from('message_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);

  return { data: data || [], error };
}

/**
 * Update message queue status
 *
 * @param messageId - Message queue ID
 * @param update - Update data
 * @returns Updated message
 */
export async function updateMessageStatus(
  messageId: string,
  update: MessageQueueUpdate
): Promise<{ data: MessageQueue | null; error: any }> {
  const { data, error } = await supabase
    .from('message_queue')
    .update({
      ...update,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .select()
    .single();

  return { data, error };
}

/**
 * Mark message as sent
 *
 * @param messageId - Message queue ID
 * @param providerMessageId - External provider's message ID
 * @returns Updated message
 */
export async function markMessageSent(
  messageId: string,
  providerMessageId?: string
): Promise<{ data: MessageQueue | null; error: any }> {
  return updateMessageStatus(messageId, {
    status: 'sent',
    sent_at: new Date().toISOString(),
    provider_message_id: providerMessageId,
  });
}

/**
 * Mark message as failed
 *
 * @param messageId - Message queue ID
 * @param errorMessage - Error description
 * @param shouldRetry - Whether to schedule retry
 * @returns Updated message
 */
export async function markMessageFailed(
  messageId: string,
  errorMessage: string,
  shouldRetry: boolean = true
): Promise<{ data: MessageQueue | null; error: any }> {
  // Get current message to check retry count
  const { data: currentMessage } = await supabase
    .from('message_queue')
    .select('retry_count, max_retries')
    .eq('id', messageId)
    .single();

  if (!currentMessage) {
    return { data: null, error: new Error('Message not found') };
  }

  const newRetryCount = (currentMessage.retry_count || 0) + 1;
  const canRetry = shouldRetry && newRetryCount < (currentMessage.max_retries || 3);

  if (canRetry) {
    // Exponential backoff: 2^retry_count minutes
    const delayMinutes = Math.pow(2, newRetryCount);
    const nextScheduled = new Date(Date.now() + delayMinutes * 60000);

    console.log(`⏰ Scheduling retry ${newRetryCount} in ${delayMinutes} minutes for message ${messageId}`);

    return updateMessageStatus(messageId, {
      retry_count: newRetryCount,
      error_message: errorMessage,
      status: 'pending', // Keep as pending for retry
      scheduled_for: nextScheduled.toISOString(),
    });
  } else {
    console.log(`❌ Message ${messageId} failed permanently after ${newRetryCount} attempts`);

    return updateMessageStatus(messageId, {
      status: 'failed',
      failed_at: new Date().toISOString(),
      error_message: errorMessage,
      retry_count: newRetryCount,
    });
  }
}

/**
 * Create inbox message for user
 *
 * @param params - Inbox message parameters
 * @returns Created inbox message
 */
export async function createInboxMessage(params: {
  userType: UserType;
  userId: string;
  messageType: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  icon?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date | string;
}): Promise<{ data: UserMessage | null; error: any }> {
  const message: UserMessageCreate = {
    user_type: params.userType,
    user_id: params.userId,
    message_type: params.messageType,
    title: params.title,
    body: params.body,
    action_url: params.actionUrl,
    action_label: params.actionLabel,
    icon: params.icon,
    metadata: params.metadata || {},
    expires_at: params.expiresAt
      ? new Date(params.expiresAt).toISOString()
      : undefined,
  };

  const { data, error } = await supabase
    .from('user_messages')
    .insert(message)
    .select()
    .single();

  if (error) {
    console.error('Failed to create inbox message:', error);
  } else {
    console.log(`📬 Inbox message created for ${params.userType} ${params.userId}`);
  }

  return { data, error };
}

/**
 * Get message queue statistics
 *
 * @returns Queue statistics
 */
export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  processing: number;
  sent: number;
  failed: number;
}> {
  const { data } = await supabase
    .from('message_queue')
    .select('status');

  const stats = {
    total: data?.length || 0,
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
  };

  data?.forEach((msg: any) => {
    if (msg.status in stats) {
      stats[msg.status as keyof typeof stats]++;
    }
  });

  return stats;
}

/**
 * Archive old messages to delivery log
 * Moves messages older than 7 days from queue to delivery log
 *
 * @returns Number of messages archived
 */
export async function archiveOldMessages(): Promise<number> {
  const { data, error } = await supabase.rpc('archive_sent_messages');

  if (error) {
    console.error('Failed to archive messages:', error);
    return 0;
  }

  console.log(`📦 Archived ${data} old messages to delivery log`);
  return data || 0;
}

/**
 * Clean up old delivery logs
 * Deletes logs older than 90 days (GDPR compliance)
 *
 * @returns Number of logs deleted
 */
export async function cleanupOldLogs(): Promise<number> {
  const { data, error } = await supabase.rpc('cleanup_old_delivery_logs');

  if (error) {
    console.error('Failed to cleanup delivery logs:', error);
    return 0;
  }

  console.log(`🗑️ Deleted ${data} old delivery logs (90+ days)`);
  return data || 0;
}
