// =====================================================
// PAWTRAITS MESSAGING SYSTEM - TYPESCRIPT TYPES
// =====================================================

export type MessageChannel = 'email' | 'sms' | 'inbox';
export type MessageCategory = 'transactional' | 'operational' | 'marketing';
export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';
export type MessageStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
export type UserType = 'customer' | 'partner' | 'influencer' | 'admin';
export type MessageEventType = 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'read' | 'archived';

// =====================================================
// MESSAGE TEMPLATES
// =====================================================

export interface MessageTemplate {
  id: string;
  template_key: string;
  name: string;
  description?: string;
  category: MessageCategory;
  channels: MessageChannel[];
  user_types: UserType[];

  // Email template
  email_subject_template?: string;
  email_body_template?: string;

  // SMS template
  sms_body_template?: string;

  // Inbox template
  inbox_title_template?: string;
  inbox_body_template?: string;
  inbox_action_url?: string;
  inbox_action_label?: string;
  inbox_icon?: string;

  // Metadata
  variables: Record<string, TemplateVariable>;
  is_active: boolean;
  can_be_disabled: boolean;
  default_enabled: boolean;
  priority: MessagePriority;

  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  example?: string;
  type?: 'string' | 'number' | 'boolean' | 'date' | 'url' | 'currency';
}

export type MessageTemplateCreate = Omit<MessageTemplate, 'id' | 'created_at' | 'updated_at'>;
export type MessageTemplateUpdate = Partial<MessageTemplateCreate>;

// =====================================================
// MESSAGE QUEUE
// =====================================================

export interface MessageQueue {
  id: string;
  template_key: string;
  recipient_type: UserType;
  recipient_id?: string;
  recipient_email?: string;
  recipient_phone?: string;
  channel: MessageChannel;

  // Rendered content
  subject?: string;
  body: string;

  // Inbox-specific
  inbox_title?: string;
  inbox_action_url?: string;
  inbox_action_label?: string;
  inbox_icon?: string;

  // Template variables
  variables: Record<string, any>;

  // Queue management
  status: MessageStatus;
  priority: MessagePriority;
  scheduled_for: string;
  sent_at?: string;
  failed_at?: string;
  retry_count: number;
  max_retries: number;
  error_message?: string;
  provider_message_id?: string;

  // Metadata
  metadata: Record<string, any>;

  created_at: string;
  updated_at: string;
}

export interface EnqueueMessageParams {
  templateKey: string;
  recipientType: UserType;
  recipientId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  variables: Record<string, any>;
  scheduledFor?: Date | string;
  priority?: MessagePriority;
  metadata?: Record<string, any>;
}

export type MessageQueueCreate = Omit<MessageQueue, 'id' | 'created_at' | 'updated_at' | 'status' | 'retry_count'>;
export type MessageQueueUpdate = Partial<Pick<MessageQueue, 'status' | 'sent_at' | 'failed_at' | 'retry_count' | 'error_message' | 'provider_message_id'>>;

// =====================================================
// MESSAGE DELIVERY LOG
// =====================================================

export interface MessageDeliveryLog {
  id: string;
  template_key: string;
  recipient_type: UserType;
  recipient_id?: string;
  recipient_email?: string;
  recipient_phone?: string;
  channel: MessageChannel;
  status: MessageStatus;
  sent_at?: string;
  failed_at?: string;
  provider_message_id?: string;
  error_message?: string;
  metadata: Record<string, any>;
  created_at: string;
  archived_at: string;
}

// =====================================================
// USER MESSAGES (INBOX)
// =====================================================

export interface UserMessage {
  id: string;
  user_type: UserType;
  user_id: string;
  message_type: string;
  title: string;
  body: string;
  action_url?: string;
  action_label?: string;
  icon?: string;
  is_read: boolean;
  read_at?: string;
  is_archived: boolean;
  archived_at?: string;
  metadata: Record<string, any>;
  expires_at?: string;
  created_at: string;
}

export type UserMessageCreate = Omit<UserMessage, 'id' | 'is_read' | 'read_at' | 'is_archived' | 'archived_at' | 'created_at'>;
export type UserMessageUpdate = Partial<Pick<UserMessage, 'is_read' | 'read_at' | 'is_archived' | 'archived_at'>>;

