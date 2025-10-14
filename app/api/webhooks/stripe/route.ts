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
    orderType: paymentIntent.metadata?.orderType,
  });

  try {
    // Extract order information from metadata
    const metadata = paymentIntent.metadata || {};
    const customerEmail = metadata.customerEmail;
    const orderType = metadata.orderType || 'customer';
    
    if (!customerEmail) {
      console.error('No customer email found in payment intent metadata');
      return;
    }

    // Extract shipping cost, referral discount, and credit redemption from metadata
    const shippingCost = parseInt(metadata.shippingCost || '0');
    const referralDiscount = parseInt(metadata.referralDiscount || '0');
    const creditApplied = parseInt(metadata.rewardRedemption || '0');

    // Calculate pre-discount subtotal for accurate reward calculations
    // paymentIntent.amount is AFTER discount, so we add the discount back
    const preDiscountSubtotal = paymentIntent.amount + referralDiscount - shippingCost;

    // Store both pre-discount and post-discount amounts
    const subtotalAmount = paymentIntent.amount - shippingCost; // Post-discount (what customer actually paid)

    // Check if this is a partner order (user placing order is a partner)
    let orderingUserProfile = null;

    // Get the user profile for the customer placing the order
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, user_type, partner_id, customer_id')
      .eq('email', customerEmail)
      .single();

    if (!profileError && userProfile) {
      orderingUserProfile = userProfile;
      console.log('Webhook: Found user profile:', {
        id: userProfile.id,
        email: userProfile.email,
        user_type: userProfile.user_type,
        partner_id: userProfile.partner_id,
        customer_id: userProfile.customer_id
      });
    } else {
      console.log('Webhook: No user profile found for customer email:', customerEmail);
    }

    // Debug referral code handling
    console.log('🔍 WEBHOOK DEBUG - Payment metadata keys:', Object.keys(metadata));
    console.log('🎯 WEBHOOK DEBUG - Referral code from metadata:', metadata.referralCode || 'NOT FOUND');
    console.log('🎯 WEBHOOK DEBUG - Full metadata:', JSON.stringify(metadata, null, 2));

    // Create simplified order record
    const orderData = {
      order_number: `PW-${Date.now()}-${paymentIntent.id.slice(-6)}`,
      status: 'confirmed',
      customer_email: customerEmail,
      shipping_first_name: metadata.shippingFirstName || '',
      shipping_last_name: metadata.shippingLastName || '',
      shipping_address: metadata.shippingAddress || '', // Keep for backward compatibility
      shipping_address_line_1: metadata.shippingAddressLine1 || metadata.shippingAddress || '',
      shipping_address_line_2: metadata.shippingAddressLine2 || null,
      shipping_city: metadata.shippingCity || '',
      shipping_postcode: metadata.shippingPostcode || '',
      shipping_country: metadata.shippingCountry || 'United Kingdom',
      subtotal_amount: subtotalAmount, // Store post-discount amount (what customer actually paid for items)
      discount_amount: referralDiscount,
      referral_code: referralDiscount > 0 && metadata.referralCode ? metadata.referralCode : null, // Track referral code used
      credit_applied: creditApplied, // Track customer credit redemption
      shipping_amount: shippingCost,
      total_amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      estimated_delivery: metadata.shippingDeliveryEstimate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      payment_intent_id: paymentIntent.id,
      payment_status: 'paid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),

      metadata: JSON.stringify({
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: paymentIntent.latest_charge,
        referralCode: metadata.referralCode,
        paymentMethod: paymentIntent.payment_method_types[0] || 'card',
        shippingMethodUid: metadata.shippingMethodUid,
        shippingMethodName: metadata.shippingMethodName,
        userType: orderingUserProfile?.user_type || 'customer'
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
      status: order.status,
      user_type: orderingUserProfile?.user_type || 'customer'
    });

    // Handle credit redemption if customer used credits
    if (creditApplied > 0) {
      await handleCreditRedemption(supabase, order, customerEmail, creditApplied);
    }

    // Handle commissions and credits based on simplified logic
    // Pass pre-discount subtotal for commission calculations (partners earn on pre-discount amount)
    await handleSimplifiedCommissions(supabase, order, orderingUserProfile, customerEmail, preDiscountSubtotal, metadata);

    // Create Gelato order for fulfillment
    await createGelatoOrder(order, paymentIntent, supabase, metadata);

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

// Handle simplified commissions and credits based on user type and referral status
async function handleSimplifiedCommissions(
  supabase: any,
  order: any,
  orderingUserProfile: any,
  customerEmail: string,
  subtotalAmount: number,
  metadata: any
) {
  try {
    console.log('🎯 Processing simplified commissions for order:', order.id, {
      userType: orderingUserProfile?.user_type,
      customerEmail,
      subtotalAmount,
      referralCode: metadata.referralCode,
      referralType: metadata.referralType,
      rewardRedemption: metadata.rewardRedemption
    });

    // Handle reward redemption if present (deduct from customer's credit balance)
    if (metadata.rewardRedemption && parseInt(metadata.rewardRedemption) > 0) {
      const rewardAmountPence = parseInt(metadata.rewardRedemption);
      const rewardAmountPounds = rewardAmountPence / 100;

      console.log(`💰 Processing reward redemption: £${rewardAmountPounds} (${rewardAmountPence} pence) for ${customerEmail}`);

      // Get customer to deduct from their credit balance
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, current_credit_balance')
        .eq('email', customerEmail.toLowerCase())
        .single();

      if (!customerError && customer) {
        const newBalance = Math.max(0, (customer.current_credit_balance || 0) - rewardAmountPounds);

        const { error: updateError } = await supabase
          .from('customers')
          .update({ current_credit_balance: newBalance })
          .eq('id', customer.id);

        if (updateError) {
          console.error('Failed to deduct reward redemption:', updateError);
        } else {
          console.log(`✅ Reward redeemed: Deducted £${rewardAmountPounds} from customer balance. New balance: £${newBalance}`);
        }
      } else {
        console.error('Failed to find customer for reward redemption:', customerError);
      }
    }

    // Case 1: Partner Orders - No commission, they get 20% discount (handled at checkout)
    if (orderingUserProfile?.user_type === 'partner') {
      console.log('✅ Partner order - no commission processing needed');
      return;
    }

    // Check if there's a referral code in the payment metadata (from checkout)
    if (metadata.referralCode && metadata.referralType) {
      console.log('🎯 Processing referral from payment metadata:', {
        referralCode: metadata.referralCode,
        referralType: metadata.referralType
      });

      if (metadata.referralType === 'partner') {
        console.log('⚠️ Metadata-based referrals no longer supported. Use customer table referral_type and referrer_id instead.');
      } else if (metadata.referralType === 'customer') {
        await handleCustomerCreditFromMetadata(supabase, order, customerEmail, subtotalAmount, metadata);
      }
      return;
    }

    // Fallback: Check referral status in customers table (main flow for customer-based referrals)
    console.log('🔍 Looking up customer referral status for:', customerEmail.toLowerCase());

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        id,
        email,
        referral_type,
        referrer_id,
        referral_code_used,
        referral_discount_applied,
        referral_commission_rate,
        referral_order_id
      `)
      .eq('email', customerEmail.toLowerCase())
      .single();

    console.log('🎯 Customer lookup result:', {
      found: !!customer,
      error: customerError?.message,
      customerData: customer ? {
        id: customer.id,
        email: customer.email,
        referral_type: customer.referral_type,
        referrer_id: customer.referrer_id,
        referral_order_id: customer.referral_order_id
      } : null
    });

    if (customerError || !customer) {
      console.log('ℹ️ Customer not found or organic order - no commission processing');
      return;
    }

    // Note: referral_order_id tracks the first order that applied the referral
    // Partners should continue to receive commissions on subsequent orders

    // Skip if organic customer
    if (!customer.referral_type || customer.referral_type === 'ORGANIC') {
      console.log('ℹ️ Organic customer - no commission processing');
      return;
    }

    const isFirstOrder = !customer.referral_order_id;
    console.log('📊 Processing referral:', {
      referralType: customer.referral_type,
      referrerId: customer.referrer_id,
      isFirstOrder
    });

    // First create the commission record, then update customer
    let commissionCreated = false;

    // Case 3: Partner Referred Customer - 10% commission to partner
    if (customer.referral_type === 'PARTNER' && customer.referrer_id) {
      await handlePartnerCommission(supabase, order, customer, subtotalAmount);
      commissionCreated = true;
    }

    // Case 4: Customer Referred Customer - 10% credit to referring customer
    if (customer.referral_type === 'CUSTOMER' && customer.referrer_id) {
      await handleCustomerCredit(supabase, order, customer, subtotalAmount);
      commissionCreated = true;
    }

    // Commission tracking is now handled by the new commissions table
    if (commissionCreated) {
      console.log('✅ Commission created successfully using new tracking system');
    }

    console.log('🎉 Simplified commission processing completed');

  } catch (error) {
    console.error('💥 Error in simplified commission processing:', error);
  }
}

// Create Gelato order for print fulfillment
async function createGelatoOrder(order: any, paymentIntent: any, supabase: any, metadata: any = {}) {
  try {
    console.log('Creating Gelato order for:', order.order_number);

    // Get cart items from database instead of reconstructing from metadata
    console.log('Getting cart items from database for customer:', paymentIntent.customer_email || paymentIntent.receipt_email);
    const customerEmail = paymentIntent.customer_email || paymentIntent.receipt_email;
    
    let cartItems: any[] = [];
    
    if (customerEmail) {
      // Get user by email first
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', customerEmail)
        .single();
      
      if (!userError && userData) {
        // Get cart items for this user
        const { data: dbCartItems, error: cartError } = await supabase
          .rpc('get_user_cart', { p_user_id: userData.id });
        
        if (!cartError && dbCartItems) {
          cartItems = dbCartItems;
          console.log('✅ Retrieved cart items from database:', cartItems.length);
        } else {
          console.log('Failed to get cart from database:', cartError);
        }
      } else {
        console.log('Failed to find user by email:', userError);
      }
    }
    
    // Fallback to metadata reconstruction if database lookup failed
    if (cartItems.length === 0) {
      console.log('Falling back to metadata reconstruction');
      const paymentIntentMetadata = paymentIntent.metadata || {};
      console.log('🔍 WEBHOOK DEBUG - PaymentIntent metadata keys:', Object.keys(paymentIntentMetadata));
      console.log('🔍 WEBHOOK DEBUG - Looking for item metadata...');
      
      for (let i = 1; i <= 10; i++) {
        const itemId = paymentIntentMetadata[`item${i}_id`];
        const productId = paymentIntentMetadata[`item${i}_product_id`]; // Database UUID
        const itemTitle = paymentIntentMetadata[`item${i}_title`];
        const itemQty = paymentIntentMetadata[`item${i}_qty`];
        const unitPrice = paymentIntentMetadata[`item${i}_unit_price`];
        const originalPrice = paymentIntentMetadata[`item${i}_original_price`];
        
        console.log(`🔍 WEBHOOK DEBUG - Item ${i}:`, { itemId, productId, itemTitle, itemQty, unitPrice, originalPrice });
      
      if (itemId) {
        // Enhanced Gelato data from metadata
        const gelatoUid = paymentIntentMetadata[`item${i}_gelato_uid`];
        const width = parseFloat(paymentIntentMetadata[`item${i}_width`]) || 30;
        const height = parseFloat(paymentIntentMetadata[`item${i}_height`]) || 30;
        const medium = paymentIntentMetadata[`item${i}_medium`] || 'Canvas';
        const format = paymentIntentMetadata[`item${i}_format`] || 'Portrait';
        
        cartItems.push({
          image_id: itemId,
          product_id: productId, // Database UUID for order_items
          image_title: itemTitle,
          quantity: parseInt(itemQty) || 1,
          unit_price: parseInt(unitPrice) || 0,
          original_price: originalPrice ? parseInt(originalPrice) : null, // Store original price for discounts
          product_data: {
            id: productId, // Database UUID
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
    } // End fallback reconstruction
    }

    if (cartItems.length === 0) {
      console.log('No cart items found in payment intent metadata, skipping Gelato order');
      return;
    }

    // Get proper print-quality image URLs from database using Cloudinary service
    const gelatoService = createGelatoService();
    const imageUrls: Record<string, string> = {};
    
    console.log('🖼️ Resolving print-quality image URLs for Gelato order...');
    
    for (const item of cartItems) {
      console.log(`🔍 Processing item: ${item.image_id} (${item.image_title})`);
      
      try {
        // Get image details from database including stored variants
        const { data: imageData, error: imageError } = await supabase
          .from('image_catalog')
          .select('cloudinary_public_id, public_url, image_variants')
          .eq('id', item.image_id)
          .single();

        if (imageError || !imageData) {
          console.error(`❌ Failed to get image data for ${item.image_id}:`, imageError);
          throw new Error('Image not found in catalog');
        }

        console.log(`📷 Image data for ${item.image_id}:`, {
          cloudinary_public_id: imageData.cloudinary_public_id,
          has_public_url: !!imageData.public_url,
          has_image_variants: !!imageData.image_variants,
          has_original_variant: !!(imageData.image_variants?.original)
        });

        let printUrl = '';

        // First try to use the existing original variant URL from database
        if (imageData.image_variants && imageData.image_variants.original && imageData.image_variants.original.url) {
          printUrl = imageData.image_variants.original.url;
          console.log(`✅ Using stored original variant URL for ${item.image_id}`);
        } else if (imageData.cloudinary_public_id) {
          // Fallback: Generate new Cloudinary original URL
          const { cloudinaryService } = await import('@/lib/cloudinary');
          
          printUrl = await cloudinaryService.getOriginalPrintUrl(
            imageData.cloudinary_public_id, 
            order.id
          );
          
          console.log(`✅ Generated new Cloudinary original print URL for ${item.image_id}`);
        } else if (imageData.public_url) {
          // Final fallback to public URL
          printUrl = imageData.public_url;
          console.log(`⚠️ Using fallback public URL for ${item.image_id}`);
        } else {
          throw new Error('No image URL available');
        }

        imageUrls[item.image_id] = printUrl;
        console.log(`🖼️ Image URL for ${item.image_id}: ${printUrl.substring(0, 100)}...`);

      } catch (error) {
        console.error(`❌ Failed to resolve image URL for ${item.image_id}:`, error);
        
        // Use a working test image URL to keep testing the Gelato integration
        const testUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Golden_retriever_sitting.jpg/800px-Golden_retriever_sitting.jpg';
        imageUrls[item.image_id] = testUrl;
        console.log(`🔄 Using test image URL for ${item.image_id}`);
      }
    }

    // Log the final image URLs for debugging
    console.log('🖼️ Final print image URLs for Gelato:', Object.keys(imageUrls).map(id => ({
      imageId: id,
      url: imageUrls[id].substring(0, 100) + '...',
      isCloudinary: imageUrls[id].includes('cloudinary.com'),
      isTestUrl: imageUrls[id].includes('wikipedia.org')
    })));
    
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

    // Check if order items already exist (created by direct order API)
    const { data: existingOrderItems, error: checkError } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', order.id)
      .limit(1);

    if (!checkError && existingOrderItems && existingOrderItems.length > 0) {
      console.log(`Order ${order.id} already has ${existingOrderItems.length} order items, skipping creation`);
      return;
    }

    // Store detailed cart items for the order
    console.log(`Creating ${cartItems.length} order items for order ${order.id}`);
    console.log('WEBHOOK DEBUG - Cart items structure:', JSON.stringify(cartItems, null, 2));
    
    for (const item of cartItems) {
      console.log('WEBHOOK DEBUG - Processing item:', {
        hasProductData: !!item.product_data,
        productDataKeys: item.product_data ? Object.keys(item.product_data) : 'N/A',
        productDataId: item.product_data?.id,
        productDataIdType: typeof item.product_data?.id,
        productDataGelatoSku: item.product_data?.gelato_sku,
        productId: item.product_id,
        itemKeys: Object.keys(item)
      });
      
      const itemData = {
        order_id: order.id,
        product_id: item.product_id || item.product_data?.id || 'unknown', // Database UUID from metadata
        image_id: item.image_id,
        image_url: imageUrls[item.image_id] || '',
        image_title: item.image_title,
        quantity: item.quantity,
        unit_price: item.unit_price || Math.round(paymentIntent.amount / cartItems.reduce((sum, i) => sum + i.quantity, 0)), // Use metadata unit price or estimate
        original_price: item.original_price || item.unit_price, // Store original price for discount calculations
        total_price: item.unit_price ? (item.unit_price * item.quantity) : Math.round((paymentIntent.amount / cartItems.reduce((sum, i) => sum + i.quantity, 0)) * item.quantity),
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

// Handle partner commission using metadata from checkout
// Legacy function removed - partner commissions now handled via customer table referral_type and referrer_id

// Handle customer credit using metadata from checkout
async function handleCustomerCreditFromMetadata(
  supabase: any,
  order: any,
  customerEmail: string,
  subtotalAmount: number,
  metadata: any
) {
  try {
    console.log('🎯 Creating customer credit from metadata (10%):', {
      orderId: order.id,
      referralCode: metadata.referralCode,
      customerEmail,
      subtotalAmount
    });

    // Find the referring customer using the referral code
    const { data: referringCustomer, error: customerError } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, personal_referral_code')
      .eq('personal_referral_code', metadata.referralCode.toUpperCase())
      .single();

    if (customerError || !referringCustomer) {
      console.error('❌ Failed to find referring customer for code:', metadata.referralCode, customerError);
      return;
    }

    // Prepare referred customer data object
    const referredCustomer = {
      id: null, // Customer ID not available in metadata flow
      email: customerEmail,
      referral_code_used: metadata.referralCode,
      referral_type: 'customer'
    };

    // Build base URL for API calls (webhook runs in production)
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL
      || 'http://localhost:3000';

    // Use API endpoint for customer credit creation
    const creditResponse = await fetch(`${baseUrl}/api/commissions/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        orderAmount: subtotalAmount,
        referredCustomer,
        referringCustomerId: referringCustomer.id,
        referringCustomerEmail: referringCustomer.email
      })
    });

    if (creditResponse.ok) {
      const credit = await creditResponse.json();
      console.log('✅ Customer credit created from metadata using API:', {
        creditId: credit.id,
        referringCustomerId: referringCustomer.id,
        referringCustomerEmail: referringCustomer.email,
        creditAmount: credit.commission_amount / 100
      });
    } else {
      console.error('❌ Failed to create customer credit via API:', await creditResponse.text());
    }

  } catch (error) {
    console.error('💥 Error handling customer credit from metadata:', error);
  }
}

