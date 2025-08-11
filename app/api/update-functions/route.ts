import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: NextRequest) {
  try {
    console.log('Starting database function updates...');

    // Read the SQL files
    const scriptPath1 = join(process.cwd(), 'scripts', 'update-referral-creation-function.sql');
    const scriptPath2 = join(process.cwd(), 'scripts', 'method2-referral-functions.sql');
    
    const sql1 = readFileSync(scriptPath1, 'utf-8');
    const sql2 = readFileSync(scriptPath2, 'utf-8');

    console.log('Running update-referral-creation-function.sql...');
    const { error: error1 } = await supabase.rpc('exec_sql', { sql: sql1 });
    
    if (error1) {
      console.error('Error with update-referral-creation-function:', error1);
      throw error1;
    }

    console.log('Running method2-referral-functions.sql...');
    const { error: error2 } = await supabase.rpc('exec_sql', { sql: sql2 });
    
    if (error2) {
      console.error('Error with method2-referral-functions:', error2);
      throw error2;
    }

    console.log('Database functions updated successfully!');

    return NextResponse.json({
      success: true,
      message: 'Database functions updated successfully',
      functions_updated: [
        'create_referral_for_partner',
        'update_method2_referral_customer', 
        'mark_referral_accepted_enhanced'
      ]
    });

  } catch (error) {
    console.error('Function update error:', error);
    return NextResponse.json(
      { 
        error: 'Function update failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    );
  }
}