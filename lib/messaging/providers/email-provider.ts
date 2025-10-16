// =====================================================
// EMAIL PROVIDER - RESEND
// =====================================================
// Wrapper for Resend email service
// Used for both application emails and Supabase Auth emails (via SMTP)

import { Resend } from 'resend';
import type { EmailSendParams, ProviderResponse } from './provider-types';
import { ProviderError } from './provider-types';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Default email configuration
const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@pawtraits.pics';
const DEFAULT_FROM_NAME = process.env.RESEND_FROM_NAME || 'Pawtraits';
const DEFAULT_REPLY_TO = process.env.RESEND_REPLY_TO || process.env.SUPPORT_EMAIL || 'support@pawtraits.pics';

/**
 * Send an email using Resend
 *
 * @param params - Email parameters
 * @returns Provider response with success status and message ID
 *
 * @example
 * ```typescript
 * const result = await sendEmail({
 *   to: 'customer@example.com',
 *   subject: 'Order Confirmation',
 *   html: '<h1>Thank you for your order!</h1>',
 *   tags: [
 *     { name: 'template_key', value: 'order_confirmation' },
 *     { name: 'user_type', value: 'customer' }
 *   ]
 * });
 * ```
 */
export async function sendEmail(params: EmailSendParams): Promise<ProviderResponse> {
  try {
    // Validate required parameters
    if (!params.to) {
      throw new ProviderError('Missing required parameter: to', 'resend');
    }
    if (!params.subject) {
      throw new ProviderError('Missing required parameter: subject', 'resend');
    }
    if (!params.html) {
      throw new ProviderError('Missing required parameter: html', 'resend');
    }

    // Validate API key
    if (!process.env.RESEND_API_KEY) {
      throw new ProviderError('RESEND_API_KEY environment variable not set', 'resend');
    }

    // Prepare email data
    const from = params.from
      ? `${params.from.name} <${params.from.email}>`
      : `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`;

    const replyTo = params.replyTo || DEFAULT_REPLY_TO;

    // Convert to array if single recipient
    const to = Array.isArray(params.to) ? params.to : [params.to];

    console.log(`📧 Sending email via Resend: ${params.subject} to ${to.join(', ')}`);

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: replyTo,
      tags: params.tags || [],
    });

    if (error) {
      console.error('❌ Resend error:', error);
      throw new ProviderError(
        `Resend API error: ${error.message}`,
        'resend',
        error
      );
    }

    console.log(`✅ Email sent successfully via Resend: ${data?.id}`);

    return {
      success: true,
      messageId: data?.id,
      provider: 'resend',
      data,
    };
  } catch (error) {
    console.error('❌ Email send failed:', error);

    // If it's already a ProviderError, rethrow it
    if (error instanceof ProviderError) {
      return {
        success: false,
        error: error.message,
        provider: 'resend',
      };
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      provider: 'resend',
    };
  }
}

/**
 * Send multiple emails in batch (up to 100 at a time)
 *
 * @param emails - Array of email parameters
 * @returns Array of provider responses
 */
export async function sendBatchEmails(
  emails: EmailSendParams[]
): Promise<ProviderResponse[]> {
  // Resend supports batch sending, but for now we'll send them individually
  // to maintain consistent error handling
  const results: ProviderResponse[] = [];

  for (const email of emails) {
    const result = await sendEmail(email);
    results.push(result);
  }

  return results;
}

/**
 * Get email delivery status from Resend (if available)
 *
 * @param messageId - Resend message ID
 * @returns Email status information
 */
export async function getEmailStatus(messageId: string): Promise<ProviderResponse> {
  try {
    // Resend doesn't have a direct status check API yet
    // This is a placeholder for future implementation
    console.log(`📧 Checking email status for: ${messageId}`);

    return {
      success: true,
      provider: 'resend',
      messageId,
      data: {
        status: 'unknown',
        message: 'Status checking not yet implemented for Resend',
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      provider: 'resend',
    };
  }
}

/**
 * Test email configuration
 * Sends a test email to verify Resend is configured correctly
 *
 * @param testEmail - Email address to send test to
 * @returns Provider response
 */
export async function testEmailConfiguration(testEmail: string): Promise<ProviderResponse> {
  return sendEmail({
    to: testEmail,
    subject: 'Pawtraits Email Configuration Test',
    html: `
      <h1>Email Configuration Test</h1>
      <p>This is a test email to verify your Resend configuration is working correctly.</p>
      <p>If you received this email, your email provider is configured properly!</p>
      <hr>
      <p style="color: #666; font-size: 12px;">
        Sent from Pawtraits Messaging System<br>
        Provider: Resend
      </p>
    `,
    tags: [
      { name: 'type', value: 'configuration_test' }
    ],
  });
}
