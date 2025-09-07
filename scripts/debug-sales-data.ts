#!/usr/bin/env tsx

import { SupabaseService } from '../lib/supabase';

async function debugSalesData() {
  const supabaseService = new SupabaseService();
  
  console.log('🔍 Debugging sales data capture...\n');
  
  try {
    // Check recent orders
    console.log('1. Recent orders:');
    const { data: orders, error: ordersError } = await supabaseService.supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError);
    } else {
      console.log(`Found ${orders?.length || 0} recent orders:`);
      orders?.forEach((order, i) => {
        console.log(`  ${i + 1}. Order ${order.id} - Status: ${order.order_status} - Total: £${order.total_amount} - Created: ${order.created_at}`);
      });
    }
    
    console.log('\n2. Recent order items:');
    const { data: orderItems, error: itemsError } = await supabaseService.supabase
      .from('order_items')
      .select(`
        *,
        orders!inner(order_status, created_at),
        products(name),
        image_catalog!image_id(id, description)
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (itemsError) {
      console.error('❌ Error fetching order items:', itemsError);
    } else {
      console.log(`Found ${orderItems?.length || 0} recent order items:`);
      orderItems?.forEach((item, i) => {
        console.log(`  ${i + 1}. Item ${item.id}:`);
        console.log(`     - Order Status: ${item.orders?.order_status}`);
        console.log(`     - Product: ${item.products?.name}`);
        console.log(`     - Image ID: ${item.image_id}`);
        console.log(`     - Quantity: ${item.quantity}`);
        console.log(`     - Unit Price: £${item.unit_price}`);
        console.log(`     - Total: £${(item.unit_price * item.quantity).toFixed(2)}`);
        console.log(`     - Created: ${item.created_at}`);
        console.log();
      });
    }
    
    console.log('3. Order items grouped by image (analytics query):');
    const { data: analyticsData, error: analyticsError } = await supabaseService.supabase
      .from('order_items')
      .select('image_id, COUNT(*) as count, SUM(unit_price * quantity) as total_revenue')
      .group(['image_id']);
    
    if (analyticsError) {
      console.error('❌ Error fetching analytics data:', analyticsError);
    } else {
      console.log(`Found revenue for ${analyticsData?.length || 0} images:`);
      analyticsData?.forEach((item, i) => {
        console.log(`  ${i + 1}. Image ${item.image_id}: ${item.count} purchases, £${parseFloat(item.total_revenue || '0').toFixed(2)} revenue`);
      });
    }
    
    console.log('\n4. Order items without image_id (potential issue):');
    const { data: noImageItems, error: noImageError } = await supabaseService.supabase
      .from('order_items')
      .select('id, order_id, product_id, unit_price, quantity, created_at')
      .is('image_id', null);
    
    if (noImageError) {
      console.error('❌ Error fetching items without image_id:', noImageError);
    } else {
      console.log(`Found ${noImageItems?.length || 0} order items without image_id`);
      if (noImageItems && noImageItems.length > 0) {
        noImageItems.forEach((item, i) => {
          console.log(`  ${i + 1}. Item ${item.id} - Order: ${item.order_id} - Product: ${item.product_id} - Value: £${(item.unit_price * item.quantity).toFixed(2)}`);
        });
      }
    }
    
    console.log('\n5. Product sales data (for product analytics):');
    const { data: productSales, error: productError } = await supabaseService.supabase
      .from('order_items')
      .select(`
        product_id,
        quantity,
        unit_price,
        image_id,
        products!inner(name)
      `);
    
    if (productError) {
      console.error('❌ Error fetching product sales:', productError);
    } else {
      const productGroups = productSales?.reduce((acc: any, item: any) => {
        const productName = item.products?.name || 'Unknown';
        if (!acc[productName]) {
          acc[productName] = { count: 0, revenue: 0 };
        }
        acc[productName].count += item.quantity;
        acc[productName].revenue += item.unit_price * item.quantity;
        return acc;
      }, {});
      
      console.log('Product sales summary:');
      Object.entries(productGroups || {}).forEach(([name, data]: [string, any]) => {
        console.log(`  - ${name}: ${data.count} units, £${data.revenue.toFixed(2)} revenue`);
      });
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

debugSalesData().catch(console.error);