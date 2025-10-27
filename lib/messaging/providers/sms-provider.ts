// =====================================================
// SMS PROVIDER - TWILIO
// =====================================================
// Wrapper for Twilio SMS service

import twilio from 'twilio';
import type { SMSSendParams, ProviderResponse } from './provider-types';
import { ProviderError } from './provider-types';

// Initialize Twilio client
let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new ProviderError(
        'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables must be set',
        'twilio'
      );
    }

    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

// Default configuration
const DEFAULT_FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL
  || (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000');

/**
 * Send an SMS using Twilio
 *
 * @param params - SMS parameters
 * @returns Provider response with success status and message SID
 *
 * @example
 * ```typescript
 * const result = await sendSMS({
 *   to: '+441234567890',
 *   body: 'Your order has shipped! Track it here: https://...',
 *   metadata: {
 *     template_key: 'order_shipped',
 *     user_type: 'customer'
 *   }
 * });
 * ```
 */
export async function sendSMS(params: SMSSendParams): Promise<ProviderResponse> {
  try {
    // Validate required parameters
    if (!params.to) {
      throw new ProviderError('Missing required parameter: to', 'twilio');
    }
    if (!params.body) {
      throw new ProviderError('Missing required parameter: body', 'twilio');
    }

    // Validate phone number format (basic check)
    if (!params.to.startsWith('+')) {
      throw new ProviderError(
        'Phone number must be in E.164 format (e.g., +441234567890)',
        'twilio'
      );
    }

    // Validate SMS length (160 chars for single SMS, 1600 for concatenated)
    if (params.body.length > 1600) {
      throw new ProviderError(
        'SMS body exceeds maximum length of 1600 characters',
        'twilio'
      );
    }

    const from = params.from || DEFAULT_FROM_NUMBER;
    if (!from) {
      throw new ProviderError(
        'TWILIO_PHONE_NUMBER environment variable not set',
        'twilio'
      );
    }

    const client = getTwilioClient();

    console.log(`📱 Sending SMS via Twilio to ${params.to}`);

    // Prepare status callback URL
    const statusCallback = params.statusCallback || `${BASE_URL}/api/messaging/webhooks/twilio`;

    // Send SMS
    const message = await client.messages.create({
      from,
      to: params.to,
      body: params.body,
      statusCallback,
    });

    console.log(`✅ SMS sent successfully via Twilio: ${message.sid}`);

    return {
      success: true,
      messageId: message.sid,
      provider: 'twilio',
      data: {
        sid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        dateCreated: message.dateCreated,
        numSegments: message.numSegments, // Number of SMS segments used
      },
    };
  } catch (error) {
    console.error('❌ SMS send failed:', error);

    // If it's already a ProviderError, return it
    if (error instanceof ProviderError) {
      return {
        success: false,
        error: error.message,
        provider: 'twilio',
      };
    }

    // Handle Twilio-specific errors
    if (error && typeof error === 'object' && 'code' in error) {
      const twilioError = error as { code: number; message: string };
      return {
        success: false,
        error: `Twilio error ${twilioError.code}: ${twilioError.message}`,
        provider: 'twilio',
      };
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      provider: 'twilio',
    };
  }
}

/**
 * Get SMS delivery status from Twilio
 *
 * @param messageSid - Twilio message SID
 * @returns SMS status information
 */
export async function getSMSStatus(messageSid: string): Promise<ProviderResponse> {
  try {
    const client = getTwilioClient();

    console.log(`📱 Checking SMS status for: ${messageSid}`);

    const message = await client.messages(messageSid).fetch();

    return {
      success: true,
      provider: 'twilio',
      messageId: messageSid,
      data: {
        status: message.status,
        to: message.to,
        from: message.from,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        numSegments: message.numSegments,
        price: message.price,
        priceUnit: message.priceUnit,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      provider: 'twilio',
    };
  }
}

/**
 * Validate phone number format
 *
 * @param phoneNumber - Phone number to validate
 * @returns True if valid E.164 format
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  // Basic E.164 format validation: +[country code][number]
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * Format phone number to E.164
 * This is a simple formatter - for production use a library like libphonenumber-js
 *
 * @param phoneNumber - Phone number to format
 * @param countryCode - Default country code (e.g., '44' for UK)
 * @returns Formatted phone number or null if invalid
 */
export function formatPhoneNumber(
  phoneNumber: string,
  countryCode: string = '44'
): string | null {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');

  // If it already has country code
  if (phoneNumber.startsWith('+')) {
    return validatePhoneNumber(phoneNumber) ? phoneNumber : null;
  }

  // If it starts with 0, replace with country code
  if (digits.startsWith('0')) {
    const formatted = `+${countryCode}${digits.slice(1)}`;
    return validatePhoneNumber(formatted) ? formatted : null;
  }

  // If it's just digits, add country code
  const formatted = `+${countryCode}${digits}`;
  return validatePhoneNumber(formatted) ? formatted : null;
}

/**
 * Test SMS configuration
 * Sends a test SMS to verify Twilio is configured correctly
 *
 * @param testPhoneNumber - Phone number to send test to (E.164 format)
 * @returns Provider response
 */
export async function testSMSConfiguration(testPhoneNumber: string): Promise<ProviderResponse> {
  if (!validatePhoneNumber(testPhoneNumber)) {
    return {
      success: false,
      error: 'Invalid phone number format. Must be E.164 format (e.g., +441234567890)',
      provider: 'twilio',
    };
  }

  return sendSMS({
    to: testPhoneNumber,
    body: 'Pawtraits SMS Test: Your Twilio configuration is working correctly!',
    metadata: {
      type: 'configuration_test',
    },
  });
}

/**
 * Get SMS pricing for a country
 *
 * @param countryCode - ISO country code (e.g., 'GB', 'US')
 * @returns Pricing information
 */
export async function getSMSPricing(countryCode: string): Promise<ProviderResponse> {
  try {
    const client = getTwilioClient();

    const pricing = await client.pricing.v1.messaging.countries(countryCode).fetch();

    return {
      success: true,
      provider: 'twilio',
      data: {
        country: pricing.country,
        isoCountry: pricing.isoCountry,
        outboundSmsPrices: pricing.outboundSmsPrices,
        priceUnit: pricing.priceUnit,
        url: pricing.url,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      provider: 'twilio',
    };
  }
}
