import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Temporary API route to cleanup auth users - DELETE THIS AFTER USE
export async function POST() {
  try {
    // Service role client (bypasses RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get admin user IDs to preserve
    const { data: adminProfiles, error: adminError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id')
      .eq('user_type', 'admin');

    if (adminError) throw adminError;

    const adminUserIds = adminProfiles.map(profile => profile.user_id);

    // Get current auth users count
    const { data: allAuthUsers, error: countError } = await supabaseAdmin.auth.admin.listUsers();
    if (countError) throw countError;

    const beforeCount = allAuthUsers.users.length;
    
    // Delete non-admin auth users
    const usersToDelete = allAuthUsers.users.filter(user => 
      !adminUserIds.includes(user.id)
    );

    let deletedCount = 0;
    for (const user of usersToDelete) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (error) {
        console.error(`Failed to delete user ${user.id}:`, error);
      } else {
        deletedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Auth users cleanup completed',
      stats: {
        beforeCount,
        deletedCount,
        remainingCount: beforeCount - deletedCount,
        adminUsersPreserved: adminUserIds.length
      }
    });

  } catch (error) {
    console.error('Auth cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup auth users' },
      { status: 500 }
    );
  }
}

// DELETE THIS FILE AFTER RUNNING THE CLEANUP!