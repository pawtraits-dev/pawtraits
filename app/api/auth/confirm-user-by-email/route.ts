import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
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

    // Find user by email
    console.log('Looking for user with email:', email);
    const { data: allUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      throw listError;
    }
    
    const user = allUsers.users.find(u => u.email === email);
    
    if (!user) {
      console.log('Available users:', allUsers.users.map(u => ({ id: u.id, email: u.email })));
      throw new Error(`User with email ${email} not found in auth database`);
    }
    
    console.log('Found user by email:', {
      id: user.id,
      email: user.email,
      confirmed: !!user.email_confirmed_at
    });

    if (user.email_confirmed_at) {
      console.log('User email is already confirmed');
      return NextResponse.json({ 
        success: true,
        message: 'User email is already confirmed',
        userId: user.id
      });
    }

    // Confirm the user's email using the real user ID
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (error) {
      console.error('Failed to confirm user email:', error);
      throw error;
    }

    console.log('User email confirmed successfully:', data.user.email);
    
    return NextResponse.json({ 
      success: true,
      message: 'User email confirmed successfully',
      userId: user.id
    });
    
  } catch (error) {
    console.error('Error confirming user email:', error);
    return NextResponse.json(
      { error: 'Failed to confirm user email' },
      { status: 500 }
    );
  }
}