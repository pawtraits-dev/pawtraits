import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// SAFE cleanup API route - preserves admin AUTH records
export async function POST(request: Request) {
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

    // CRITICAL: Get admin user IDs to preserve
    const { data: adminProfiles, error: adminError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, first_name, last_name, email')
      .eq('user_type', 'admin');

    if (adminError) throw adminError;

    if (!adminProfiles || adminProfiles.length === 0) {
      return NextResponse.json({
        error: 'No admin users found! Aborting cleanup to prevent lockout.',
        warning: 'This could lock you out of the system.'
      }, { status: 400 });
    }

    const adminUserIds = adminProfiles.map(profile => profile.user_id);

    // Get current auth users
    const { data: allAuthUsers, error: countError } = await supabaseAdmin.auth.admin.listUsers();
    if (countError) throw countError;

    const beforeCount = allAuthUsers.users.length;
    
    // SAFETY: Show what will be preserved vs deleted
    const adminAuthUsers = allAuthUsers.users.filter(user => 
      adminUserIds.includes(user.id)
    );
    
    const usersToDelete = allAuthUsers.users.filter(user => 
      !adminUserIds.includes(user.id)
    );

    // SAFETY CHECK: Ensure we have admin users to preserve
    if (adminAuthUsers.length === 0) {
      return NextResponse.json({
        error: 'No admin AUTH users found! This would lock you out.',
        adminProfiles: adminProfiles.length,
        authUsers: beforeCount
      }, { status: 400 });
    }

    // Show what we're about to do (for verification)
    const preview = {
      totalAuthUsers: beforeCount,
      adminUsersToPreserve: adminAuthUsers.map(u => ({ 
        id: u.id, 
        email: u.email 
      })),
      usersToDelete: usersToDelete.map(u => ({ 
        id: u.id, 
        email: u.email,
        created_at: u.created_at
      }))
    };

    // Check if this is a preview request
    const url = new URL(request.url);
    if (url.searchParams.get('preview') === 'true') {
      return NextResponse.json({
        preview: true,
        message: 'This is what would happen (no changes made)',
        ...preview,
        instruction: 'Call again without ?preview=true to execute'
      });
    }

    // Actually delete non-admin auth users
    let deletedCount = 0;
    let errors = [];
    
    for (const user of usersToDelete) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (error) {
        console.error(`Failed to delete user ${user.id}:`, error);
        errors.push({ userId: user.id, email: user.email, error: error.message });
      } else {
        deletedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Auth users cleanup completed safely',
      stats: {
        beforeCount,
        deletedCount,
        remainingCount: beforeCount - deletedCount,
        adminUsersPreserved: adminAuthUsers.length,
        errors: errors.length > 0 ? errors : undefined
      },
      preservedAdmins: adminAuthUsers.map(u => ({ 
        id: u.id, 
        email: u.email 
      }))
    });

  } catch (error) {
    console.error('Auth cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup auth users', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE THIS FILE AFTER RUNNING THE CLEANUP!