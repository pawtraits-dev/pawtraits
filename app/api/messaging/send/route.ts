import { NextRequest, NextResponse } from 'next/server';
import { sendMessage } from '@/lib/messaging/message-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      templateKey,
      recipientType,
      recipientId,
      recipientEmail,
      variables,
      priority
    } = body;

    // Validate required fields
    if (!templateKey || !recipientType || !recipientEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: templateKey, recipientType, recipientEmail' },
        { status: 400 }
      );
    }

    // Send message via messaging service
    const result = await sendMessage({
      templateKey,
      recipientType,
      recipientId: recipientId || null,
      recipientEmail,
      variables: variables || {},
      priority: priority || 'normal'
    });

    return NextResponse.json({
      success: true,
      message: 'Message queued successfully',
      messageId: result?.id
    });

  } catch (error) {
    console.error('Failed to send message:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send message' },
      { status: 500 }
    );
  }
}
