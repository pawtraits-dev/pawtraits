import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    
    // Use service role client for admin access
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get customer profile first
    const { data: customer, error: customerError } = await supabase
      .from('user_profiles')
      .select('user_id, email, created_at, email_verified')
      .eq('id', customerId)
      .eq('user_type', 'customer')
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Collect all activities
    const activities = [];

    // 1. Account creation
    activities.push({
      type: 'account_created',
      title: 'Account created',
      description: 'Customer registered their account',
      timestamp: customer.created_at,
      icon: 'user',
      color: 'blue'
    });

    // 2. Email verification
    if (customer.email_verified) {
      activities.push({
        type: 'email_verified',
        title: 'Email verified',
        description: 'Customer verified their email address',
        timestamp: customer.created_at, // We don't have exact verification time
        icon: 'check',
        color: 'green'
      });
    }

    // 3. Login activities from auth logs (if available)
    try {
      const { data: authLogs } = await supabase.auth.admin.listUsers();
      const userAuthData = authLogs.users.find(u => u.email === customer.email);
      if (userAuthData?.last_sign_in_at) {
        activities.push({
          type: 'login',
          title: 'Recent login',
          description: 'Customer logged into their account',
          timestamp: userAuthData.last_sign_in_at,
          icon: 'log-in',
          color: 'purple'
        });
      }
    } catch (error) {
      console.log('Could not fetch auth logs:', error);
    }

    // 4. User interactions (likes, shares, cart additions, logins)
    const { data: interactions } = await supabase
      .from('user_interactions')
      .select('*')
      .or(`user_id.eq.${customer.user_id},metadata->>userEmail.eq.${customer.email}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (interactions) {
      interactions.forEach(interaction => {
        switch (interaction.interaction_type) {
          case 'like':
            activities.push({
              type: 'like',
              title: 'Liked image',
              description: `Liked image ${interaction.image_id}`,
              timestamp: interaction.created_at,
              icon: 'heart',
              color: 'pink',
              metadata: { imageId: interaction.image_id }
            });
            break;
          case 'share':
            activities.push({
              type: 'share',
              title: 'Shared image',
              description: `Shared image on ${interaction.platform}`,
              timestamp: interaction.created_at,
              icon: 'share',
              color: 'indigo',
              metadata: { imageId: interaction.image_id, platform: interaction.platform }
            });
            break;
          case 'view':
            activities.push({
              type: 'view',
              title: 'Viewed image',
              description: `Viewed image ${interaction.image_id}`,
              timestamp: interaction.created_at,
              icon: 'eye',
              color: 'gray',
              metadata: { imageId: interaction.image_id }
            });
            break;
          case 'login':
            activities.push({
              type: 'login',
              title: 'Logged in',
              description: 'Customer logged into their account',
              timestamp: interaction.created_at,
              icon: 'log-in',
              color: 'purple',
              metadata: {}
            });
            break;
          case 'cart_add':
            const imageTitle = interaction.metadata?.imageTitle || `Image ${interaction.image_id}`;
            const quantity = interaction.metadata?.quantity || 1;
            activities.push({
              type: 'cart_add',
              title: 'Added to cart',
              description: `Added "${imageTitle}" to cart (${quantity}x)`,
              timestamp: interaction.created_at,
              icon: 'shopping-cart',
              color: 'orange',
              metadata: { 
                imageId: interaction.image_id,
                imageTitle,
                quantity,
                medium: interaction.metadata?.medium,
                format: interaction.metadata?.format
              }
            });
            break;
        }
      });
    }

    // 5. Cart/basket activities from orders metadata
    const { data: orders } = await supabase
      .from('orders')
      .select('created_at, metadata, order_items(*)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (orders) {
      orders.forEach(order => {
        // Add cart activity for each order (representing items being added to cart)
        if (order.order_items && order.order_items.length > 0) {
          activities.push({
            type: 'cart_add',
            title: 'Added to cart',
            description: `Added ${order.order_items.length} item${order.order_items.length > 1 ? 's' : ''} to cart`,
            timestamp: order.created_at,
            icon: 'shopping-cart',
            color: 'orange',
            metadata: { 
              itemCount: order.order_items.length,
              items: order.order_items.map(item => ({
                imageId: item.image_id,
                imageTitle: item.image_title
              }))
            }
          });
        }

        // Purchase activity
        activities.push({
          type: 'purchase',
          title: 'Completed purchase',
          description: `Purchased ${order.order_items?.length || 0} item${(order.order_items?.length || 0) > 1 ? 's' : ''}`,
          timestamp: order.created_at,
          icon: 'credit-card',
          color: 'green',
          metadata: { 
            orderItems: order.order_items?.length || 0
          }
        });
      });
    }

    // Sort all activities by timestamp (newest first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      customer: {
        id: customerId,
        email: customer.email,
        created_at: customer.created_at
      },
      activities: activities.slice(0, 100) // Limit to 100 most recent activities
    });

  } catch (error) {
    console.error('Error fetching customer activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer activity' },
      { status: 500 }
    );
  }
}