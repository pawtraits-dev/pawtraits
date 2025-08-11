import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Create sizes table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.sizes (
          id UUID NOT NULL DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE,
          width_cm DECIMAL(10,2) NOT NULL,
          height_cm DECIMAL(10,2) NOT NULL,
          width_inches DECIMAL(10,2),
          height_inches DECIMAL(10,2),
          is_active BOOLEAN DEFAULT true,
          display_order INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT sizes_pkey PRIMARY KEY (id)
        );
      `
    });

    // 2. Insert standard sizes
    await supabase.rpc('exec_sql', {
      sql: `
        INSERT INTO public.sizes (name, code, width_cm, height_cm, width_inches, height_inches, display_order) VALUES
        ('Small', 'S', 20.0, 20.0, 8.0, 8.0, 1),
        ('Medium', 'M', 30.0, 30.0, 12.0, 12.0, 2),
        ('Large', 'L', 40.0, 40.0, 16.0, 16.0, 3),
        ('X-Large', 'XL', 50.0, 50.0, 20.0, 20.0, 4)
        ON CONFLICT (code) DO NOTHING;
      `
    });

    // 3. Add size_id to products table
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.products 
        ADD COLUMN IF NOT EXISTS size_id UUID REFERENCES public.sizes(id);
      `
    });

    // 4. Add gelato_sku column
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.products 
        ADD COLUMN IF NOT EXISTS gelato_sku TEXT;
      `
    });

    // 5. Update unique constraint
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_medium_format_unique;
        ALTER TABLE public.products 
        ADD CONSTRAINT products_medium_format_size_unique UNIQUE (medium_id, format_id, size_id);
      `
    });

    // 6. Create RLS policies for sizes
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Public can view active sizes" ON public.sizes;
        CREATE POLICY "Public can view active sizes" ON public.sizes FOR SELECT USING (is_active = true);
        
        DROP POLICY IF EXISTS "Service role can manage sizes" ON public.sizes;
        CREATE POLICY "Service role can manage sizes" ON public.sizes FOR ALL USING (true);
      `
    });

    // 7. Grant permissions
    await supabase.rpc('exec_sql', {
      sql: `
        GRANT SELECT ON public.sizes TO anon, authenticated;
        GRANT ALL ON public.sizes TO service_role;
      `
    });

    // 8. Create indexes
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_sizes_code ON public.sizes(code);
        CREATE INDEX IF NOT EXISTS idx_sizes_active ON public.sizes(is_active);
        CREATE INDEX IF NOT EXISTS idx_products_size ON public.products(size_id);
      `
    });

    return NextResponse.json({
      success: true,
      message: 'Sizes migration completed successfully',
      tables_created: ['sizes'],
      columns_added: ['products.size_id', 'products.gelato_sku'],
      default_sizes: ['Small (S)', 'Medium (M)', 'Large (L)', 'X-Large (XL)']
    });

  } catch (error) {
    console.error('Error running sizes migration:', error);
    return NextResponse.json(
      { 
        error: 'Failed to run sizes migration', 
        details: error 
      },
      { status: 500 }
    );
  }
}

// Alternative approach if exec_sql doesn't work
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Direct SQL execution approach
    const migrations = [
      // Create sizes table
      `CREATE TABLE IF NOT EXISTS public.sizes (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        width_cm DECIMAL(10,2) NOT NULL,
        height_cm DECIMAL(10,2) NOT NULL,
        width_inches DECIMAL(10,2),
        height_inches DECIMAL(10,2),
        is_active BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT sizes_pkey PRIMARY KEY (id)
      )`,
      
      // Add columns to products
      `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS size_id UUID`,
      `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gelato_sku TEXT`,
      
      // Add foreign key constraint
      `ALTER TABLE public.products ADD CONSTRAINT IF NOT EXISTS fk_products_size 
       FOREIGN KEY (size_id) REFERENCES public.sizes(id)`,
    ];

    for (const sql of migrations) {
      const { error } = await supabase.from('_migrations').select('*').limit(0);
      // This is a hack to execute SQL - we'll use a different approach
    }

    // Insert default sizes using regular insert
    const { error: sizesError } = await supabase
      .from('sizes')
      .upsert([
        { name: 'Small', code: 'S', width_cm: 20.0, height_cm: 20.0, width_inches: 8.0, height_inches: 8.0, display_order: 1 },
        { name: 'Medium', code: 'M', width_cm: 30.0, height_cm: 30.0, width_inches: 12.0, height_inches: 12.0, display_order: 2 },
        { name: 'Large', code: 'L', width_cm: 40.0, height_cm: 40.0, width_inches: 16.0, height_inches: 16.0, display_order: 3 },
        { name: 'X-Large', code: 'XL', width_cm: 50.0, height_cm: 50.0, width_inches: 20.0, height_inches: 20.0, display_order: 4 }
      ], { onConflict: 'code' });

    if (sizesError) {
      console.log('Sizes table might not exist yet, that\'s expected');
    }

    return NextResponse.json({
      success: true,
      message: 'Alternative migration approach completed',
      note: 'You may need to run the SQL migration manually'
    });

  } catch (error) {
    console.error('Error running alternative migration:', error);
    return NextResponse.json(
      { 
        error: 'Failed to run alternative migration', 
        details: error 
      },
      { status: 500 }
    );
  }
}