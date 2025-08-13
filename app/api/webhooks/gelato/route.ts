import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const gelatoWebhookSecret = process.env.GELATO_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = headers().get('x-gelato-signature');

    // Verify webhook signature (if Gelato provides one)
    if (gelatoWebhookSecret && signature) {
      // Implement signature verification based on Gelato's webhook security
      // This would be similar to Stripe's signature verification
    }

    const event = JSON.parse(body);
    console.log('Gelato webhook event received:', {
      type: event.type || event.event_type,
      orderId: event.order?.id || event.orderId,
      status: event.order?.status || event.status,
    });

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Handle different event types
    switch (event.type || event.event_type) {
      case 'order.confirmed':
        await handleOrderConfirmed(event, supabase);
        break;
        
      case 'order.production':
        await handleOrderProduction(event, supabase);
        break;
        
      case 'order.shipped':
        await handleOrderShipped(event, supabase);
        break;
        
      case 'order.delivered':
        await handleOrderDelivered(event, supabase);
        break;
        
      case 'order.cancelled':
        await handleOrderCancelled(event, supabase);
        break;
        
      case 'order.failed':
        await handleOrderFailed(event, supabase);
        break;
        
      default:
        console.log(`Unhandled Gelato event type: ${event.type || event.event_type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Error processing Gelato webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleOrderConfirmed(event: any, supabase: any) {
  const order = event.order || event;
  const externalId = order.externalId || order.external_id;

  console.log('Gelato order confirmed:', {
    gelatoOrderId: order.id,
    externalId: externalId,
    status: order.status
  });

  try {
    // Update our order with Gelato order ID and status
    const { error } = await supabase
      .from('orders')
      .update({
        gelato_order_id: order.id,
        gelato_status: 'confirmed',
        status: 'processing', // Update our internal status
        updated_at: new Date().toISOString(),
        metadata: supabase.from('orders')
          .select('metadata')
          .eq('order_number', externalId)
          .then((result: any) => {
            const existingMetadata = result.data?.[0]?.metadata ? JSON.parse(result.data[0].metadata) : {};
            return JSON.stringify({
              ...existingMetadata,
              gelatoOrderId: order.id,
              gelatoStatus: 'confirmed',
              gelatoConfirmedAt: new Date().toISOString()
            });
          })
      })
      .eq('order_number', externalId);

    if (error) {
      console.error('Failed to update order with Gelato confirmation:', error);
    } else {
      console.log('Order updated with Gelato confirmation');
      
      // TODO: Send customer notification about order confirmation
      // TODO: Update inventory if applicable
    }
  } catch (error) {
    console.error('Error handling Gelato order confirmation:', error);
  }
}

async function handleOrderProduction(event: any, supabase: any) {
  const order = event.order || event;
  const externalId = order.externalId || order.external_id;

  console.log('Gelato order in production:', {
    gelatoOrderId: order.id,
    externalId: externalId,
    status: order.status
  });

  try {
    const { error } = await supabase
      .from('orders')
      .update({
        gelato_status: 'production',
        status: 'printing', // Update our internal status
        updated_at: new Date().toISOString()
      })
      .eq('order_number', externalId);

    if (error) {
      console.error('Failed to update order production status:', error);
    } else {
      console.log('Order status updated to production');
      
      // TODO: Send customer notification about production start
    }
  } catch (error) {
    console.error('Error handling Gelato production update:', error);
  }
}

async function handleOrderShipped(event: any, supabase: any) {
  const order = event.order || event;
  const externalId = order.externalId || order.external_id;
  const shipment = order.shipments?.[0] || event.shipment;

  console.log('Gelato order shipped:', {
    gelatoOrderId: order.id,
    externalId: externalId,
    trackingNumber: shipment?.trackingNumber,
    trackingUrl: shipment?.trackingUrl
  });

  try {
    const updateData: any = {
      gelato_status: 'shipped',
      status: 'shipped',
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (shipment?.trackingNumber) {
      updateData.tracking_number = shipment.trackingNumber;
    }

    if (shipment?.trackingUrl) {
      updateData.tracking_url = shipment.trackingUrl;
    }

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('order_number', externalId);

    if (error) {
      console.error('Failed to update order shipping status:', error);
    } else {
      console.log('Order status updated to shipped');
      
      // TODO: Send customer shipping notification with tracking info
    }
  } catch (error) {
    console.error('Error handling Gelato shipping update:', error);
  }
}

async function handleOrderDelivered(event: any, supabase: any) {
  const order = event.order || event;
  const externalId = order.externalId || order.external_id;

  console.log('Gelato order delivered:', {
    gelatoOrderId: order.id,
    externalId: externalId,
    status: order.status
  });

  try {
    const { error } = await supabase
      .from('orders')
      .update({
        gelato_status: 'delivered',
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('order_number', externalId);

    if (error) {
      console.error('Failed to update order delivery status:', error);
    } else {
      console.log('Order status updated to delivered');
      
      // TODO: Send customer delivery confirmation
      // TODO: Request customer review/feedback
    }
  } catch (error) {
    console.error('Error handling Gelato delivery update:', error);
  }
}

async function handleOrderCancelled(event: any, supabase: any) {
  const order = event.order || event;
  const externalId = order.externalId || order.external_id;

  console.log('Gelato order cancelled:', {
    gelatoOrderId: order.id,
    externalId: externalId,
    reason: order.cancellationReason
  });

  try {
    const { error } = await supabase
      .from('orders')
      .update({
        gelato_status: 'cancelled',
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cancellation_reason: order.cancellationReason || 'Cancelled by print provider'
      })
      .eq('order_number', externalId);

    if (error) {
      console.error('Failed to update order cancellation status:', error);
    } else {
      console.log('Order status updated to cancelled');
      
      // TODO: Send customer cancellation notification
      // TODO: Process refund if applicable
    }
  } catch (error) {
    console.error('Error handling Gelato cancellation:', error);
  }
}

async function handleOrderFailed(event: any, supabase: any) {
  const order = event.order || event;
  const externalId = order.externalId || order.external_id;

  console.log('Gelato order failed:', {
    gelatoOrderId: order.id,
    externalId: externalId,
    reason: order.failureReason
  });

  try {
    const { error } = await supabase
      .from('orders')
      .update({
        gelato_status: 'failed',
        status: 'failed',
        updated_at: new Date().toISOString(),
        failure_reason: order.failureReason || 'Order failed at print provider'
      })
      .eq('order_number', externalId);

    if (error) {
      console.error('Failed to update order failure status:', error);
    } else {
      console.log('Order status updated to failed');
      
      // TODO: Send customer failure notification
      // TODO: Process refund
      // TODO: Alert admin to investigate
    }
  } catch (error) {
    console.error('Error handling Gelato order failure:', error);
  }
}