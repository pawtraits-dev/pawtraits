import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/** Service-role client for server routes (bypasses RLS). */
export function serviceClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Admin check for route handlers using the session cookie.
 * Returns null when the caller is an admin, otherwise a 401/403 response.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  try {
    const cookieStore = await cookies();
    const auth = createRouteHandlerClient({ cookies: () => cookieStore } as any);
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { data: profile } = await serviceClient()
      .from('user_profiles')
      .select('user_type')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.user_type !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return null;
  } catch (e) {
    console.error('requireAdmin failed:', e);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }
}
