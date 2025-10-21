// =====================================================
// MESSAGE ENQUEUE API ENDPOINT - TEMPORARILY DISABLED
// =====================================================
// Public endpoint for sending messages via the messaging system
// NOTE: Parked feature pending external API setup - functionality temporarily disabled

import { NextResponse } from 'next/server';

/**
 * POST /api/messaging/enqueue
 * Enqueue a message to be sent via the messaging system
 *
 * TEMPORARILY DISABLED - Parked feature pending external API configuration
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Message enqueue is temporarily disabled pending external API setup',
      timestamp: new Date().toISOString(),
    },
    { status: 501 } // Not Implemented
  );
}
