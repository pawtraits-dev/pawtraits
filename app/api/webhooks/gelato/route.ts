import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { isSplitOrder } from '@/lib/fulfillment/shared';
import { gelatoSplitStatusFields, gelatoSplitTrackingFields } from '@/lib/fulfillment/split-routing';

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
      eventType: event.eventType || event.type || event.event_type,
      orderId: event.orderId || event.order_id,
      orderReferenceId: event.orderReferenceId || event.order_reference_id,
      timestamp: new Date().toISOString()
    });

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Handle different webhook event types (updated format)
    switch (event.eventType) {
      case 'order_status_updated':
        await handleOrderStatusUpdated(event, supabase);
        break;
      
      case 'order_item_status_updated':
        await handleOrderItemStatusUpdated(event, supabase);
        break;
      
      case 'order_item_tracking_code_updated':
        await handleOrderItemTrackingUpdated(event, supabase);
        break;
      
      case 'order_delivery_estimate_updated':
        await handleOrderDeliveryEstimateUpdated(event, supabase);
        break;
        
      default:
        console.log(`Unhandled Gelato webhook event: ${event.eventType}`);
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

// Handle order status updates (overall order status)
async function handleOrderStatusUpdated(event: any, supabase: any) {
  try {
    const { orderId, orderReferenceId, order } = event;
    
    console.log('Order status updated:', {
      orderId,
      orderReferenceId,
      status: order?.status,
      fulfillmentStatus: order?.fulfillmentStatus
    });

    // Find our order using orderReferenceId (our order_number) or gelato_order_id
    const { data: orders, error: findError } = await supabase
      .from('orders')
      .select('*, order_items (*)')
      .or(`order_number.eq.${orderReferenceId},gelato_order_id.eq.${orderId}`)
      .limit(1);

    if (findError || !orders || orders.length === 0) {
      console.error('Order not found for Gelato webhook:', { orderReferenceId, orderId });
      return;
    }

    const dbOrder = orders[0];

    // Split order: Gelato only reports on its own part. Record that and leave our parcel's fields alone.
    if (isSplitOrder(dbOrder)) {
      const { error: splitError } = await supabase
        .from('orders')
        .update({
          ...gelatoSplitStatusFields(dbOrder, order?.status),
          updated_at: new Date().toISOString(),
          metadata: JSON.stringify({
            ...parseMetadata(dbOrder.metadata),
            last_gelato_update: new Date().toISOString(),
            gelato_fulfillment_status: order?.fulfillmentStatus
          })
        })
        .eq('id', dbOrder.id);
      if (splitError) console.error('Failed to update split order status:', splitError);
      else console.log(`✅ Split order ${dbOrder.order_number}: Gelato part is ${order?.status}`);
      return;
    }

    const newStatus = mapGelatoStatusToDbStatus(order.status);

    // Update order status in database
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        gelato_status: order.status,
        status: newStatus,
        updated_at: new Date().toISOString(),
        metadata: JSON.stringify({
          ...JSON.parse(dbOrder.metadata || '{}'),
          last_gelato_update: new Date().toISOString(),
          gelato_fulfillment_status: order.fulfillmentStatus
        })
      })
      .eq('id', dbOrder.id);

    if (updateError) {
      console.error('Failed to update order status:', updateError);
    } else {
      console.log(`✅ Order ${dbOrder.order_number} status updated to: ${newStatus} (Gelato: ${order.status})`);
    }

    // Send customer notification for significant status changes
    if (shouldNotifyCustomer(order.status)) {
      await sendOrderStatusNotification(dbOrder, order.status, supabase);
    }

  } catch (error) {
    console.error('Error handling order status update:', error);
  }
}

