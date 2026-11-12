import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Create service role client (server-side only)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not found in environment');
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // First, verify the user exists
    console.log('Looking up user with ID:', userId);
    const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(userId);
    
    if (getUserError || !userData.user) {
      console.error('User lookup failed:', getUserError);
      
      // List all users to see what's actually in the database
      const { data: allUsers, error: listError } = await supabase.auth.admin.listUsers();
      console.log('All users in database:', allUsers?.users?.map(u => ({ id: u.id, email: u.email })));
      
      throw new Error(`User with ID ${userId} not found in auth database`);
    }
    
    console.log('Found user:', {
      id: userData.user.id,
      email: userData.user.email,
      confirmed: !!userData.user.email_confirmed_at
    });

    // Already confirmed: same success response as before, nothing to change
    if (userData.user.email_confirmed_at) {
      console.log('User email is already confirmed');
      return NextResponse.json({ 
        success: true,
        message: 'User email confirmed successfully'
      });
    }

    // Only accounts created in the last 10 minutes may be confirmed this way (signup flow)
    const createdAtMs = new Date(userData.user.created_at).getTime();
    if (!(Date.now() - createdAtMs <= 10 * 60 * 1000)) {
      console.warn('Refusing to confirm user outside signup window:', userData.user.id);
      return NextResponse.json(
        { error: 'Confirmation not allowed' },
        { status: 403 }
      );
    }

    // Confirm the user's email
    const { data, error } = await supabase.auth.admin.updateUserById(
      userId,
      { email_confirm: true }
    );

    if (error) {
      console.error('Failed to confirm user email:', error);
      throw error;
    }

    console.log('User email confirmed successfully:', data.user.email);
    
    return NextResponse.json({ 
      success: true,
      message: 'User email confirmed successfully'
    });
    
  } catch (error) {
    console.error('Error confirming user email:', error);
    return NextResponse.json(
      { error: 'Failed to confirm user email' },
      { status: 500 }
    );
  }
}