// =====================================================
// PROVIDER TYPES
// =====================================================
// Common types for email and SMS providers

export interface ProviderResponse<T = any> {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  data?: T;
}

export interface EmailSendParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: {
    name: string;
    email: string;
  };
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
  metadata?: Record<string, any>;
}

export interface SMSSendParams {
  to: string;
  body: string;
  from?: string;
  statusCallback?: string;
  metadata?: Record<string, any>;
}

export interface ProviderConfig {
  email: {
    provider: 'resend';
    apiKey: string;
    fromEmail: string;
    fromName: string;
    replyTo?: string;
  };
  sms: {
    provider: 'twilio';
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