// Handle individual item status updates
async function handleOrderItemStatusUpdated(event: any, supabase: any) {
  try {
    const { orderId, orderReferenceId, orderItem } = event;
    
    console.log('Order item status updated:', {
      orderId,
      orderReferenceId,
      itemId: orderItem?.id,
      status: orderItem?.status
    });

    // Find the order and update item status tracking
    const { data: orders, error: findError } = await supabase
      .from('orders')
      .select('id, metadata')
      .or(`order_number.eq.${orderReferenceId},gelato_order_id.eq.${orderId}`)
      .single();

    if (findError || !orders) {
      console.error('Order not found for item status update:', { orderReferenceId, orderId });
      return;
    }

    // Update order metadata with item status information
    const existingMetadata = JSON.parse(orders.metadata || '{}');
    const itemStatusHistory = existingMetadata.item_status_history || [];
    
    itemStatusHistory.push({
      item_id: orderItem.id,
      status: orderItem.status,
      updated_at: new Date().toISOString(),
      fulfillment_country: orderItem.fulfillmentCountry,
      facility_id: orderItem.fulfillmentFacilityId
    });

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        metadata: JSON.stringify({
          ...existingMetadata,
          item_status_history: itemStatusHistory,
          last_item_update: new Date().toISOString()
        }),
        updated_at: new Date().toISOString()
      })
      .eq('id', orders.id);

    if (updateError) {
      console.error('Failed to update item status:', updateError);
    } else {
      console.log(`✅ Item status recorded: ${orderItem.status}`);
    }

  } catch (error) {
    console.error('Error handling item status update:', error);
  }
}

// Handle tracking code updates (shipping notifications)
async function handleOrderItemTrackingUpdated(event: any, supabase: any) {
  try {
    const { orderId, orderReferenceId, orderItem } = event;
    
    console.log('Order item tracking updated:', {
      orderId,
      orderReferenceId,
      itemId: orderItem?.id,
      trackingCode: orderItem?.trackingCode,
      shipmentMethod: orderItem?.shipmentMethodName
    });

    // Find and update the order with tracking information
    const { data: orders, error: findError } = await supabase
      .from('orders')
      .select('*, order_items (*)')
      .or(`order_number.eq.${orderReferenceId},gelato_order_id.eq.${orderId}`)
      .single();

    if (findError || !orders) {
      console.error('Order not found for tracking update:', { orderReferenceId, orderId });
      return;
    }

    // Split order: the Gelato parcel's tracking goes in its own columns; our Royal Mail fields stay untouched
    if (isSplitOrder(orders)) {
      const nowIso = new Date().toISOString();
      const fields: Record<string, any> = {
        ...gelatoSplitTrackingFields(orders, orderItem, nowIso),
        updated_at: nowIso,
        metadata: JSON.stringify({
          ...parseMetadata(orders.metadata),
          tracking_info: {
            tracking_code: orderItem?.trackingCode,
            tracking_url: orderItem?.trackingUrl,
            shipment_method: orderItem?.shipmentMethodName,
            fulfillment_country: orderItem?.fulfillmentCountry,
            facility_id: orderItem?.fulfillmentFacilityId,
            shipped_at: nowIso
          }
        })
      };
      let { error: splitError } = await supabase.from('orders').update(fields).eq('id', orders.id);
      if (splitError && /gelato_tracking|gelato_shipped_at/.test(splitError.message || '')) {
        const { gelato_tracking_code, gelato_tracking_url, gelato_shipped_at, ...rest } = fields;
        ({ error: splitError } = await supabase.from('orders').update(rest).eq('id', orders.id));
      }
      if (splitError) console.error('Failed to update split order tracking:', splitError);
      else console.log(`✅ Split order ${orders.order_number}: Gelato tracking recorded`);
      return;
    }

    // Update order with tracking information
    const trackingData = {
      tracking_code: orderItem.trackingCode,
      tracking_url: orderItem.trackingUrl,
      carrier_name: orderItem.shipmentMethodName,
      shipped_at: new Date().toISOString(),
      status: 'shipped',
      gelato_status: 'shipped',
      updated_at: new Date().toISOString(),
      metadata: JSON.stringify({
        ...JSON.parse(orders.metadata || '{}'),
        tracking_info: {
          tracking_code: orderItem.trackingCode,
          tracking_url: orderItem.trackingUrl,
          shipment_method: orderItem.shipmentMethodName,
          fulfillment_country: orderItem.fulfillmentCountry,
          facility_id: orderItem.fulfillmentFacilityId,
          shipped_at: new Date().toISOString()
        }
      })
    };

    const { error: updateError } = await supabase
      .from('orders')
      .update(trackingData)
      .eq('id', orders.id);

    if (updateError) {
      console.error('Failed to update tracking info:', updateError);
    } else {
      console.log(`✅ Tracking info updated for order ${orders.order_number}: ${orderItem.trackingCode}`);
    }

    // Send shipping notification to customer
    await sendShippingNotification(orders, orderItem, supabase);

  } catch (error) {
    console.error('Error handling tracking update:', error);
  }
}

