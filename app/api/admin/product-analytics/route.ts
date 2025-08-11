import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get media types (product categories)
    const { data: mediaTypes, error: mediaError } = await supabase
      .from('media')
      .select(`
        id,
        name,
        slug,
        description,
        material_type,
        finish_type,
        base_cost_multiplier,
        is_active,
        sort_order,
        created_at
      `)
      .order('sort_order', { ascending: true });

    if (mediaError) {
      console.error('Error fetching media types:', mediaError);
      return NextResponse.json(
        { error: 'Failed to fetch media types' },
        { status: 500 }
      );
    }

    // Get products with their media type info
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        sku,
        media_id,
        format_id,
        is_active,
        stock_status,
        created_at,
        media:media_id (
          id,
          name,
          slug,
          material_type,
          finish_type
        ),
        formats:format_id (
          id,
          name,
          slug,
          aspect_ratio
        )
      `);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    // Get client orders
    const { data: orders, error: ordersError } = await supabase
      .from('client_orders')
      .select(`
        id,
        order_value,
        discount_applied,
        order_status,
        order_items,
        created_at
      `);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      // Don't fail if orders table doesn't exist or is empty
      console.log('Orders data not available, continuing with product analytics only');
    }

    // Calculate product statistics
    const totalProducts = products?.length || 0;
    const activeProducts = products?.filter(p => p.is_active).length || 0;
    const totalMediaTypes = mediaTypes?.length || 0;
    const activeMediaTypes = mediaTypes?.filter(m => m.is_active).length || 0;

    // Products by media type
    const productsByMedia = products?.reduce((acc: Record<string, any>, product) => {
      const mediaName = (product.media as any)?.name || 'Unknown';
      const mediaId = product.media_id || 'unknown';
      const mediaSlug = (product.media as any)?.slug || 'unknown';
      
      if (!acc[mediaId]) {
        acc[mediaId] = {
          id: mediaId,
          name: mediaName,
          slug: mediaSlug,
          material_type: (product.media as any)?.material_type,
          finish_type: (product.media as any)?.finish_type,
          count: 0,
          active_count: 0,
          products: []
        };
      }
      
      acc[mediaId].count++;
      if (product.is_active) {
        acc[mediaId].active_count++;
      }
      
      acc[mediaId].products.push({
        id: product.id,
        sku: product.sku,
        is_active: product.is_active,
        stock_status: product.stock_status,
        format_name: (product.formats as any)?.name,
        created_at: product.created_at
      });
      
      return acc;
    }, {}) || {};

    // Stock status distribution
    const stockStatus = products?.reduce((acc: Record<string, number>, product) => {
      const status = product.stock_status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}) || {};

    // Products by format (sizes)
    const productsByFormat = products?.reduce((acc: Record<string, any>, product) => {
      const formatName = (product.formats as any)?.name || 'Unknown';
      const formatId = product.format_id || 'unknown';
      
      if (!acc[formatId]) {
        acc[formatId] = {
          id: formatId,
          name: formatName,
          aspect_ratio: (product.formats as any)?.aspect_ratio,
          count: 0,
          active_count: 0
        };
      }
      
      acc[formatId].count++;
      if (product.is_active) {
        acc[formatId].active_count++;
      }
      
      return acc;
    }, {}) || {};

    // Order analytics (if available)
    let orderAnalytics = {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      ordersByStatus: {},
      recentOrdersCount: 0
    };

    if (orders && orders.length > 0) {
      const totalRevenue = orders.reduce((sum, order) => sum + (order.order_value || 0), 0);
      const statusCounts = orders.reduce((acc: Record<string, number>, order) => {
        const status = order.order_status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      // Recent orders (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentOrders = orders.filter(order => 
        new Date(order.created_at) > thirtyDaysAgo
      );

      orderAnalytics = {
        totalOrders: orders.length,
        totalRevenue,
        averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
        ordersByStatus: statusCounts,
        recentOrdersCount: recentOrders.length
      };
    }

    // Top media types by product count
    const topMediaTypes = Object.values(productsByMedia)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5);

    // Recent products (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentProducts = products?.filter(product => 
      new Date(product.created_at) > thirtyDaysAgo
    ) || [];

    return NextResponse.json({
      summary: {
        totalProducts,
        activeProducts,
        totalMediaTypes,
        activeMediaTypes,
        recentProductsCount: recentProducts.length
      },
      mediaTypes: Object.values(productsByMedia),
      topMediaTypes,
      formats: Object.values(productsByFormat),
      stockStatus,
      orderAnalytics,
      recentProducts: recentProducts.slice(0, 10)
    });

  } catch (error) {
    console.error('Error in product analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}