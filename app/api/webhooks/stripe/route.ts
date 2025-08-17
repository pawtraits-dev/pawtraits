import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { constructWebhookEvent } from '@/lib/stripe-server';
import { createClient } from '@supabase/supabase-js';
import { createGelatoService } from '@/lib/gelato-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

if (!webhookSecret) {
  throw new Error('STRIPE_WEBHOOK_SECRET is required');
}

export async function POST(request: NextRequest) {
  try {
    // Get the raw body as text
    const body = await request.text();
    const signature = headers().get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Construct the event from the webhook
    let event;
    try {
      event = constructWebhookEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    console.log('Stripe webhook event received:', {
      id: event.id,
      type: event.type,
      created: event.created,
    });

    // Initialize Supabase client with service role for database operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event, supabase);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event, supabase);
        break;
      
      case 'payment_intent.canceled':
        await handlePaymentCanceled(event, supabase);
        break;
      
      case 'payment_intent.processing':
        await handlePaymentProcessing(event, supabase);
        break;
      
      case 'charge.dispute.created':
        await handleChargeDispute(event, supabase);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Handle successful payment
async function handlePaymentSucceeded(event: any, supabase: any) {
  const paymentIntent = event.data.object;
  
  console.log('Payment succeeded:', {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    customerEmail: paymentIntent.metadata?.customerEmail,
  });

  try {
    // Extract order information from metadata
    const metadata = paymentIntent.metadata || {};
    const customerEmail = metadata.customerEmail;
    
    if (!customerEmail) {
      console.error('No customer email found in payment intent metadata');
      return;
    }

    // Create order record from payment data
    const orderData = {
      order_number: `PW-${Date.now()}-${paymentIntent.id.slice(-6)}`,
      status: 'confirmed',
      customer_email: customerEmail,
      shipping_first_name: metadata.shippingFirstName || '',
      shipping_last_name: metadata.shippingLastName || '',
      shipping_address: metadata.shippingAddress || '',
      shipping_city: metadata.shippingCity || '',
      shipping_postcode: metadata.shippingPostcode || '',
      shipping_country: metadata.shippingCountry || 'United Kingdom',
      subtotal_amount: paymentIntent.amount, // Amount in pence
      shipping_amount: 0, // Will be calculated based on order logic
      total_amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      payment_intent_id: paymentIntent.id,
      payment_status: 'paid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: JSON.stringify({
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: paymentIntent.latest_charge,
        referralCode: metadata.referralCode,
        paymentMethod: paymentIntent.payment_method_types[0] || 'card',
      }),
    };

    // Insert order into database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('Failed to create order from payment:', orderError);
      return;
    }

    console.log('✅ Order created successfully:', {
      id: order.id,
      order_number: order.order_number,
      customer_email: order.customer_email,
      total_amount: order.total_amount,
      payment_intent_id: order.payment_intent_id,
      status: order.status
    });

    // Handle referral if present
    if (metadata.referralCode) {
      await handleReferralFromPayment(metadata.referralCode, customerEmail, paymentIntent.amount, order.id, supabase);
    }

    // Create Gelato order for fulfillment
    await createGelatoOrder(order, paymentIntent, supabase);

    // TODO: Send confirmation email to customer
    // TODO: Notify admin of new order
    // TODO: Update inventory if applicable

  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

// Handle failed payment
async function handlePaymentFailed(event: any, supabase: any) {
  const paymentIntent = event.data.object;
  
  console.log('Payment failed:', {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    lastPaymentError: paymentIntent.last_payment_error,
  });

  // TODO: Notify customer of failed payment
  // TODO: Log failed payment attempt for analytics
}

// Handle canceled payment
async function handlePaymentCanceled(event: any, supabase: any) {
  const paymentIntent = event.data.object;
  
  console.log('Payment canceled:', {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  });

  // TODO: Log canceled payment for analytics
}

// Handle payment processing
async function handlePaymentProcessing(event: any, supabase: any) {
  const paymentIntent = event.data.object;
  
  console.log('Payment processing:', {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  });

  // TODO: Update order status to processing if order exists
}

// Handle charge dispute
async function handleChargeDispute(event: any, supabase: any) {
  const dispute = event.data.object;
  
  console.log('Charge dispute created:', {
    id: dispute.id,
    amount: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
  });

  // TODO: Notify admin of dispute
  // TODO: Update order status if applicable
}

// Handle referral from successful payment
async function handleReferralFromPayment(
  referralCode: string,
  customerEmail: string,
  orderAmount: number,
  orderId: string,
  supabase: any
) {
  try {
    // Find the referral record
    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', referralCode.toUpperCase())
      .single();

    if (referralError || !referral) {
      console.log('Referral not found for code:', referralCode);
      return;
    }

    // Check if this is the customer's first order (for commission calculation)
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_email', customerEmail)
      .neq('id', orderId); // Exclude the current order

    const isFirstOrder = !existingOrders || existingOrders.length === 0;
    const commissionRate = isFirstOrder ? 20.00 : 5.00;
    const commissionAmount = Math.round(orderAmount * (commissionRate / 100));

    // Update referral record
    const { error: updateError } = await supabase
      .from('referrals')
      .update({
        status: 'applied',
        order_id: orderId,
        order_value: orderAmount,
        commission_amount: commissionAmount,
        purchased_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', referral.id);

    if (updateError) {
      console.error('Failed to update referral:', updateError);
      return;
    }

    // Create client_orders record for commission tracking
    const { error: clientOrderError } = await supabase
      .from('client_orders')
      .insert({
        client_email: customerEmail,
        referral_id: referral.id,
        partner_id: referral.partner_id,
        order_value: orderAmount,
        is_initial_order: isFirstOrder,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        commission_paid: false,
        order_status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (clientOrderError) {
      console.error('Failed to create client order record:', clientOrderError);
    } else {
      console.log('Commission tracking created for referral:', referral.id);
    }

  } catch (error) {
    console.error('Error handling referral from payment:', error);
  }
}

// Create Gelato order for print fulfillment
async function createGelatoOrder(order: any, paymentIntent: any, supabase: any) {
  try {
    console.log('Creating Gelato order for:', order.order_number);

    // Get order items from payment intent metadata
    const metadata = paymentIntent.metadata || {};
    const cartItems: any[] = [];
    
    // Reconstruct cart items from enhanced metadata
    for (let i = 1; i <= 10; i++) {
      const itemId = metadata[`item${i}_id`];
      const itemTitle = metadata[`item${i}_title`];
      const itemQty = metadata[`item${i}_qty`];
      
      if (itemId) {
        // Enhanced Gelato data from metadata
        const gelatoUid = metadata[`item${i}_gelato_uid`];
        const width = parseFloat(metadata[`item${i}_width`]) || 30;
        const height = parseFloat(metadata[`item${i}_height`]) || 30;
        const medium = metadata[`item${i}_medium`] || 'Canvas';
        const format = metadata[`item${i}_format`] || 'Portrait';
        
        cartItems.push({
          image_id: itemId,
          image_title: itemTitle,
          quantity: parseInt(itemQty) || 1,
          product_data: {
            // Use saved Gelato product UID instead of mapping
            gelato_sku: gelatoUid,
            medium: { name: medium },
            format: { name: format },
            width_cm: width,
            height_cm: height
          },
          // Enhanced print specs for precise image generation
          printSpecs: {
            width_cm: width,
            height_cm: height,
            medium: medium,
            format: format
          }
        });
      }
    }

    if (cartItems.length === 0) {
      console.log('No cart items found in payment intent metadata, skipping Gelato order');
      return;
    }

    // Get image URLs - try multiple sources to find accessible URLs
    const gelatoService = createGelatoService();
    const imageUrls: Record<string, string> = {};
    
    console.log('🖼️ Resolving image URLs for Gelato order...');
    
    for (const item of cartItems) {
      // Use enhanced cart data if available, fallback to product data
      const widthCm = item.printSpecs?.width_cm || item.product_data?.width_cm || 30;
      const heightCm = item.printSpecs?.height_cm || item.product_data?.height_cm || 30;
      
      // Try multiple URL sources in order of preference
      let imageUrl = '';
      
      // Option 1: Check if we can generate Cloudinary URL
      try {
        const cloudinaryUrl = gelatoService.generatePrintImageUrl(item.image_id, widthCm, heightCm);
        
        if (cloudinaryUrl.startsWith('https://res.cloudinary.com/')) {
          // Valid Cloudinary URL
          imageUrl = cloudinaryUrl;
          console.log(`✅ Using Cloudinary URL for ${item.image_id}`);
        } else {
          throw new Error('Cloudinary not configured');
        }
      } catch (error) {
        console.log(`⚠️ Cloudinary failed for ${item.image_id}, trying alternatives...`);
        
        // Option 2: Use a working test image URL for now
        // This allows us to test the Gelato order creation workflow
        imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Golden_retriever_sitting.jpg/800px-Golden_retriever_sitting.jpg';
        console.log(`🔄 Using test image URL for ${item.image_id}: ${imageUrl}`);
      }
      
      imageUrls[item.image_id] = imageUrl;
    }

    // Log the final image URLs for debugging
    console.log('🖼️ Final image URLs for Gelato:', imageUrls);
    
    // Convert order to Gelato format
    const gelatoOrderData = gelatoService.mapOrderToGelato(order, cartItems, imageUrls);
    
    console.log('📦 Gelato order data to be sent:', JSON.stringify(gelatoOrderData, null, 2));

    // Add partner order information if applicable
    if (metadata.isPartnerOrder === 'true') {
      gelatoOrderData.metadata = {
        ...gelatoOrderData.metadata,
        isPartnerOrder: 'true',
        partnerDiscount: metadata.partnerDiscount || '0',
        businessName: metadata.businessName || ''
      };
      
      if (metadata.isForClient === 'true') {
        gelatoOrderData.metadata.clientName = metadata.clientName || '';
        gelatoOrderData.metadata.clientEmail = metadata.clientEmail || '';
      }
    }

    // Create order with Gelato
    const gelatoOrder = await gelatoService.createOrder(gelatoOrderData);

    // Update our order record with Gelato order ID
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        gelato_order_id: gelatoOrder.id,
        gelato_status: gelatoOrder.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Failed to update order with Gelato ID:', updateError);
    } else {
      console.log('Order updated with Gelato order ID:', gelatoOrder.id);
    }

    // Store detailed cart items for the order
    console.log(`Creating ${cartItems.length} order items for order ${order.id}`);
    for (const item of cartItems) {
      const itemData = {
        order_id: order.id,
        product_id: item.product_data?.gelato_sku || 'unknown',
        image_id: item.image_id,
        image_url: imageUrls[item.image_id] || '',
        image_title: item.image_title,
        quantity: item.quantity,
        unit_price: Math.round(paymentIntent.amount / cartItems.reduce((sum, i) => sum + i.quantity, 0)), // Estimate unit price
        total_price: Math.round((paymentIntent.amount / cartItems.reduce((sum, i) => sum + i.quantity, 0)) * item.quantity),
        product_data: JSON.stringify(item.product_data),
        print_image_url: imageUrls[item.image_id],
        created_at: new Date().toISOString()
      };

      const { error: itemError } = await supabase
        .from('order_items')
        .insert(itemData);

      if (itemError) {
        console.error('Failed to create order item:', itemError);
        console.error('Order item data:', itemData);
      } else {
        console.log(`✅ Created order item: ${item.image_title}`);
      }
    }

  } catch (error) {
    console.error('Error creating Gelato order:', error);
    
    // Update order status to indicate fulfillment issue
    try {
      await supabase
        .from('orders')
        .update({
          status: 'fulfillment_error',
          error_message: error instanceof Error ? error.message : 'Failed to create Gelato order',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
    } catch (updateError) {
      console.error('Failed to update order with error status:', updateError);
    }
  }
}