// Handle delivery estimate updates
async function handleOrderDeliveryEstimateUpdated(event: any, supabase: any) {
  try {
    const { orderId, orderReferenceId, estimatedDeliveryDate } = event;
    
    console.log('Delivery estimate updated:', {
      orderId,
      orderReferenceId,
      estimatedDeliveryDate
    });

    const { data: orders, error: findError } = await supabase
      .from('orders')
      .select('id, metadata')
      .or(`order_number.eq.${orderReferenceId},gelato_order_id.eq.${orderId}`)
      .single();

    if (findError || !orders) {
      console.error('Order not found for delivery estimate update:', { orderReferenceId, orderId });
      return;
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        estimated_delivery: estimatedDeliveryDate,
        updated_at: new Date().toISOString(),
        metadata: JSON.stringify({
          ...JSON.parse(orders.metadata || '{}'),
          delivery_estimate_updated: new Date().toISOString()
        })
      })
      .eq('id', orders.id);

    if (updateError) {
      console.error('Failed to update delivery estimate:', updateError);
    } else {
      console.log(`✅ Delivery estimate updated: ${estimatedDeliveryDate}`);
    }

  } catch (error) {
    console.error('Error handling delivery estimate update:', error);
  }
}

// Metadata is jsonb on some rows and a JSON string on older ones
function parseMetadata(m: any): Record<string, any> {
  if (typeof m === 'string') {
    try { const v = JSON.parse(m); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
  }
  return m && typeof m === 'object' ? m : {};
}

// Map Gelato status to our database status
function mapGelatoStatusToDbStatus(gelatoStatus: string): string {
  const statusMap: Record<string, string> = {
    'created': 'confirmed',
    'uploading': 'processing',
    'passed': 'confirmed',
    'in_production': 'printing',
    'printed': 'printed',
    'shipped': 'shipped',
    'in_transit': 'in_transit',
    'delivered': 'delivered',
    'failed': 'fulfillment_error',
    'canceled': 'cancelled',
    'on_hold': 'on_hold'
  };
  
  return statusMap[gelatoStatus] || 'processing';
}

// Determine if customer should be notified for this status change
function shouldNotifyCustomer(gelatoStatus: string): boolean {
  const notifyStatuses = ['printed', 'shipped', 'delivered', 'failed', 'on_hold'];
  return notifyStatuses.includes(gelatoStatus);
}

// Send order status notification to customer
async function sendOrderStatusNotification(order: any, gelatoStatus: string, supabase: any) {
  try {
    console.log(`📧 Would send ${gelatoStatus} notification for order ${order.order_number}`);
    
    // TODO: Implement email notification service
    // This would integrate with SendGrid, AWS SES, or similar service
    
  } catch (error) {
    console.error('Error sending status notification:', error);
  }
}

// Send shipping notification with tracking info
async function sendShippingNotification(order: any, orderItem: any, supabase: any) {
  try {
    console.log(`📦 Would send shipping notification:`, {
      order_number: order.order_number,
      tracking_code: orderItem.trackingCode,
      tracking_url: orderItem.trackingUrl,
      carrier: orderItem.shipmentMethodName
    });
    
    // TODO: Implement shipping email notification
    // This would send an email with tracking details
    
  } catch (error) {
    console.error('Error sending shipping notification:', error);
  }
}