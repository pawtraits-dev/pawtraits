import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Applying product system schema...');

    // First, let's check what tables exist
    const { data: existingTables, error: tableError } = await supabase
      .rpc('get_table_names'); // This might not work, let's try a different approach

    // Let's try to create the missing tables step by step
    const schemaSQL = `
      -- Countries table for pricing support
      CREATE TABLE IF NOT EXISTS countries (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        currency_code TEXT NOT NULL,
        currency_symbol TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Media types table  
      CREATE TABLE IF NOT EXISTS media (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        category TEXT NOT NULL,
        material_type TEXT,
        finish_type TEXT,
        thickness_mm DECIMAL(5,2),
        indoor_outdoor TEXT DEFAULT 'indoor' CHECK (indoor_outdoor IN ('indoor', 'outdoor', 'both')),
        uv_resistant BOOLEAN DEFAULT false,
        water_resistant BOOLEAN DEFAULT false,
        care_instructions TEXT,
        is_active BOOLEAN DEFAULT true,
        is_featured BOOLEAN DEFAULT false,
        gelato_category TEXT,
        base_cost_multiplier DECIMAL(5,2) DEFAULT 1.0,
        meta_title TEXT,
        meta_description TEXT,
        preview_image_url TEXT,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Products table (combination of media + format)
      CREATE TABLE IF NOT EXISTS products (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT NOT NULL UNIQUE,
        medium_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
        format_id UUID NOT NULL REFERENCES formats(id) ON DELETE CASCADE,
        description TEXT,
        gelato_product_id TEXT,
        gelato_variant_id TEXT,
        is_active BOOLEAN DEFAULT true,
        is_featured BOOLEAN DEFAULT false,
        stock_status TEXT DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock', 'discontinued')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(medium_id, format_id)
      );

      -- Product pricing by country
      CREATE TABLE IF NOT EXISTS product_pricing (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        country_code TEXT NOT NULL,
        base_price DECIMAL(10,2) NOT NULL,
        currency_code TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(product_id, country_code)
      );

      -- Insert some default countries if they don't exist
      INSERT INTO countries (name, code, currency_code, currency_symbol) VALUES
        ('United States', 'US', 'USD', '$'),
        ('United Kingdom', 'GB', 'GBP', '£'),
        ('Canada', 'CA', 'CAD', 'C$'),
        ('Australia', 'AU', 'AUD', 'A$'),
        ('Germany', 'DE', 'EUR', '€')
      ON CONFLICT (code) DO NOTHING;

      -- Insert default media types if they don't exist
      INSERT INTO media (name, slug, description, category, material_type, finish_type, base_cost_multiplier, display_order) VALUES
        ('Canvas Print', 'canvas-print', 'Premium canvas print with gallery wrap finish', 'canvas', 'canvas', 'matte', 1.0, 1),
        ('Framed Print', 'framed-print', 'Professional framed print with premium materials', 'framed', 'paper', 'matte', 1.2, 2),
        ('Acrylic Print', 'acrylic-print', 'Vibrant acrylic print with high-gloss finish', 'acrylic', 'acrylic', 'gloss', 1.5, 3),
        ('Metal Print', 'metal-print', 'Durable aluminum print with modern finish', 'metal', 'aluminum', 'brushed', 1.4, 4),
        ('Premium Paper Print', 'premium-paper-print', 'High-quality paper print with archival inks', 'paper', 'paper', 'matte', 0.8, 5)
      ON CONFLICT (slug) DO NOTHING;

      -- Enable RLS on all tables
      ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
      ALTER TABLE media ENABLE ROW LEVEL SECURITY;
      ALTER TABLE products ENABLE ROW LEVEL SECURITY;
      ALTER TABLE product_pricing ENABLE ROW LEVEL SECURITY;

      -- Create RLS policies for admin access
      DROP POLICY IF EXISTS "Allow all operations for service role" ON countries;
      CREATE POLICY "Allow all operations for service role" ON countries FOR ALL USING (true);

      DROP POLICY IF EXISTS "Allow all operations for service role" ON media;
      CREATE POLICY "Allow all operations for service role" ON media FOR ALL USING (true);

      DROP POLICY IF EXISTS "Allow all operations for service role" ON products;
      CREATE POLICY "Allow all operations for service role" ON products FOR ALL USING (true);

      DROP POLICY IF EXISTS "Allow all operations for service role" ON product_pricing;
      CREATE POLICY "Allow all operations for service role" ON product_pricing FOR ALL USING (true);
    `;

    // Execute the schema SQL
    const { error: schemaError } = await supabase.rpc('exec_sql', { sql: schemaSQL });

    if (schemaError) {
      console.error('Schema error:', schemaError);
      return NextResponse.json({
        message: 'Schema application had some issues, but continuing...',
        error: schemaError.message,
        note: 'Tables may have been partially created. Check manually if needed.'
      });
    }

    return NextResponse.json({
      message: 'Product system schema applied successfully',
      tables_created: ['countries', 'media', 'products', 'product_pricing'],
      default_data: 'Added default countries and media types'
    });

  } catch (error) {
    console.error('Error applying product schema:', error);
    return NextResponse.json(
      { 
        error: 'Failed to apply product schema', 
        details: error,
        manual_instructions: [
          'Go to your Supabase Dashboard',
          'Navigate to SQL Editor',
          'Run the SQL from scripts/add-product-system.sql',
          'This will create the required tables and default data'
        ]
      },
      { status: 500 }
    );
  }
}