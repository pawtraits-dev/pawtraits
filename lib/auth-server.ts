import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

// Server-side authentication helper for API routes
export async function getServerPartner(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Verify the token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log('Auth error or no user:', error);
      return null;
    }

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('*')
      .eq('id', user.id)
      .single();

    if (partnerError || !partner) {
      console.log('Partner error or no partner:', partnerError);
      return null;
    }

    return partner;
  } catch (error) {
    console.error('Error getting server partner:', error);
    return null;
  }
}

// Alternative: Get partner from session cookie
export async function getPartnerFromSession(request: NextRequest) {
  try {
    // Get session from cookie
    const cookies = request.headers.get('cookie');
    if (!cookies) {
      return null;
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // This would need to parse the session cookie properly
    // For now, let's use a simpler approach
    
    return null;
  } catch (error) {
    console.error('Error getting partner from session:', error);
    return null;
  }
}

// Simple approach: require partner ID in request
export async function requirePartnerAuth(request: NextRequest) {
  const partnerId = request.headers.get('x-partner-id');
  
  if (!partnerId) {
    throw new Error('Partner ID required in x-partner-id header');
  }

  // Create Supabase client  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Get partner record
  const { data: partner, error } = await supabase
    .from('partners')
    .select('*')
    .eq('id', partnerId)
    .single();

  if (error || !partner) {
    throw new Error('Partner not found or not authorized');
  }

  return partner;
}