// =====================================================
// ADMIN MESSAGE CONFIG
// =====================================================

export interface AdminMessageConfig {
  id: string;
  template_key: string;
  is_globally_enabled: boolean;
  throttle_settings: ThrottleSettings;
  schedule_settings: ScheduleSettings;
  updated_by?: string;
  updated_at: string;
}

export interface ThrottleSettings {
  max_per_user_per_hour?: number;
  max_per_user_per_day?: number;
  max_global_per_hour?: number;
  max_global_per_day?: number;
}

export interface ScheduleSettings {
  quiet_hours?: {
    enabled: boolean;
    start: string;  // HH:mm format
    end: string;    // HH:mm format
    timezone?: string;
  };
  business_hours_only?: boolean;
  allowed_days?: number[];  // 0-6 (Sunday-Saturday)
}

// =====================================================
// MESSAGE EVENTS
// =====================================================

export interface MessageEvent {
  id: string;
  message_queue_id?: string;
  user_message_id?: string;
  event_type: MessageEventType;
  event_data: Record<string, any>;
  event_timestamp: string;
}

export type MessageEventCreate = Omit<MessageEvent, 'id' | 'event_timestamp'>;

// =====================================================
// PROVIDER RESPONSES
// =====================================================

export interface EmailProviderResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'resend';
}

export interface SMSProviderResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'twilio';
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  metadata?: Record<string, any>;
}

export interface SendSMSParams {
  to: string;
  body: string;
  metadata?: Record<string, any>;
}

// =====================================================
// NOTIFICATION PREFERENCES
// =====================================================

export interface NotificationPreferences {
  [templateKey: string]: {
    enabled: boolean;
    channels: MessageChannel[];
    can_disable: boolean;
  };
}

// Enhanced preferences for customers (extends existing structure)
export interface CustomerNotificationPreferences extends NotificationPreferences {
  order_confirmation: {
    enabled: boolean;
    channels: ('email' | 'inbox')[];
    can_disable: false;
  };
  order_shipped: {
    enabled: boolean;
    channels: ('email' | 'sms' | 'inbox')[];
    can_disable: boolean;
  };
  order_delivered: {
    enabled: boolean;
    channels: ('email' | 'inbox')[];
    can_disable: boolean;
  };
  new_product_launch: {
    enabled: boolean;
    channels: ('email' | 'inbox')[];
    can_disable: boolean;
  };
}

// Enhanced preferences for partners
export interface PartnerNotificationPreferences extends NotificationPreferences {
  partner_approval: {
    enabled: boolean;
    channels: ('email' | 'inbox')[];
    can_disable: false;
  };
  referral_purchase: {
    enabled: boolean;
    channels: ('email' | 'sms' | 'inbox')[];
    can_disable: boolean;
  };
  commission_payment: {
    enabled: boolean;
    channels: ('email' | 'inbox')[];
    can_disable: false;
  };
  monthly_summary: {
    enabled: boolean;
    channels: ('email' | 'inbox')[];
    can_disable: boolean;
  };
}

// =====================================================
// MESSAGE SERVICE TYPES
// =====================================================

export interface ProcessQueueResult {
  processed: number;
  failed: number;
  skipped: number;
  errors: Array<{
    messageId: string;
    error: string;
  }>;
}

export interface MessageServiceConfig {
  maxRetries: number;
  retryBackoffMultiplier: number;
  initialDelaySeconds: number;
  batchSize: number;
}

// =====================================================
// WEBHOOK PAYLOADS
// =====================================================

export interface ResendWebhookPayload {
  type: 'email.sent' | 'email.delivered' | 'email.bounced' | 'email.opened' | 'email.clicked';
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
  };
}

export interface TwilioWebhookPayload {
  MessageSid: string;
  MessageStatus: 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  To: string;
  From: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

// =====================================================
// ANALYTICS TYPES
// =====================================================

export interface MessageAnalytics {
  template_key: string;
  channel: MessageChannel;
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_opened?: number;  // Email only
  total_clicked?: number;  // Email only
  delivery_rate: number;
  open_rate?: number;
  click_rate?: number;
  avg_delivery_time_seconds: number;
}

export interface UserMessageStats {
  user_type: UserType;
  user_id: string;
  total_messages: number;
  unread_messages: number;
  read_messages: number;
  archived_messages: number;
}
