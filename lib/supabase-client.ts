import { createClient } from '@supabase/supabase-js';

// Singleton Supabase client
let supabaseInstance: any = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables:', {
        url: !!supabaseUrl,
        key: !!supabaseAnonKey,
        urlValue: supabaseUrl?.substring(0, 20) + '...',
      });
      throw new Error('Missing Supabase environment variables. Please check your .env.local file or Vercel environment variables.');
    }
    
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
      console.log('Supabase client created successfully');
    } catch (error) {
      console.error('Failed to create Supabase client:', error);
      throw error;
    }
  }
  return supabaseInstance;
}

// Export the singleton for direct use
export const supabase = getSupabaseClient();