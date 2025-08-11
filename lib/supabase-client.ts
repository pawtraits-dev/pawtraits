import { createClient } from '@supabase/supabase-js';

// Singleton Supabase client
let supabaseInstance: any = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabaseInstance;
}

// Export the singleton for direct use
export const supabase = getSupabaseClient();