import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Use Next.js Supabase auth helpers instead of direct client creation
export function getSupabaseClient() {
  return createClientComponentClient();
}

// Export a function that creates a client when needed (not immediately)
export function createClient() {
  return createClientComponentClient();
}