import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Webhook debug endpoint is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? 'configured' : 'missing',
    vercelUrl: process.env.VERCEL_URL || 'not set'
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    
    console.log('🎯 Webhook test received:', {
      method: request.method,
      contentLength: body.length,
      hasStripeSignature: !!headers['stripe-signature'],
      timestamp: new Date().toISOString()
    });

    // Log the first 200 characters of the body (for debugging)
    console.log('📦 Body preview:', body.substring(0, 200));
    
    return NextResponse.json({
      success: true,
      message: 'Webhook test received successfully',
      data: {
        method: request.method,
        bodyLength: body.length,
        hasStripeSignature: !!headers['stripe-signature'],
        headers: headers
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Webhook test error:', error);
    return NextResponse.json(
      { 
        error: 'Webhook test failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}