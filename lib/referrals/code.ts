/**
 * Making a customer's personal referral code (the one in customers.personal_referral_code).
 * This is the code path guest accounts have always used (moved here unchanged so the share helper
 * can use it too): first letters of the name + 8 characters, checked unique.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export async function uniqueReferralCode(supabase: SupabaseClient, name: string): Promise<string | null> {
  const prefix = name.substring(0, 4).replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'CUST';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 10; i++) {
    let code = prefix;
    for (let j = 0; j < 8; j++) code += chars[Math.floor(Math.random() * chars.length)];
    const { data } = await supabase.from('customers').select('id').eq('personal_referral_code', code).maybeSingle();
    if (!data) return code;
  }
  return null;
}
