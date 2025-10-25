import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { constructWebhookEvent } from '@/lib/stripe-server';
import { createClient } from '@supabase/supabase-js';
import { createGelatoService } from '@/lib/gelato-service';
import { sendMessage } from '@/lib/messaging/message-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

if (!webhookSecret) {
  throw new Error('STRIPE_WEBHOOK_SECRET is required');
}

// Debug logging for webhook secret (only log prefix for security)
console.log('Webhook secret configured:', {
  hasSecret: !!webhookSecret,
  secretPrefix: webhookSecret?.substring(0, 10) + '...',
  secretLength: webhookSecret?.length
});

// Disable body parsing for this route to preserve raw body
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get the raw body as Buffer to preserve exact bytes
    const rawBody = await request.arrayBuffer();
    const body = Buffer.from(rawBody);
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('❌ Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    console.log('🔐 Webhook signature verification:', {
      signatureHeader: signature.substring(0, 50) + '...',
      bodyLength: body.length,
      bodyType: 'Buffer',
      secretConfigured: !!webhookSecret,
      secretLength: webhookSecret?.length,
      // Log first and last chars to verify body integrity
      bodyStart: body.toString('utf8', 0, 20),
      bodyEnd: body.toString('utf8', body.length - 20, body.length)
    });

    // Construct the event from the webhook
    let event;

    // TEMPORARY: Skip signature verification to test the rest of the flow
    const SKIP_SIGNATURE_VERIFICATION = process.env.STRIPE_SKIP_SIGNATURE_VERIFICATION === 'true';

    if (SKIP_SIGNATURE_VERIFICATION) {
      console.warn('⚠️  SKIPPING signature verification (temporary for testing)');
      event = JSON.parse(body.toString('utf8'));
    } else {
      try {
        event = constructWebhookEvent(body, signature, webhookSecret);
        console.log('✅ Webhook signature verified successfully');
      } catch (err) {
        console.error('❌ Webhook signature verification failed:', {
          error: err instanceof Error ? err.message : String(err),
          errorStack: err instanceof Error ? err.stack : undefined,
          signatureProvided: signature.substring(0, 50) + '...',
          bodyPreview: body.toString('utf8', 0, 200) + '...',
          webhookSecretPrefix: webhookSecret.substring(0, 10) + '...',
          webhookSecretSuffix: webhookSecret.substring(webhookSecret.length - 4),
          bodyEncoding: 'Buffer',
          contentType: request.headers.get('content-type')
        });
        return NextResponse.json(
          { error: 'Webhook signature verification failed' },
          { status: 400 }
        );
      }
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

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event, supabase);
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

  console.log('💳 Payment Intent Succeeded:', {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    customerEmail: paymentIntent.metadata?.customerEmail,
    orderType: paymentIntent.metadata?.orderType,
    purchaseType: paymentIntent.metadata?.purchaseType,
    hasShippingData: !!(paymentIntent.metadata?.shippingAddress || paymentIntent.metadata?.shippingAddressLine1),
    metadataKeys: Object.keys(paymentIntent.metadata || {})
  });

  try {
    // Extract order information from metadata
    const metadata = paymentIntent.metadata || {};
    const customerEmail = metadata.customerEmail;
    const orderType = metadata.orderType;
    const purchaseType = metadata.purchaseType;

    // Check if this is a credit pack purchase - handle it directly here
    // (checkout.session.completed may not fire reliably for payment mode sessions)
    if (purchaseType === 'customization_credits') {
      console.log('💳 Credit pack purchase detected - processing credits from payment_intent.succeeded');
      await handleCreditPackPurchase(event, supabase, paymentIntent, metadata);
      return;
    }

    // Check if this looks like a print order (has shipping data)
    const hasShippingData = metadata.shippingAddress || metadata.shippingAddressLine1;

    if (!customerEmail) {
      console.error('❌ No customer email found in payment intent metadata');
      return;
    }

    if (!hasShippingData && !orderType) {
      console.warn('⚠️  Payment intent missing both shipping data and order type - skipping order creation');
      console.warn('   This might be a credit purchase that should be handled by checkout.session.completed');
      return;
    }

    // Extract shipping cost, referral discount, and credit redemption from metadata
    const shippingCost = parseInt(metadata.shippingCost || '0');
    const referralDiscount = parseInt(metadata.referralDiscount || '0');
    const creditApplied = parseInt(metadata.rewardRedemption || '0');

    // Calculate pre-discount subtotal for accurate commission calculations
    // paymentIntent.amount is AFTER discounts/credits, so we add them back
    const preDiscountSubtotal = paymentIntent.amount + referralDiscount + creditApplied - shippingCost;

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

    // Send order confirmation email to customer
    await sendOrderConfirmationEmail(supabase, order, paymentIntent, metadata);

    // TODO: Notify admin of new order
    // TODO: Update inventory if applicable

  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

// Handle credit pack purchase from payment_intent.succeeded
async function handleCreditPackPurchase(
  event: any,
  supabase: any,
  paymentIntent: any,
  metadata: any
) {
  try {
    const customerId = metadata.customerId; // customers.id for commission records
    const userProfileId = metadata.userProfileId; // user_profiles.id for credit operations
    const customerEmail = metadata.customerEmail;
    const packId = metadata.packId;
    const credits = parseInt(metadata.credits);
    const orderCreditAmount = parseInt(metadata.orderCreditAmount || '0');
    const amountPaid = paymentIntent.amount;

    if (!customerId || !userProfileId || !credits || !packId) {
      console.error('❌ Missing required metadata for credit purchase:', {
        customerId,
        userProfileId,
        credits,
        packId,
        availableKeys: Object.keys(metadata)
      });
      return;
    }

    console.log('💳 Processing credit pack purchase:', {
      customerId,
      userProfileId,
      customerEmail,
      packId,
      credits,
      orderCreditAmount,
      amountPaid
    });

    // Get balances BEFORE purchase for email comparison
    // Use userProfileId for credit operations (references user_profiles.id)
    const { data: balancesBefore } = await supabase
      .from('customer_customization_credits')
      .select('credits_remaining')
      .eq('customer_id', userProfileId)
      .maybeSingle();

    // Use customerId for customer table operations (references customers.id)
    const { data: customerBefore } = await supabase
      .from('customers')
      .select('current_credit_balance')
      .eq('id', customerId)
      .maybeSingle();

    const previousCustomizationBalance = balancesBefore?.credits_remaining || 0;
    const previousOrderCredit = customerBefore?.current_credit_balance || 0;

    console.log('📊 Balances before purchase:', {
      previousCustomizationBalance,
      previousOrderCreditPence: previousOrderCredit,
      previousOrderCreditFormatted: `£${(previousOrderCredit / 100).toFixed(2)}`
    });

    // Add customization credits to customer account using database function
    // Use userProfileId (user_profiles.id) for credit operations
    const { data: addResult, error: addError } = await supabase
      .rpc('add_customization_credits', {
        p_customer_id: userProfileId,
        p_credits_to_add: credits,
        p_purchase_amount: amountPaid
      });

    if (addError || !addResult) {
      console.error('❌ Failed to add customization credits to customer account:', addError);
      return;
    }

    console.log('✅ Customization credits added successfully');

    // Add order credit to commissions table (if applicable)
    if (orderCreditAmount > 0) {
      console.log('💰 Adding order credit to commissions table:', {
        orderCreditAmount,
        orderCreditFormatted: `£${(orderCreditAmount / 100).toFixed(2)}`
      });

      const { data: commissionData, error: commissionError } = await supabase
        .from('commissions')
        .insert({
          order_id: null, // No order yet, this is prepaid credit
          order_amount: 0,
          recipient_type: 'customer',
          recipient_id: customerId,
          recipient_email: customerEmail,
          referrer_type: 'customer',
          referrer_id: customerId,
          referral_code: null,
          commission_type: 'customer_credit',
          commission_rate: 0,
          commission_amount: orderCreditAmount,
          status: 'approved',
          metadata: {
            source: 'credit_pack_purchase',
            pack_id: packId,
            pack_price_paid: amountPaid,
            customization_credits_granted: credits,
            payment_intent_id: paymentIntent.id,
            purchase_date: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (commissionError) {
        console.error('❌ Failed to create commission record for order credit:', commissionError);
        // Continue to try balance update even if commission creation failed
      } else {
        console.log('✅ Order credit commission record created:', commissionData.id);
      }

      // ALWAYS update customer's current_credit_balance, regardless of commission record success
      // This ensures the balance is available even if there was a commission table issue
      const { data: customer, error: customerFetchError } = await supabase
        .from('customers')
        .select('id, current_credit_balance')
        .eq('id', customerId)
        .single();

      if (customerFetchError) {
        console.error('❌ Failed to fetch customer for balance update:', customerFetchError);
      } else if (customer) {
        const newBalance = (customer.current_credit_balance || 0) + orderCreditAmount;

        const { error: balanceError } = await supabase
          .from('customers')
          .update({ current_credit_balance: newBalance })
          .eq('id', customerId);

        if (balanceError) {
          console.error('❌ Failed to update customer credit balance:', balanceError);
        } else {
          console.log('✅ Customer credit balance updated:', {
            previousBalance: customer.current_credit_balance,
            creditAdded: orderCreditAmount,
            newBalance,
            newBalanceFormatted: `£${(newBalance / 100).toFixed(2)}`
          });
        }
      } else {
        console.error('❌ Customer not found for balance update:', customerId);
      }
    }

    // Get updated customization credit balance
    const { data: balance } = await supabase
      .from('customer_customization_credits')
      .select('credits_remaining, credits_purchased')
      .eq('customer_id', userProfileId)
      .single();

    console.log('✅ Credit pack purchase complete:', {
      customerId,
      customerEmail,
      customizationCreditsAdded: credits,
      orderCreditAdded: orderCreditAmount,
      orderCreditFormatted: `£${(orderCreditAmount / 100).toFixed(2)}`,
      packId,
      amountPaid,
      amountFormatted: `£${(amountPaid / 100).toFixed(2)}`,
      newCustomizationBalance: balance?.credits_remaining || 0,
      totalPurchased: balance?.credits_purchased || 0
    });

    // Send confirmation email to customer about credit purchase
    await sendCreditPackPurchaseEmail(supabase, {
      customerId,
      customerEmail,
      packId,
      credits,
      orderCreditAmount,
      amountPaid,
      previousCustomizationBalance,
      previousOrderCredit,
      newCustomizationBalance: balance?.credits_remaining || 0,
      totalPurchased: balance?.credits_purchased || 0
    });

  } catch (error) {
    console.error('💥 Error handling credit pack purchase:', error);
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

      // Send commission earned email to partner
      await sendPartnerCommissionEmail(supabase, partner, commission, order, commissionRate, subtotalAmount);
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

      // Send credit earned email to referring customer
      await sendCustomerCreditEmail(supabase, referringCustomer, credit, order, customer, newBalance);
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

// Send partner commission earned email
async function sendPartnerCommissionEmail(
  supabase: any,
  partner: any,
  commission: any,
  order: any,
  commissionRate: number,
  subtotalAmount: number
) {
  try {
    console.log('📧 Preparing partner commission email for:', partner.email);

    // Get partner user profile for recipient ID
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', partner.email)
      .single();

    // Get partner statistics
    const { data: partnerStats } = await supabase
      .rpc('get_partner_analytics', { p_partner_id: partner.id });

    const totalCommissions = partnerStats?.total_commissions
      ? `£${(partnerStats.total_commissions / 100).toFixed(2)}`
      : '£0.00';
    const totalReferrals = partnerStats?.total_referrals || 0;

    // Format values
    const commissionAmount = `£${(commission.commission_amount / 100).toFixed(2)}`;
    const orderAmount = `£${(subtotalAmount / 100).toFixed(2)}`;
    const orderDate = new Date(order.created_at).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Build dashboard URL
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const dashboardUrl = `${baseUrl}/partners/dashboard`;

    // Estimate payout date (end of next month)
    const now = new Date();
    const payoutDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const payoutDateStr = payoutDate.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Send email via messaging service
    await sendMessage({
      templateKey: 'partner_commission_earned',
      recipientType: 'partner',
      recipientId: userProfile?.id || null,
      recipientEmail: partner.email,
      variables: {
        base_url: baseUrl,
        partner_name: partner.business_name || `${partner.first_name} ${partner.last_name}`,
        partner_id: partner.id,
        commission_id: commission.id,
        commission_amount: commissionAmount,
        commission_rate: commissionRate.toString(),
        order_number: order.order_number,
        order_amount: orderAmount,
        order_date: orderDate,
        customer_name: `${order.shipping_first_name} ${order.shipping_last_name}`,
        total_commissions: totalCommissions,
        total_referrals: totalReferrals.toString(),
        payout_date: payoutDateStr,
        payment_method: 'Bank Transfer',
        dashboard_url: dashboardUrl,
        unsubscribe_url: `${baseUrl}/preferences/unsubscribe`
      },
      priority: 'normal'
    });

    console.log('✅ Partner commission email queued successfully:', {
      partnerId: partner.id,
      partnerEmail: partner.email,
      commissionAmount
    });

  } catch (error) {
    console.error('❌ Failed to send partner commission email:', error);
    // Don't throw - we don't want email failures to break commission processing
  }
}

// Send customer credit earned email
async function sendCustomerCreditEmail(
  supabase: any,
  referringCustomer: any,
  credit: any,
  order: any,
  referredCustomer: any,
  newBalance: number
) {
  try {
    console.log('📧 Preparing customer credit email for:', referringCustomer.email);

    // Get customer user profile for recipient ID
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', referringCustomer.email)
      .single();

    // Format values
    const creditAmount = `£${(credit.commission_amount / 100).toFixed(2)}`;
    const totalCreditBalance = `£${(newBalance / 100).toFixed(2)}`;
    const referredCustomerName = referredCustomer.email.split('@')[0]; // Use email prefix if no name

    // Build URLs
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const shopUrl = `${baseUrl}/shop`;
    const referralsUrl = `${baseUrl}/customer/referrals`;

    // Send email via messaging service
    await sendMessage({
      templateKey: 'customer_credit_earned',
      recipientType: 'customer',
      recipientId: userProfile?.id || null,
      recipientEmail: referringCustomer.email,
      variables: {
        base_url: baseUrl,
        customer_name: referringCustomer.first_name || referringCustomer.email.split('@')[0],
        referred_customer_name: referredCustomerName,
        credit_amount: creditAmount,
        total_credit_balance: totalCreditBalance,
        shop_url: shopUrl,
        referrals_url: referralsUrl
      },
      priority: 'normal'
    });

    console.log('✅ Customer credit email queued successfully:', {
      customerId: referringCustomer.id,
      customerEmail: referringCustomer.email,
      creditAmount
    });

  } catch (error) {
    console.error('❌ Failed to send customer credit email:', error);
    // Don't throw - we don't want email failures to break credit processing
  }
}

// Send order confirmation email to customer
async function sendOrderConfirmationEmail(
  supabase: any,
  order: any,
  paymentIntent: any,
  metadata: any
) {
  try {
    console.log('📧 Preparing order confirmation email for:', order.customer_email);

    // Get customer profile for recipient ID
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', order.customer_email)
      .single();

    if (!userProfile) {
      console.warn('⚠️  User profile not found for email confirmation:', order.customer_email);
      // Continue anyway - email can still be sent without user profile
    }

    // Get order items for email
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    // Format items for email template
    const items = orderItems?.map((item: any) => {
      const productData = typeof item.product_data === 'string'
        ? JSON.parse(item.product_data)
        : item.product_data;

      return {
        title: item.image_title,
        format: productData?.format?.name || 'Custom',
        size: `${productData?.width_cm}x${productData?.height_cm}cm`,
        quantity: item.quantity,
        price: `£${(item.unit_price / 100).toFixed(2)}`
      };
    }) || [];

    // Format monetary values
    const subtotal = `£${(order.subtotal_amount / 100).toFixed(2)}`;
    const discountAmount = order.discount_amount ? `£${(order.discount_amount / 100).toFixed(2)}` : null;
    const creditApplied = order.credit_applied ? `£${(order.credit_applied / 100).toFixed(2)}` : null;
    const shippingAmount = `£${(order.shipping_amount / 100).toFixed(2)}`;
    const totalAmount = `£${(order.total_amount / 100).toFixed(2)}`;

    // Format shipping address
    const shippingName = `${order.shipping_first_name} ${order.shipping_last_name}`;
    const shippingAddressLine1 = order.shipping_address_line_1 || order.shipping_address;
    const shippingAddressLine2 = order.shipping_address_line_2 || null;

    // Format estimated delivery
    const estimatedDelivery = order.estimated_delivery
      ? new Date(order.estimated_delivery).toLocaleDateString('en-GB', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : 'Within 7-10 business days';

    // Build order URL
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const orderUrl = `${baseUrl}/customer/orders/${order.id}`;

    // Send email via messaging service
    await sendMessage({
      templateKey: 'order_confirmation',
      recipientType: 'customer',
      recipientId: userProfile?.id || null,
      recipientEmail: order.customer_email,
      variables: {
        base_url: baseUrl,
        customer_name: order.shipping_first_name,
        order_number: order.order_number,
        order_id: order.id,
        items,
        subtotal,
        discount_amount: discountAmount,
        referral_code: order.referral_code || null,
        credit_applied: creditApplied,
        shipping_amount: shippingAmount,
        total_amount: totalAmount,
        shipping_name: shippingName,
        shipping_address_line_1: shippingAddressLine1,
        shipping_address_line_2: shippingAddressLine2,
        shipping_city: order.shipping_city,
        shipping_postcode: order.shipping_postcode,
        shipping_country: order.shipping_country,
        estimated_delivery: estimatedDelivery,
        order_url: orderUrl,
        payment_intent_id: order.payment_intent_id,
        unsubscribe_url: `${baseUrl}/preferences/unsubscribe`
      },
      priority: 'high'
    });

    console.log('✅ Order confirmation email queued successfully:', {
      orderId: order.id,
      orderNumber: order.order_number,
      customerEmail: order.customer_email
    });

  } catch (error) {
    console.error('❌ Failed to send order confirmation email:', error);
    // Don't throw - we don't want email failures to break order processing
  }
}

// Send credit pack purchase confirmation email
async function sendCreditPackPurchaseEmail(
  supabase: any,
  data: {
    customerId: string;
    customerEmail: string;
    packId: string;
    credits: number;
    orderCreditAmount: number;
    amountPaid: number;
    previousCustomizationBalance: number;
    previousOrderCredit: number;
    newCustomizationBalance: number;
    totalPurchased: number;
  }
) {
  try {
    console.log('📧 Preparing credit pack purchase email for:', data.customerEmail);

    // Get pack configuration for pack name
    const { data: packConfig } = await supabase
      .from('customer_credit_pack_config')
      .select('pack_name')
      .eq('pack_id', data.packId)
      .single();

    // Get customer name and credit balance
    const { data: customer } = await supabase
      .from('customers')
      .select('first_name, current_credit_balance')
      .eq('id', data.customerId)
      .single();

    // Get user profile for recipient ID
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', data.customerEmail)
      .single();

    // Use production URL for emails
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      || (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000');

    await sendMessage({
      templateKey: 'credit_pack_purchased',
      recipientType: 'customer',
      recipientId: userProfile?.id || null,
      recipientEmail: data.customerEmail,
      variables: {
        base_url: baseUrl,
        customer_name: customer?.first_name || data.customerEmail.split('@')[0],
        pack_name: packConfig?.pack_name || 'Credit Pack',
        credits_added: data.credits,
        order_credit: `£${(data.orderCreditAmount / 100).toFixed(2)}`,
        amount_paid: `£${(data.amountPaid / 100).toFixed(2)}`,
        previous_customization_credits: data.previousCustomizationBalance,
        previous_order_credit: `£${(data.previousOrderCredit / 100).toFixed(2)}`,
        total_customization_credits: data.newCustomizationBalance,
        total_order_credit: `£${((customer?.current_credit_balance || 0) / 100).toFixed(2)}`,
        customize_url: `${baseUrl}/customize`,
        browse_url: `${baseUrl}/browse`,
        referrals_url: `${baseUrl}/referrals`,
        unsubscribe_url: `${baseUrl}/preferences/unsubscribe`
      },
      priority: 'high'
    });

    console.log('✅ Credit pack purchase email queued successfully:', {
      customerId: data.customerId,
      customerEmail: data.customerEmail,
      creditsAdded: data.credits,
      orderCreditAmount: `£${(data.orderCreditAmount / 100).toFixed(2)}`
    });

  } catch (error) {
    console.error('❌ Failed to send credit pack purchase email:', error);
    // Don't throw - we don't want email failures to break credit processing
  }
}

// Handle Stripe Checkout Session completion (for credit pack purchases)
async function handleCheckoutSessionCompleted(event: any, supabase: any) {
  const session = event.data.object;

  console.log('🎫 Checkout Session Completed:', {
    id: session.id,
    amount: session.amount_total,
    currency: session.currency,
    customerEmail: session.customer_email,
    mode: session.mode,
    paymentStatus: session.payment_status,
    purchaseType: session.metadata?.purchaseType,
    metadataKeys: Object.keys(session.metadata || {})
  });

  try {
    const metadata = session.metadata || {};

    // Check if this is a credit pack purchase
    if (metadata.purchaseType !== 'customization_credits') {
      console.log('Not a credit pack purchase, skipping');
      return;
    }

    const customerId = metadata.customerId; // customers.id for commission records
    const userProfileId = metadata.userProfileId; // user_profiles.id for credit operations
    const customerEmail = metadata.customerEmail || session.customer_email;
    const packId = metadata.packId;
    const credits = parseInt(metadata.credits);
    const orderCreditAmount = parseInt(metadata.orderCreditAmount || '0');

    if (!customerId || !userProfileId || !credits) {
      console.error('❌ Missing required metadata for credit purchase:', metadata);
      return;
    }

    console.log('💳 Processing credit pack purchase:', {
      customerId,
      userProfileId,
      customerEmail,
      packId,
      credits,
      orderCreditAmount,
      amountPaid: session.amount_total
    });

    // Add customization credits to customer account using database function
    // Use userProfileId (user_profiles.id) for credit operations
    const { data: addResult, error: addError } = await supabase
      .rpc('add_customization_credits', {
        p_customer_id: userProfileId,
        p_credits_to_add: credits,
        p_purchase_amount: session.amount_total
      });

    if (addError || !addResult) {
      console.error('❌ Failed to add customization credits to customer account:', addError);
      return;
    }

    console.log('✅ Customization credits added successfully');

    // Add order credit to commissions table (if applicable)
    if (orderCreditAmount > 0) {
      console.log('💰 Adding order credit to commissions table:', {
        orderCreditAmount,
        orderCreditFormatted: `£${(orderCreditAmount / 100).toFixed(2)}`
      });

      const { data: commissionData, error: commissionError } = await supabase
        .from('commissions')
        .insert({
          order_id: null, // No order yet, this is prepaid credit
          order_amount: 0,
          recipient_type: 'customer',
          recipient_id: customerId,
          recipient_email: customerEmail,
          referrer_type: 'customer',
          referrer_id: customerId,
          referral_code: null,
          commission_type: 'customer_credit',
          commission_rate: 0,
          commission_amount: orderCreditAmount,
          status: 'approved',
          metadata: {
            source: 'credit_pack_purchase',
            pack_id: packId,
            pack_price_paid: session.amount_total,
            customization_credits_granted: credits,
            stripe_session_id: session.id,
            purchase_date: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (commissionError) {
        console.error('❌ Failed to create commission record for order credit:', commissionError);
      } else {
        console.log('✅ Order credit commission record created:', commissionData.id);

        // Update customer's current_credit_balance
        const { data: customer } = await supabase
          .from('customers')
          .select('id, current_credit_balance')
          .eq('id', customerId)
          .single();

        if (customer) {
          const newBalance = (customer.current_credit_balance || 0) + orderCreditAmount;

          const { error: balanceError } = await supabase
            .from('customers')
            .update({ current_credit_balance: newBalance })
            .eq('id', customerId);

          if (balanceError) {
            console.error('❌ Failed to update customer credit balance:', balanceError);
          } else {
            console.log('✅ Customer credit balance updated:', {
              previousBalance: customer.current_credit_balance,
              creditAdded: orderCreditAmount,
              newBalance,
              newBalanceFormatted: `£${(newBalance / 100).toFixed(2)}`
            });
          }
        }
      }
    }

    // Get updated customization credit balance
    const { data: balance } = await supabase
      .from('customer_customization_credits')
      .select('credits_remaining, credits_purchased')
      .eq('customer_id', userProfileId)
      .single();

    console.log('✅ Credit pack purchase complete:', {
      customerId,
      customerEmail,
      customizationCreditsAdded: credits,
      orderCreditAdded: orderCreditAmount,
      orderCreditFormatted: `£${(orderCreditAmount / 100).toFixed(2)}`,
      packId,
      amountPaid: session.amount_total,
      amountFormatted: `£${(session.amount_total / 100).toFixed(2)}`,
      newCustomizationBalance: balance?.credits_remaining || 0,
      totalPurchased: balance?.credits_purchased || 0
    });

    // Send confirmation email to customer about credit purchase
    await sendCreditPackPurchaseEmail(supabase, {
      customerId,
      customerEmail,
      packId,
      credits,
      orderCreditAmount,
      amountPaid: session.amount_total,
      newCustomizationBalance: balance?.credits_remaining || 0,
      totalPurchased: balance?.credits_purchased || 0
    });

  } catch (error) {
    console.error('💥 Error handling checkout session completion:', error);
  }
}

