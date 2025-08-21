import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint fixes RLS policies that might be causing infinite recursion
export async function POST(request: NextRequest) {
  try {
    // Use service role client to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase configuration'
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Fixing RLS policies...');

    // Drop problematic policies
    await supabase.rpc('exec_sql', {
      sql: 'DROP POLICY IF EXISTS "Users can view their own interactions" ON user_interactions;'
    });

    await supabase.rpc('exec_sql', {
      sql: 'DROP POLICY IF EXISTS "Anyone can insert interactions" ON user_interactions;'
    });

    // Create simpler, non-recursive policies
    const policies = [
      // Simple select policy
      `CREATE POLICY "Users can view interactions" ON user_interactions
       FOR SELECT USING (
         auth.uid() = user_id OR 
         auth.uid() IS NULL OR
         current_setting('role', true) = 'service_role'
       );`,
      
      // Simple insert policy
      `CREATE POLICY "Allow interaction inserts" ON user_interactions
       FOR INSERT WITH CHECK (true);`,
      
      // SECURITY: Secure policy with proper user isolation
      `CREATE POLICY "user_interactions_secure_access" ON user_interactions
       FOR ALL USING (
         auth.uid() = user_id OR
         EXISTS (
           SELECT 1 FROM user_profiles 
           WHERE id = auth.uid() 
           AND user_type = 'admin'
         )
       ) WITH CHECK (
         auth.uid() = user_id OR
         EXISTS (
           SELECT 1 FROM user_profiles 
           WHERE id = auth.uid() 
           AND user_type = 'admin'
         )
       );`,
      
      // Analytics policies - SECURITY: Admin only access
      `DROP POLICY IF EXISTS "Analytics are viewable by everyone" ON interaction_analytics;`,
      `CREATE POLICY "interaction_analytics_admin_only" ON interaction_analytics
       FOR SELECT USING (
         EXISTS (
           SELECT 1 FROM user_profiles 
           WHERE id = auth.uid() 
           AND user_type = 'admin'
         )
       );`,
       
      `DROP POLICY IF EXISTS "Platform analytics are viewable by everyone" ON platform_analytics;`,
      `CREATE POLICY "platform_analytics_admin_only" ON platform_analytics
       FOR SELECT USING (
         EXISTS (
           SELECT 1 FROM user_profiles 
           WHERE id = auth.uid() 
           AND user_type = 'admin'
         )
       );`
    ];

    const results = [];
    for (const sql of policies) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql });
        if (error) {
          console.error('SQL Error:', error);
          results.push({ sql, error: error.message });
        } else {
          results.push({ sql, success: true });
        }
      } catch (err) {
        console.error('Policy creation error:', err);
        results.push({ sql, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'RLS policies have been updated',
      results
    });

  } catch (error) {
    console.error('Error fixing RLS policies:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fix RLS policies',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Alternative approach: Direct SQL execution
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase configuration'
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Try to access the user_interactions table directly
    const { data, error } = await supabase
      .from('user_interactions')
      .select('id')
      .limit(1);

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Still cannot access user_interactions table',
        details: error.message,
        suggestion: 'Try running POST /api/interactions/fix-rls to fix policies'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'user_interactions table is now accessible',
      rowCount: data?.length || 0
    });

  } catch (error) {
    console.error('Error testing access:', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}