import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createTrackingTable() {
  try {
    console.log('\n🔧 Creating customer_referral_tracking table...');

    // Create the table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS public.customer_referral_tracking (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        referral_code TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('qr_scan', 'link_click', 'share')),
        platform TEXT DEFAULT 'unknown',
        tracked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        ip_address TEXT,
        user_agent TEXT,
        referrer_url TEXT,
        CONSTRAINT customer_referral_tracking_pkey PRIMARY KEY (id)
      );
    `;

    const { error: tableError } = await supabase.rpc('exec_sql', { sql_query: createTableQuery });

    if (tableError) {
      console.error('❌ Error creating table:', tableError);
      throw tableError;
    }

    console.log('✅ Table created successfully');

    // Create indexes
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_customer_referral_tracking_code ON public.customer_referral_tracking(referral_code);',
      'CREATE INDEX IF NOT EXISTS idx_customer_referral_tracking_action ON public.customer_referral_tracking(action);',
      'CREATE INDEX IF NOT EXISTS idx_customer_referral_tracking_tracked_at ON public.customer_referral_tracking(tracked_at);'
    ];

    for (const query of indexQueries) {
      const { error: indexError } = await supabase.rpc('exec_sql', { sql_query: query });
      if (indexError) {
        console.error('❌ Error creating index:', indexError);
        throw indexError;
      }
    }

    console.log('✅ Indexes created successfully');

    // Enable RLS
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql_query: 'ALTER TABLE public.customer_referral_tracking ENABLE ROW LEVEL SECURITY;'
    });

    if (rlsError) {
      console.error('❌ Error enabling RLS:', rlsError);
      throw rlsError;
    }

    console.log('✅ RLS enabled successfully');

    console.log('\n🎉 customer_referral_tracking table setup complete!');

  } catch (error) {
    console.error('❌ Failed to create tracking table:', error);
  }
}

createTrackingTable().catch(console.error);