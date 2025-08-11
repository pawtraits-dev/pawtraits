import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Applying storage policies...');

    // SQL to create storage policies
    const policySQL = `
      -- Enable RLS on storage.objects if not already enabled
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies if they exist (to avoid conflicts)
      DROP POLICY IF EXISTS "Allow authenticated users to upload pet photos" ON storage.objects;
      DROP POLICY IF EXISTS "Allow public read access to pet photos" ON storage.objects;
      DROP POLICY IF EXISTS "Allow users to delete their own pet photos" ON storage.objects;
      DROP POLICY IF EXISTS "Allow users to update their own pet photos" ON storage.objects;

      -- Policy 1: Allow authenticated users to upload pet photos
      CREATE POLICY "Allow authenticated users to upload pet photos" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'pet-photos');

      -- Policy 2: Allow public read access to pet photos
      CREATE POLICY "Allow public read access to pet photos" ON storage.objects
      FOR SELECT TO public, authenticated
      USING (bucket_id = 'pet-photos');

      -- Policy 3: Allow users to delete their own pet photos
      CREATE POLICY "Allow users to delete their own pet photos" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'pet-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

      -- Policy 4: Allow users to update/replace their own pet photos
      CREATE POLICY "Allow users to update their own pet photos" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'pet-photos' AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'pet-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
    `;

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: policySQL });

    if (error) {
      console.error('Error applying storage policies:', error);
      
      // Try applying policies one by one
      const policies = [
        {
          name: 'Enable RLS',
          sql: 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;'
        },
        {
          name: 'Upload Policy',
          sql: `CREATE POLICY "Allow authenticated users to upload pet photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pet-photos');`
        },
        {
          name: 'Read Policy', 
          sql: `CREATE POLICY "Allow public read access to pet photos" ON storage.objects FOR SELECT TO public, authenticated USING (bucket_id = 'pet-photos');`
        },
        {
          name: 'Delete Policy',
          sql: `CREATE POLICY "Allow users to delete their own pet photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'pet-photos' AND auth.uid()::text = (storage.foldername(name))[1]);`
        }
      ];

      const results = [];
      for (const policy of policies) {
        try {
          const { error: policyError } = await supabase.rpc('exec_sql', { sql: policy.sql });
          if (policyError && !policyError.message.includes('already exists')) {
            results.push({ policy: policy.name, status: 'error', error: policyError.message });
          } else {
            results.push({ policy: policy.name, status: 'success' });
          }
        } catch (err) {
          results.push({ policy: policy.name, status: 'error', error: String(err) });
        }
      }

      return NextResponse.json({
        message: 'Storage policies applied with some errors',
        results,
        note: 'Some policies may have failed. Check Supabase Dashboard to verify.'
      });
    }

    return NextResponse.json({
      message: 'Storage policies applied successfully',
      data
    });

  } catch (error) {
    console.error('Error applying storage policies:', error);
    return NextResponse.json(
      { 
        error: 'Failed to apply storage policies', 
        details: error,
        manualInstructions: [
          'Go to your Supabase Dashboard',
          'Navigate to SQL Editor',
          'Run the SQL from scripts/storage-policies.sql',
          'Or manually create policies in Storage > Policies'
        ]
      },
      { status: 500 }
    );
  }
}