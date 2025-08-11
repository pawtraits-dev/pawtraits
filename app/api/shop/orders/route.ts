import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface OrderItem {
  productId: string;
  imageId: string;
  imageUrl: string;
  imageTitle: string;
  quantity: number;
  unitPrice: number; // in minor units (pence)
  totalPrice: number; // in minor units (pence)
}

interface CreateOrderData {
  items: OrderItem[];
  shippingAddress: {
    firstName: string;
    lastName: string;
    email: string;
    address: string;
    city: string;
    postcode: string;
    country: string;
  };
  totalAmount: number; // in minor units (pence)
  shippingCost: number; // in minor units (pence)
  currency: string;
  referralCode?: string; // Optional referral code
  partnerId?: string; // Optional QR partner referral
  discountCode?: string; // Optional partner discount code
}

// Generate order number
function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PW-${year}${month}${day}-${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const orderData: CreateOrderData = await request.json();

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Calculate estimated delivery (5-10 business days from now)
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 7);

    // Handle referral tracking and commission calculation
    let referralData = null;
    let isInitialOrder = false;
    let commissionRate = 0;
    let commissionAmount = 0;
    let discountAmount = 0;
    let finalTotalAmount = orderData.totalAmount;

    // Handle QR partner referrals
    if (orderData.partnerId && !orderData.referralCode) {
      console.log('Processing QR partner referral for partner:', orderData.partnerId);
      
      // Create a referral record for the QR partner purchase
      try {
        const referralCode = `QR-${orderData.partnerId.slice(0, 8)}-${Date.now()}`;
        
        const { data: newReferral, error: createReferralError } = await supabase
          .from('referrals')
          .insert({
            partner_id: orderData.partnerId,
            referral_code: referralCode,
            client_name: `${orderData.shippingAddress.firstName} ${orderData.shippingAddress.lastName}`,
            client_email: orderData.shippingAddress.email,
            status: 'applied',
            qr_scans: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!createReferralError && newReferral) {
          referralData = newReferral;
          
          // Check if this is the customer's first order
          const { data: existingOrders } = await supabase
            .from('orders')
            .select('id')
            .eq('customer_email', orderData.shippingAddress.email)
            .limit(1);

          isInitialOrder = !existingOrders || existingOrders.length === 0;
          
          // Apply 10% discount for QR partner referrals on first order
          if (isInitialOrder) {
            const subtotalAmount = orderData.totalAmount - orderData.shippingCost;
            discountAmount = Math.round(subtotalAmount * 0.10); // 10% discount on subtotal
            finalTotalAmount = orderData.totalAmount - discountAmount;
          }
          
          // Calculate commission (10% for QR partner referrals)
          commissionRate = 10.00;
          commissionAmount = Math.round((orderData.totalAmount - orderData.shippingCost) * (commissionRate / 100));
          
          console.log('QR Partner referral created:', {
            partnerId: orderData.partnerId,
            referralCode,
            isInitialOrder,
            commissionRate,
            commissionAmount,
            discountAmount
          });
        }
      } catch (error) {
        console.error('Failed to create QR partner referral:', error);
      }
    } else if (orderData.referralCode) {
      console.log('Processing referral code:', orderData.referralCode);
      
      // Get referral details - only include active referrals that haven't been used yet
      const { data: referral, error: referralError } = await supabase
        .from('referrals')
        .select('*')
        .eq('referral_code', orderData.referralCode.toUpperCase())
        .in('status', ['invited', 'accessed', 'accepted']) // Only process unused referrals
        .is('order_id', null) // Only referrals that haven't been used yet
        .single();

      console.log('Referral lookup result:', { referral, error: referralError });

      if (!referralError && referral) {
        console.log('Found referral:', referral.id, 'for partner:', referral.partner_id);
        
        // Check if referral has expired
        if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
          console.log('Referral has expired:', referral.expires_at);
        } else {
          referralData = referral;
          
          // Check if this is the customer's first order
          const { data: existingOrders } = await supabase
            .from('orders')
            .select('id')
            .eq('customer_email', orderData.shippingAddress.email)
            .limit(1);

          isInitialOrder = !existingOrders || existingOrders.length === 0;
          
          // Apply 20% discount for first-time referral customers
          if (isInitialOrder) {
            const subtotalAmount = orderData.totalAmount - orderData.shippingCost;
            discountAmount = Math.round(subtotalAmount * 0.20); // 20% discount on subtotal
            finalTotalAmount = orderData.totalAmount - discountAmount;
          }
          
          // Calculate commission (20% for first order, 5% for subsequent)
          // Commission is calculated on the subtotal BEFORE discount
          commissionRate = isInitialOrder ? 20.00 : 5.00;
          commissionAmount = Math.round((orderData.totalAmount - orderData.shippingCost) * (commissionRate / 100));
          
          console.log('Commission calculation:', {
            isInitialOrder,
            commissionRate,
            commissionAmount,
            orderSubtotal: orderData.totalAmount - orderData.shippingCost
          });
        }
      }
    } else if (orderData.referralCode) {
      console.log('Referral code provided but not found or has error:', orderData.referralCode);
    }

    // Create the order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        status: 'confirmed',
        customer_email: orderData.shippingAddress.email,
        shipping_first_name: orderData.shippingAddress.firstName,
        shipping_last_name: orderData.shippingAddress.lastName,
        shipping_address: orderData.shippingAddress.address,
        shipping_city: orderData.shippingAddress.city,
        shipping_postcode: orderData.shippingAddress.postcode,
        shipping_country: orderData.shippingAddress.country,
        subtotal_amount: (orderData.totalAmount - orderData.shippingCost) - discountAmount,
        shipping_amount: orderData.shippingCost,
        total_amount: finalTotalAmount,
        currency: orderData.currency,
        estimated_delivery: estimatedDelivery.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: discountAmount > 0 ? JSON.stringify({
          originalSubtotal: orderData.totalAmount - orderData.shippingCost,
          discountAmount: discountAmount,
          discountType: 'referral_first_order',
          referralCode: orderData.referralCode
        }) : '{}'
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw orderError;
    }

    // Create client_orders record for commission tracking if there's a referral
    if (referralData && commissionAmount > 0) {
      console.log('Creating client_orders record:', {
        client_email: orderData.shippingAddress.email,
        referral_id: referralData.id,
        partner_id: referralData.partner_id,
        order_value: orderData.totalAmount - orderData.shippingCost,
        commission_amount: commissionAmount
      });
      
      const { error: clientOrderError } = await supabase
        .from('client_orders')
        .insert({
          client_email: orderData.shippingAddress.email,
          referral_id: referralData.id,
          partner_id: referralData.partner_id,
          order_value: orderData.totalAmount - orderData.shippingCost, // Original subtotal before discount
          discount_applied: discountAmount,
          is_initial_order: isInitialOrder,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          commission_paid: false,
          order_items: orderData.items,
          order_status: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (clientOrderError) {
        console.error('Error creating client order for commission tracking:', clientOrderError);
        console.error('Client order creation details:', {
          data: {
            client_email: orderData.shippingAddress.email,
            referral_id: referralData.id,
            partner_id: referralData.partner_id,
            order_value: orderData.totalAmount - orderData.shippingCost,
            commission_amount: commissionAmount
          }
        });
        // Don't throw error - order should still succeed even if commission tracking fails
      } else {
        console.log('Successfully created client_orders record');
      }

      // Update referral record with purchase information
      console.log('Updating referral record:', {
        referralId: referralData.id,
        orderId: order.id,
        orderValue: orderData.totalAmount - orderData.shippingCost,
        discountAmount,
        commissionAmount
      });
      
      const { error: referralUpdateError } = await supabase
        .from('referrals')
        .update({
          status: 'applied',
          order_id: order.id,
          order_value: orderData.totalAmount - orderData.shippingCost,
          discount_amount: discountAmount,
          commission_amount: commissionAmount,
          purchased_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', referralData.id);

      if (referralUpdateError) {
        console.error('Error updating referral record:', referralUpdateError);
        console.error('Referral update details:', {
          referralId: referralData.id,
          orderId: order.id,
          orderIdType: typeof order.id,
          query: {
            table: 'referrals',
            update: {
              status: 'applied',
              order_id: order.id,
              order_value: orderData.totalAmount - orderData.shippingCost,
              discount_amount: discountAmount,
              commission_amount: commissionAmount
            },
            where: { id: referralData.id }
          }
        });
        // Don't throw error - order should still succeed
      } else {
        console.log('Successfully updated referral record');
      }
    }

    // Create order items
    const orderItemsData = orderData.items.map(item => ({
      order_id: order.id,
      product_id: item.productId,
      image_id: item.imageId,
      image_url: item.imageUrl,
      image_title: item.imageTitle,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      created_at: new Date().toISOString()
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      throw itemsError;
    }

    // Return order details
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        originalTotal: orderData.totalAmount,
        discountAmount: discountAmount,
        finalTotal: order.total_amount,
        estimatedDelivery: order.estimated_delivery,
        customerEmail: order.customer_email,
        referralApplied: referralData ? {
          code: orderData.referralCode,
          isFirstOrder: isInitialOrder,
          discountApplied: discountAmount > 0
        } : null
      }
    });

  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const orderNumber = searchParams.get('orderNumber');
    const orderId = searchParams.get('orderId');
    const paymentIntent = searchParams.get('paymentIntent');

    // If searching by order number, ID, or payment intent (for confirmation page)
    if (orderNumber || orderId || paymentIntent) {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *
          )
        `);

      if (orderNumber) {
        query = query.eq('order_number', orderNumber);
      } else if (orderId) {
        query = query.eq('id', orderId);
      } else if (paymentIntent) {
        query = query.eq('payment_intent_id', paymentIntent);
      }

      const { data: orders, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Order not found' },
            { status: 404 }
          );
        }
        throw error;
      }

      return NextResponse.json(orders);
    }

    // Otherwise require email for customer order history
    if (!email) {
      return NextResponse.json(
        { error: 'Email, orderNumber, or orderId parameter is required' },
        { status: 400 }
      );
    }

    // Get orders for this customer (case-insensitive email comparison)
    console.log('Shop orders API: Querying orders for email:', email);
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *
        )
      `)
      .ilike('customer_email', email) // Case-insensitive search
      .order('created_at', { ascending: false });
      
    console.log('Shop orders API: Found orders:', orders?.length || 0);
    if (orders?.length) {
      console.log('Shop orders API: Order emails:', orders.map(o => o.customer_email));
    }

    if (error) {
      throw error;
    }

    return NextResponse.json(orders || []);

  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}