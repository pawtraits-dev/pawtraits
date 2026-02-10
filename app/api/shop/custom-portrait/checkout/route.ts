import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia'
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { customImageId, catalogImageId } = await request.json();

    if (!customImageId) {
      return NextResponse.json({ error: 'Custom image ID required' }, { status: 400 });
    }

    // Use service role client for database queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the custom image belongs to this user
    const { data: customImage, error: imageError } = await supabaseAdmin
      .from('custom_images')
      .select('id, customer_email, generated_image_url, catalog_image_id')
      .eq('id', customImageId)
      .single();

    if (imageError || !customImage) {
      return NextResponse.json({ error: 'Custom portrait not found' }, { status: 404 });
    }

    if (customImage.customer_email !== user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if already purchased
    const { data: existingPurchase } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('customer_email', user.email)
      .eq('custom_image_id', customImageId)
      .eq('status', 'completed')
      .single();

    if (existingPurchase) {
      return NextResponse.json({
        error: 'Already purchased',
        message: 'You have already purchased this custom portrait. Check your orders page.'
      }, { status: 400 });
    }

    // Get catalog image details for context
    let catalogImageTitle = 'Custom Pet Portrait';
    if (customImage.catalog_image_id) {
      const { data: catalogImage } = await supabaseAdmin
        .from('image_catalog')
        .select('description, theme:themes(name)')
        .eq('id', customImage.catalog_image_id)
        .single();

      if (catalogImage) {
        catalogImageTitle = catalogImage.description ||
          `${catalogImage.theme?.name || 'Custom'} Pet Portrait`;
      }
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: catalogImageTitle + ' - Digital Download',
              description: 'High-resolution custom pet portrait without watermark',
              images: [customImage.generated_image_url],
            },
            unit_amount: 999, // £9.99
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/shop/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/shop/custom-portrait/${customImageId}`,
      metadata: {
        type: 'custom_portrait',
        custom_image_id: customImageId,
        customer_email: user.email,
        catalog_image_id: customImage.catalog_image_id || '',
      },
      customer_email: user.email,
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Custom portrait checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
