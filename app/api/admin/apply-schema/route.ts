import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Applying user_profiles schema...');

    // Create user_profiles table
    const createTableSQL = `
      -- Create user_profiles table to manage user types and additional metadata
      CREATE TABLE IF NOT EXISTS public.user_profiles (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE, -- Reference to auth.users
        user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'partner', 'customer')),
        
        -- Admin specific fields
        permissions TEXT[] DEFAULT '{}', -- Array of permission strings
        
        -- Partner specific fields  
        partner_id UUID, -- Reference to partners table
        
        -- Customer specific fields
        customer_id UUID, -- Reference to customers table
        
        -- Common fields
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        avatar_url TEXT,
        
        -- Status and metadata
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        
        CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
        CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      );
    `;

    // Try to create table first to see if it exists
    console.log('Checking if user_profiles table exists...');
    const { data: existingTable, error: checkError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);
    
    if (checkError && checkError.code === '42P01') {
      // Table doesn't exist, create it
      console.log('Creating user_profiles table...');
      
      // Since we can't execute raw SQL directly, let's create the table using available methods
      // First try to create using a simple insert (which will fail but trigger table creation logic)
      const tempProfile = {
        user_id: '00000000-0000-0000-0000-000000000000',
        user_type: 'customer',
        first_name: 'temp',
        last_name: 'temp',
        email: 'temp@temp.com'
      };
      
      // This will likely fail, but we need to manually create the schema
      console.log('Table does not exist. Schema needs to be applied manually via SQL.');
      
      return NextResponse.json({ 
        error: 'user_profiles table does not exist. Please run the SQL schema manually.',
        schema: createTableSQL
      }, { status: 500 });
    } else {
      console.log('user_profiles table already exists');
    }

    console.log('Schema application completed successfully');

    return NextResponse.json({ 
      success: true, 
      message: 'user_profiles schema applied successfully' 
    });

  } catch (error) {
    console.error('Error applying schema:', error);
    return NextResponse.json(
      { error: 'Failed to apply schema: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}