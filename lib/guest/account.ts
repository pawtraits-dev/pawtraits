/**
 * Post-order account creation for guest checkouts.
 *
 *   ensureCustomerAccount → auth user (email pre-confirmed, no password) + customers row
 *                           + user_profiles row, and adopt the device's guest previews
 *   createClaimToken      → long-lived (14 day) link token; the raw token only goes in the email
 *   sendAccountReadyEmail → "your account is ready + free download" email
 *
 * The claim link is exchanged for a *fresh* Supabase magic-link session when clicked
 * (app/api/auth/claim), so it doesn't expire in the inbox after an hour.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import { sendMessage } from '@/lib/messaging/message-service';

export const CLAIM_TOKEN_DAYS = 14;

export interface EnsuredAccount {
  userId: string;
  customerId: string | null;
  userProfileId: string | null;
  created: boolean;
}

export async function ensureCustomerAccount(
  supabase: SupabaseClient,
  input: { email: string; firstName?: string | null; lastName?: string | null; phone?: string | null; marketingConsent?: boolean; guestSessionId?: string | null }
): Promise<EnsuredAccount> {
  const email = input.email.trim().toLowerCase();
  const firstName = (input.firstName || '').trim() || null;
  const lastName = (input.lastName || '').trim() || null;

  // 1. Already has an account?
  const { data: profile } = await supabase
    .from('user_profiles').select('id, user_id, customer_id').ilike('email', email).maybeSingle();
  if (profile) {
    await adoptGuestImages(supabase, input.guestSessionId, profile.customer_id, email);
    return { userId: profile.user_id, customerId: profile.customer_id, userProfileId: profile.id, created: false };
  }

  // 2. Auth user (no password; they sign in by link, and can set a password later)
  let userId: string | null = null;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName, user_type: 'customer', created_via: 'guest_checkout' },
  });
  if (created?.user) {
    userId = created.user.id;
  } else {
    // Exists in auth but has no profile (e.g. abandoned signup) — fetch the id
    const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
    if (!link?.user) throw new Error(`Could not create or find auth user for ${email}: ${createErr?.message} / ${linkErr?.message}`);
    userId = link.user.id;
  }

  // 3. customers row (may already exist from an earlier flow)
  const { data: existingCustomer } = await supabase.from('customers').select('id, personal_referral_code').eq('email', email).maybeSingle();
  let customerId: string | null = existingCustomer?.id ?? null;
  const referralCode = existingCustomer?.personal_referral_code || (await uniqueReferralCode(supabase, firstName || 'CUST'));
  const customerFields = {
    email,
    first_name: firstName,
    last_name: lastName,
    phone: input.phone || null,
    user_id: userId,
    is_registered: true,
    marketing_consent: !!input.marketingConsent,
    personal_referral_code: referralCode,
    referral_type: 'ORGANIC',
    updated_at: new Date().toISOString(),
  };
  if (customerId) {
    await supabase.from('customers').update(customerFields).eq('id', customerId);
  } else {
    const { data: c, error } = await supabase.from('customers').insert(customerFields).select('id').single();
    if (error) console.error('Guest account: customers insert failed', error);
    customerId = c?.id ?? null;
  }

  // 4. user_profiles row (same DB function the normal signup uses)
  const { error: profileErr } = await supabase.rpc('create_user_profile', {
    p_user_id: userId,
    p_user_type: 'customer',
    p_first_name: firstName,
    p_last_name: lastName,
    p_email: email,
    p_phone: input.phone || null,
    p_partner_id: null,
    p_customer_id: customerId,
  });
  if (profileErr) console.error('Guest account: create_user_profile failed', profileErr);
  const { data: newProfile } = await supabase.from('user_profiles').select('id').eq('user_id', userId).maybeSingle();

  await adoptGuestImages(supabase, input.guestSessionId, customerId, email);
  return { userId: userId!, customerId, userProfileId: newProfile?.id ?? null, created: true };
}

/** Previews made on this device before they had an account now appear in "My Pawtraits". */
async function adoptGuestImages(supabase: SupabaseClient, guestSessionId: string | null | undefined, customerId: string | null, email: string) {
  if (!guestSessionId || !customerId) return;
  const { error } = await supabase
    .from('customer_custom_images')
    .update({ customer_id: customerId, customer_email: email })
    .eq('guest_session_id', guestSessionId)
    .is('customer_id', null);
  if (error) console.error('adoptGuestImages failed', error);
}

async function uniqueReferralCode(supabase: SupabaseClient, name: string): Promise<string | null> {
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

export const hashClaimToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

export async function createClaimToken(
  supabase: SupabaseClient,
  input: { userId: string; customerId: string | null; email: string; orderId: string | null }
): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  const { error } = await supabase.from('account_claim_tokens').insert({
    token_hash: hashClaimToken(raw),
    user_id: input.userId,
    customer_id: input.customerId,
    email: input.email.toLowerCase(),
    order_id: input.orderId,
    expires_at: new Date(Date.now() + CLAIM_TOKEN_DAYS * 86400_000).toISOString(),
  });
  if (error) throw error;
  return raw;
}

export async function sendAccountReadyEmail(
  supabase: SupabaseClient,
  input: { email: string; firstName: string | null; orderId: string; orderNumber: string; claimToken: string; userProfileId: string | null; baseUrl: string }
) {
  // Preview of the design they get free (watermarked preview is fine for the email)
  const { data: gift } = await supabase
    .from('digital_entitlements')
    .select('custom_image_id, catalog_image_id')
    .eq('order_id', input.orderId)
    .eq('source', 'welcome_gift')
    .limit(1)
    .maybeSingle();
  let giftImageUrl: string | null = null;
  if (gift?.custom_image_id) {
    const { data } = await supabase.from('customer_custom_images').select('generated_image_url').eq('id', gift.custom_image_id).maybeSingle();
    giftImageUrl = data?.generated_image_url ?? null;
  } else if (gift?.catalog_image_id) {
    const { data } = await supabase.from('image_catalog').select('public_url').eq('id', gift.catalog_image_id).maybeSingle();
    giftImageUrl = data?.public_url ?? null;
  }

  await sendMessage({
    templateKey: 'guest_account_ready',
    recipientType: 'customer',
    recipientId: input.userProfileId,
    recipientEmail: input.email,
    variables: {
      customer_name: input.firstName || 'there',
      claim_url: `${input.baseUrl}/auth/claim?t=${encodeURIComponent(input.claimToken)}`,
      has_gift: !!gift,
      gift_image_url: giftImageUrl,
      order_number: input.orderNumber,
      expires_days: CLAIM_TOKEN_DAYS,
      base_url: input.baseUrl,
    },
    priority: 'high',
  } as any);
}
