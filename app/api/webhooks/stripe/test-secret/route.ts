import { NextRequest, NextResponse } from 'next/server';

// Simple test endpoint to verify webhook secret configuration
export async function GET(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  return NextResponse.json({
    hasSecret: !!webhookSecret,
    secretPrefix: webhookSecret?.substring(0, 10) || 'NOT_SET',
    secretLength: webhookSecret?.length || 0,
    secretSuffix: webhookSecret?.substring(webhookSecret.length - 4) || 'NOT_SET',
    // Check for common issues
    hasWhitespace: webhookSecret ? /\s/.test(webhookSecret) : false,
    hasNewline: webhookSecret ? /\n/.test(webhookSecret) : false,
    startsWithWhsec: webhookSecret?.startsWith('whsec_') || false,
    environment: process.env.VERCEL_ENV || 'development',
  });
}
