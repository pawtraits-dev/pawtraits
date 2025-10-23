import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Debug endpoint to manually verify signature computation
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.arrayBuffer();
    const body = Buffer.from(rawBody);
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Parse the signature header
    const sigParts: Record<string, string> = {};
    signature.split(',').forEach(pair => {
      const [key, value] = pair.split('=');
      sigParts[key] = value;
    });

    const timestamp = sigParts.t;
    const v1Signature = sigParts.v1;

    // Manually compute the expected signature
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia',
    });

    // Try to compute what Stripe should have signed
    const signedPayload = `${timestamp}.${body.toString('utf8')}`;

    // Create HMAC
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    return NextResponse.json({
      receivedSignature: {
        timestamp,
        v1: v1Signature,
        fullHeader: signature
      },
      computedSignature: expectedSignature,
      signaturesMatch: expectedSignature === v1Signature,
      payload: {
        bodyLength: body.length,
        bodyStart: body.toString('utf8', 0, 100),
        bodyEnd: body.toString('utf8', body.length - 100)
      },
      secret: {
        prefix: webhookSecret.substring(0, 10),
        suffix: webhookSecret.substring(webhookSecret.length - 4),
        length: webhookSecret.length
      },
      signedPayloadLength: signedPayload.length
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