// Handle 10% commission for partner-referred customers (legacy support)
async function handlePartnerCommission(
  supabase: any,
  order: any,
  customer: any,
  subtotalAmount: number
) {
  try {
    console.log('🎯 Creating partner commission (10%):', {
      orderId: order.id,
      partnerId: customer.referrer_id,
      customerEmail: customer.email,
      subtotalAmount
    });

    console.log('🔍 COMMISSION DEBUG - Customer referral data:', {
      customerId: customer.id,
      customerEmail: customer.email,
      referralType: customer.referral_type,
      referrerId: customer.referrer_id,
      referralCodeUsed: customer.referral_code_used
    });

    // Get partner information directly (referrer_id is partners.id)
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, business_name, first_name, last_name, email, commission_rate, lifetime_commission_rate')
      .eq('id', customer.referrer_id)
      .single();

    console.log('🔍 COMMISSION DEBUG - Partner lookup result:', {
      found: !!partner,
      partnerId: partner?.id,
      partnerEmail: partner?.email,
      partnerName: partner?.business_name
    });

    if (partnerError || !partner) {
      console.error('❌ COMMISSION FAILED - Partner lookup failed:', {
        error: partnerError?.message,
        referrerId: customer.referrer_id,
        hasPartner: !!partner
      });
      return;
    }

    // Determine if this is the customer's first order (for commission rate calculation)
    const { data: previousOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_email', customer.email.toLowerCase())
      .neq('id', order.id); // Exclude current order

    const isFirstOrder = !previousOrders || previousOrders.length === 0;

    // Use appropriate commission rate: commission_rate for first order, lifetime_commission_rate for subsequent
    const commissionRate = isFirstOrder
      ? (partner.commission_rate || 10.00)
      : (partner.lifetime_commission_rate || 10.00);

    console.log('📊 Commission rate determination:', {
      customerEmail: customer.email,
      previousOrderCount: previousOrders?.length || 0,
      isFirstOrder,
      commissionRate: `${commissionRate}%`,
      rateType: isFirstOrder ? 'initial' : 'lifetime',
      partnerRates: {
        initial: partner.commission_rate,
        lifetime: partner.lifetime_commission_rate
      }
    });

    // Create commission directly in database using service role client
    const commissionAmount = Math.round(subtotalAmount * (commissionRate / 100));

    const commissionData = {
      order_id: order.id,
      order_amount: subtotalAmount,
      recipient_type: 'partner',
      recipient_id: partner.id,
      recipient_email: partner.email,
      referrer_type: 'partner',
      referrer_id: partner.id,
      referral_code: customer.referral_code_used || null,
      commission_type: 'partner_commission',
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      status: 'pending',
      metadata: {
        customer_id: customer.id,
        customer_email: customer.email,
        referral_type: customer.referral_type,
        created_via: 'webhook'
      }
    };

    const { data: commission, error: commissionError } = await supabase
      .from('commissions')
      .insert(commissionData)
      .select()
      .single();

    if (commissionError) {
      console.error('❌ COMMISSION INSERT FAILED:', {
        error: commissionError.message,
        code: commissionError.code,
        details: commissionError.details,
        commissionData: {
          recipient_id: commissionData.recipient_id,
          recipient_type: commissionData.recipient_type,
          order_id: commissionData.order_id,
          commission_amount: commissionData.commission_amount,
          recipient_email: commissionData.recipient_email
        }
      });
    } else {
      console.log('✅ Partner commission created successfully:', {
        commissionId: commission.id,
        recipientId: partner.id,
        recipientEmail: partner.email,
        partnerName: partner.business_name,
        amount: commissionAmount,
        amountPounds: (commissionAmount / 100).toFixed(2),
        orderAmount: subtotalAmount,
        orderAmountPounds: (subtotalAmount / 100).toFixed(2),
        rateUsed: `${commissionRate}%`
      });
    }

  } catch (error) {
    console.error('💥 Error handling partner commission:', error);
  }
}

// Handle 10% credit for customer-referred customers
async function handleCustomerCredit(
  supabase: any,
  order: any,
  customer: any,
  subtotalAmount: number
) {
  try {
    console.log('🎯 Creating customer credit (10%):', {
      orderId: order.id,
      referrerId: customer.referrer_id,
      customerEmail: customer.email,
      subtotalAmount
    });

    console.log('🔍 CREDIT DEBUG - Customer referral data:', {
      customerId: customer.id,
      customerEmail: customer.email,
      referralType: customer.referral_type,
      referrerId: customer.referrer_id,
      referralCodeUsed: customer.referral_code_used
    });

    // Get referring customer information directly (referrer_id is customers.id)
    const { data: referringCustomer, error: referringCustomerError } = await supabase
      .from('customers')
      .select('id, email, first_name, last_name, current_credit_balance')
      .eq('id', customer.referrer_id)
      .single();

    console.log('🔍 CREDIT DEBUG - Referring customer lookup result:', {
      found: !!referringCustomer,
      customerId: referringCustomer?.id,
      customerEmail: referringCustomer?.email,
      currentBalance: referringCustomer?.current_credit_balance
    });

    if (referringCustomerError || !referringCustomer) {
      console.error('❌ CREDIT FAILED - Referring customer lookup failed:', {
        error: referringCustomerError?.message,
        referrerId: customer.referrer_id,
        hasCustomer: !!referringCustomer
      });
      return;
    }

    // Create customer credit directly in database using service role client
    // Customer credits are always 10% of subtotal
    const creditAmount = Math.round(subtotalAmount * 0.10);

    const creditData = {
      order_id: order.id,
      order_amount: subtotalAmount,
      recipient_type: 'customer',
      recipient_id: referringCustomer.id,
      recipient_email: referringCustomer.email,
      referrer_type: 'customer',
      referrer_id: referringCustomer.id,
      referral_code: customer.referral_code_used || null,
      commission_type: 'customer_credit',
      commission_rate: 10.00,
      commission_amount: creditAmount,
      status: 'approved', // Customer credits are auto-approved
      metadata: {
        customer_id: customer.id,
        customer_email: customer.email,
        referral_type: customer.referral_type,
        referred_customer_email: customer.email,
        created_via: 'webhook'
      }
    };

    const { data: credit, error: creditError } = await supabase
      .from('commissions')
      .insert(creditData)
      .select()
      .single();

    if (creditError) {
      console.error('❌ CREDIT INSERT FAILED:', {
        error: creditError.message,
        code: creditError.code,
        details: creditError.details,
        creditData: {
          recipient_id: creditData.recipient_id,
          recipient_type: creditData.recipient_type,
          order_id: creditData.order_id,
          commission_amount: creditData.commission_amount,
          recipient_email: creditData.recipient_email
        }
      });
      return;
    }

    console.log('✅ Customer credit created successfully:', {
      creditId: credit.id,
      recipientId: referringCustomer.id,
      recipientEmail: referringCustomer.email,
      amount: creditAmount,
      amountPounds: (creditAmount / 100).toFixed(2),
      orderAmount: subtotalAmount,
      orderAmountPounds: (subtotalAmount / 100).toFixed(2)
    });

    // Update referring customer's credit balance
    const newBalance = (referringCustomer.current_credit_balance || 0) + creditAmount;

    const { error: updateError } = await supabase
      .from('customers')
      .update({ current_credit_balance: newBalance })
      .eq('id', referringCustomer.id);

    if (updateError) {
      console.error('❌ Failed to update customer credit balance:', {
        error: updateError.message,
        customerId: referringCustomer.id,
        creditAmount,
        newBalance
      });
    } else {
      console.log('✅ Updated customer credit balance:', {
        customerId: referringCustomer.id,
        customerEmail: referringCustomer.email,
        previousBalance: referringCustomer.current_credit_balance || 0,
        creditAdded: creditAmount,
        newBalance,
        newBalancePounds: (newBalance / 100).toFixed(2)
      });
    }

  } catch (error) {
    console.error('💥 Error handling customer credit:', error);
  }
}

// Handle credit redemption when customer uses credits on an order
async function handleCreditRedemption(
  supabase: any,
  order: any,
  customerEmail: string,
  creditAmount: number
) {
  try {
    console.log('💳 Processing credit redemption:', {
      orderId: order.id,
      orderNumber: order.order_number,
      customerEmail,
      creditAmount,
      creditAmountPounds: (creditAmount / 100).toFixed(2)
    });

    // Get customer record
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, email, current_credit_balance')
      .eq('email', customerEmail.toLowerCase().trim())
      .single();

    if (customerError || !customer) {
      console.error('❌ Failed to find customer for credit redemption:', {
        email: customerEmail,
        error: customerError?.message
      });
      return;
    }

    console.log('📊 Customer credit status before redemption:', {
      customerId: customer.id,
      currentBalance: customer.current_credit_balance,
      currentBalancePounds: (customer.current_credit_balance / 100).toFixed(2),
      redemptionAmount: creditAmount,
      redemptionAmountPounds: (creditAmount / 100).toFixed(2)
    });

    // Deduct credit from customer balance
    const newBalance = (customer.current_credit_balance || 0) - creditAmount;

    if (newBalance < 0) {
      console.warn('⚠️  Credit redemption would result in negative balance:', {
        currentBalance: customer.current_credit_balance,
        creditAmount,
        newBalance
      });
      // Still proceed but log the warning
    }

    const { error: updateError } = await supabase
      .from('customers')
      .update({ current_credit_balance: newBalance })
      .eq('id', customer.id);

    if (updateError) {
      console.error('❌ Failed to deduct credit from customer balance:', {
        error: updateError.message,
        customerId: customer.id,
        creditAmount,
        newBalance
      });
      return;
    }

    console.log('✅ Deducted credit from customer balance:', {
      customerId: customer.id,
      customerEmail: customer.email,
      previousBalance: customer.current_credit_balance,
      previousBalancePounds: (customer.current_credit_balance / 100).toFixed(2),
      creditRedeemed: creditAmount,
      creditRedeemedPounds: (creditAmount / 100).toFixed(2),
      newBalance,
      newBalancePounds: (newBalance / 100).toFixed(2)
    });

    // Find approved/paid customer credit commissions to mark as redeemed
    // We'll mark them proportionally based on oldest first (FIFO)
    const { data: commissions, error: commissionsError } = await supabase
      .from('commissions')
      .select('id, commission_amount, status, created_at')
      .eq('recipient_id', customer.id)
      .eq('recipient_type', 'customer')
      .eq('commission_type', 'customer_credit')
      .in('status', ['approved', 'paid'])
      .order('created_at', { ascending: true }); // Oldest first (FIFO)

    if (commissionsError) {
      console.error('❌ Failed to fetch commissions for redemption:', commissionsError);
      return;
    }

    if (!commissions || commissions.length === 0) {
      console.warn('⚠️  No approved/paid credits found to mark as redeemed for customer:', customer.id);
      return;
    }

    console.log('📋 Found credits to mark as redeemed:', {
      count: commissions.length,
      totalAvailable: commissions.reduce((sum, c) => sum + c.commission_amount, 0),
      creditToRedeem: creditAmount
    });

    // Mark commissions as redeemed (FIFO - oldest first)
    let remainingToRedeem = creditAmount;
    const commissionsToUpdate: string[] = [];

    for (const commission of commissions) {
      if (remainingToRedeem <= 0) break;

      commissionsToUpdate.push(commission.id);
      remainingToRedeem -= commission.commission_amount;

      console.log('🔄 Marking commission as redeemed:', {
        commissionId: commission.id,
        commissionAmount: commission.commission_amount,
        commissionAmountPounds: (commission.commission_amount / 100).toFixed(2),
        remainingToRedeem: Math.max(0, remainingToRedeem)
      });
    }

    // Update commission statuses to 'redeemed'
    if (commissionsToUpdate.length > 0) {
      const { error: commissionUpdateError } = await supabase
        .from('commissions')
        .update({
          status: 'redeemed',
          metadata: supabase.raw(`
            COALESCE(metadata, '{}'::jsonb) ||
            jsonb_build_object(
              'redeemed_on_order_id', '${order.id}',
              'redeemed_on_order_number', '${order.order_number}',
              'redeemed_date', '${new Date().toISOString()}'
            )
          `)
        })
        .in('id', commissionsToUpdate);

      if (commissionUpdateError) {
        console.error('❌ Failed to update commission statuses:', {
          error: commissionUpdateError.message,
          commissionIds: commissionsToUpdate
        });
      } else {
        console.log('✅ Marked commissions as redeemed:', {
          count: commissionsToUpdate.length,
          commissionIds: commissionsToUpdate,
          orderId: order.id,
          orderNumber: order.order_number
        });
      }
    }

  } catch (error) {
    console.error('💥 Error handling credit redemption:', error);
  }
}

