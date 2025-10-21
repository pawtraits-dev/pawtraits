// =====================================================
// MESSAGE QUEUE PROCESSOR API ENDPOINT - TEMPORARILY DISABLED
// =====================================================
// Cron job endpoint for processing pending messages in the queue
// NOTE: Parked feature pending external API setup - functionality temporarily disabled

import { NextResponse } from 'next/server';

/**
 * POST /api/messaging/process
 * Process pending messages in the queue
 *
 * TEMPORARILY DISABLED - Parked feature pending external API configuration
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Message queue processing is temporarily disabled pending external API setup',
      timestamp: new Date().toISOString(),
    },
    { status: 501 } // Not Implemented
  );
}

/**
 * GET /api/messaging/process
 * Get queue statistics without processing
 *
 * TEMPORARILY DISABLED - Parked feature pending external API configuration
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Message queue stats temporarily disabled pending external API setup',
      timestamp: new Date().toISOString(),
    },
    { status: 501 } // Not Implemented
  );
}
