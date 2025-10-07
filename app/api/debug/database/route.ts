import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('🔍 Checking database schema...');

    // Check orders table structure
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'orders')
      .order('ordinal_position');

    if (columnsError) {
      console.error('Error checking columns:', columnsError);
    }

    // Check if we can query orders table
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .limit(1);

    // Check order_items table  
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('*')
      .limit(1);

    const result = {
      timestamp: new Date().toISOString(),
      database: {
        connected: !columnsError,
        url: supabaseUrl.substring(0, 50) + '...'
      },
      orders_table: {
        accessible: !ordersError,
        columns: columns?.map(c => c.column_name) || [],
        sample_count: orders?.length || 0,
        error: ordersError?.message
      },
      order_items_table: {
        accessible: !orderItemsError, 
        sample_count: orderItems?.length || 0,
        error: orderItemsError?.message
      },
      missing_columns: {
        payment_intent_id: !columns?.find(c => c.column_name === 'payment_intent_id'),
        payment_status: !columns?.find(c => c.column_name === 'payment_status'),
        gelato_order_id: !columns?.find(c => c.column_name === 'gelato_order_id'),
        gelato_status: !columns?.find(c => c.column_name === 'gelato_status'),
        error_message: !columns?.find(c => c.column_name === 'error_message')
      }
    };

    console.log('🔍 Database check result:', result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('💥 Database check error:', error);
    return NextResponse.json(
      { 
        error: 'Database check failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('🔧 Applying database migration...');

    // Add missing columns to orders table
    const migrations = [
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_intent_id TEXT',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT \'pending\'',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS gelato_order_id TEXT',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS gelato_status TEXT',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS error_message TEXT'
    ];

    const results = [];
    for (const migration of migrations) {
      try {
        console.log('🔧 Running:', migration);
        const { data, error } = await supabase.rpc('exec_sql', { sql: migration });
        
        results.push({
          sql: migration,
          success: !error,
          error: error?.message || null
        });
        
        if (error) {
          console.error('Migration error:', error);
        } else {
          console.log('✅ Migration successful');
        }
      } catch (error) {
        results.push({
          sql: migration,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      migrations: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Migration error:', error);
    return NextResponse.json(
      { 
        error: 'Migration failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}