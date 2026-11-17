import { serviceClient } from '@/lib/qr/server';
import { isFriendsFirstOrder } from '@/lib/commissions/credit-balance';

/**
 * The one rule for a friend's referral discount on a CUSTOMER's code (partner codes keep their own rules in
 * lib/checkout/price-check.ts). Decided 17 Nov 2026:
 *  1. the code must belong to a registered customer (checked first, so a guest with a made-up code is told so);
 *     then the friend must be signed in, as the email they are buying with, and the code not their own;
 *  3. the friend is a new customer: no earlier paid order under that email that still stands (a code or no code);
 *  4. the friend has not already joined through a different customer's code, or through a partner.
 */
export type FriendEligibilityReason = 'ok' | 'not_signed_in' | 'not_found' | 'own_code' | 'not_new' | 'referred_by_someone_else';

export interface FriendEligibilityInput {
  /** The signed-in user's email, lower-cased, or null for a guest */
  signedInEmail: string | null;
  /** The email the customer is buying with, as typed */
  customerEmail: string;
  ownerFound: boolean;
  ownerEmail: string | null;
  ownerCustomerId: string | null;
  friendCustomer: { referral_type?: string | null; referrer_id?: string | null } | null;
  friendOrders: { payment_status?: string | null; status?: string | null }[];
}

const norm = (e: string | null | undefined) => String(e ?? '').trim().toLowerCase();

export function friendEligibility(i: FriendEligibilityInput): { eligible: boolean; reason: FriendEligibilityReason } {
  const no = (reason: FriendEligibilityReason) => ({ eligible: false, reason });
  // The code is looked at first, so a guest with a code that does not exist is told so rather than asked to sign up
  if (!i.ownerFound) return no('not_found');
  if (!i.signedInEmail || norm(i.signedInEmail) !== norm(i.customerEmail)) return no('not_signed_in');
  if (i.ownerEmail && norm(i.ownerEmail) === norm(i.customerEmail)) return no('own_code');
  if (!isFriendsFirstOrder(i.friendOrders)) return no('not_new');
  // Already referred by a different customer, or by a partner (a partner referral earns the partner commission, so a
  // customer code would give the friend a discount while its owner got nothing)
  const fc = i.friendCustomer;
  if (fc?.referrer_id) {
    if (fc.referral_type === 'PARTNER') return no('referred_by_someone_else');
    if (fc.referral_type === 'CUSTOMER' && fc.referrer_id !== i.ownerCustomerId) return no('referred_by_someone_else');
  }
  return { eligible: true, reason: 'ok' };
}

/** What to tell the customer for each reason (house voice, no emoji). `pct` is the friend's discount, e.g. "20%". */
export function eligibilityMessage(reason: FriendEligibilityReason, pct: string): string {
  switch (reason) {
    case 'not_signed_in': return `Create an account or sign in to get ${pct} off your first order.`;
    case 'not_new': return 'Referral discounts are for a first order.';
    case 'own_code': return "That's your own code. Share it with a friend instead.";
    case 'referred_by_someone_else': return "You've already joined through another friend's code.";
    case 'not_found': return "We don't recognise that code.";
    default: return `${pct} off your first order.`;
  }
}

/** Escape % and _ so an email is matched whole by ilike (same as the webhook's emailPattern) */
export const emailPattern = (email: string) => email.trim().replace(/[\\%_]/g, (c: string) => '\\' + c);

export interface CustomerReferralEligibility {
  eligible: boolean;
  reason: FriendEligibilityReason;
  ownerCustomerId: string | null;
}

/**
 * Looks everything up with the service client and applies friendEligibility. Only customer codes: the owner
 * must be a registered customer (same as /api/referrals/verify). A lookup that fails throws, so the caller
 * (the price check) treats the payment as unchecked rather than guessing.
 */
export async function customerReferralEligibility(code: string, customerEmail: string, signedInEmail: string | null): Promise<CustomerReferralEligibility> {
  const none = (reason: FriendEligibilityReason): CustomerReferralEligibility => ({ eligible: false, reason, ownerCustomerId: null });
  if (typeof code !== 'string' || typeof customerEmail !== 'string' || !code || !customerEmail.trim()) return none('not_found');
  const db = serviceClient();
  const upper = code.trim().toUpperCase();
  // A guest can never qualify, but is told whether the code exists before being asked to sign up (own code cannot be known for a guest)
  if (!signedInEmail || norm(signedInEmail) !== norm(customerEmail)) {
    const { data: found, error } = await db.from('customers').select('id').eq('personal_referral_code', upper).eq('is_registered', true).maybeSingle();
    if (error) throw error;
    return none(found ? 'not_signed_in' : 'not_found');
  }

  const pattern = emailPattern(customerEmail);
  const [ownerRes, friendRes, ordersRes] = await Promise.all([
    db.from('customers').select('id, email').eq('personal_referral_code', upper).eq('is_registered', true).maybeSingle(),
    db.from('customers').select('referral_type, referrer_id').ilike('email', pattern).limit(1).maybeSingle(),
    db.from('orders').select('payment_status, status').ilike('customer_email', pattern).limit(200),
  ]);
  if (ownerRes.error) throw ownerRes.error;
  if (friendRes.error) throw friendRes.error;
  if (ordersRes.error) throw ordersRes.error;

  const owner = ownerRes.data;
  const result = friendEligibility({
    signedInEmail,
    customerEmail,
    ownerFound: !!owner,
    ownerEmail: owner?.email ?? null,
    ownerCustomerId: owner?.id ?? null,
    friendCustomer: friendRes.data ?? null,
    friendOrders: ordersRes.data ?? [],
  });
  return { ...result, ownerCustomerId: owner?.id ?? null };
}
