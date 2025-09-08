import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from '@/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // Use service role client for admin operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const supabaseService = new SupabaseService();
    
    // Load all images with details using the service method
    const imageData = await supabaseService.getImages({
      limit: 1000,
      publicOnly: false
    });
    
    // Load user interactions using service role client
    const { data: interactions, error: interactionsError } = await supabase
      .from('user_interactions')
      .select('*');
    
    // Load cart items using service role client
    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select('image_id, quantity');
    
    // Load order items for purchase data using service role client
    const { data: orderItems, error: orderError } = await supabase
      .from('order_items')
      .select('image_id, unit_price, quantity')
      .not('image_id', 'is', null);
    
    // Process interactions data
    const interactionsMap: Record<string, Record<string, number>> = {};
    if (interactions && !interactionsError) {
      interactions.forEach((interaction: any) => {
        const imageId = interaction.image_id;
        const type = interaction.interaction_type;
        if (!interactionsMap[imageId]) interactionsMap[imageId] = {};
        if (!interactionsMap[imageId][type]) interactionsMap[imageId][type] = 0;
        interactionsMap[imageId][type]++;
      });
    }
    
    // Process cart data
    const cartMap: Record<string, { count: number; total_quantity: number }> = {};
    if (cartItems && !cartError) {
      cartItems.forEach((item: any) => {
        const imageId = item.image_id;
        if (!cartMap[imageId]) {
          cartMap[imageId] = { count: 0, total_quantity: 0 };
        }
        cartMap[imageId].count++;
        cartMap[imageId].total_quantity += item.quantity || 1;
      });
    }
    
    // Process purchase data
    const purchaseMap: Record<string, { count: number; total_revenue: number }> = {};
    if (orderItems && !orderError) {
      orderItems.forEach((item: any) => {
        const imageId = item.image_id;
        if (!purchaseMap[imageId]) {
          purchaseMap[imageId] = { count: 0, total_revenue: 0 };
        }
        purchaseMap[imageId].count++;
        purchaseMap[imageId].total_revenue += (item.unit_price || 0) * (item.quantity || 0);
      });
    }
    
    // Combine all data
    const analyticsData = imageData.map((image: any) => {
      const interactions = interactionsMap[image.id] || {};
      const views = interactions.view || image.view_count || 0;
      const likes = interactions.like || image.like_count || 0;
      const shares = interactions.share || image.share_count || 0;
      
      const purchases = purchaseMap[image.id] || { count: 0, total_revenue: 0 };
      const cart = cartMap[image.id] || { count: 0, total_quantity: 0 };
      
      const popularityScore = (likes * 3) + (shares * 5) + (views * 1) + (purchases.count * 10) + (cart.count * 2);
      
      return {
        id: image.id,
        public_url: image.public_url,
        prompt_text: image.prompt_text || '',
        breed_name: image.breed_name || 'Unknown',
        theme_name: image.theme_name || 'Unknown', 
        style_name: image.style_name || 'Unknown',
        created_at: image.created_at,
        description: image.description,
        tags: image.tags || [],
        is_featured: image.is_featured || false,
        views,
        likes,
        shares,
        purchases: purchases.count,
        revenue: purchases.total_revenue,
        cart_count: cart.count,
        popularity_score: popularityScore
      };
    });
    
    return NextResponse.json(analyticsData);
    
  } catch (error) {
    console.error('Error loading image analytics:', error);
    return NextResponse.json(
      { error: 'Failed to load image analytics' }, 
      { status: 500 }
    );
  }
}