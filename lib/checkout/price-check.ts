import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { serviceClient } from '@/lib/qr/server';
import { isStallProductId, itemNeedsShipping } from '@/lib/cart/items';
import { shippingQuoteFor } from '@/lib/shipping/rates';
import { referralRates } from '@/lib/app-settings';
import { rateFraction } from '@/lib/referrals/rates';
import { customerReferralEligibility } from '@/lib/referrals/eligibility';

/**
 * Server-side check of what the browser asks to pay.
 *
 * The browser sends the amount, so it is compared with what the basket should cost:
 * current catalogue prices (plus verified stall prices and delivery), less only the
 * discounts the server can confirm for itself:
 *   - partner discount (20%): the signed-in user is a partner
 *   - referral discount: a partner code is 10% (code exists, not expired, first discounted order); a customer's code is
 *     the "Friend's discount" setting, and only for a signed-in NEW customer (lib/referrals/eligibility.ts)
 *   - reward credit: the signed-in customer's own balance
 * Discount figures sent by the browser are never trusted.
 *
 *  ok         → at or above the expected amount
 *  low        → below it, but at least half: the order is held for review, not printed
 *  suspicious → under half: payment is refused
 *  unchecked  → the check itself could not run (database error): allowed, as before
 */
export type PriceCheckStatus = 'ok' | 'low' | 'suspicious' | 'unchecked';

export const PARTNER_DISCOUNT_RATE = 0.20;
/** Partner referral codes (the partner programme is on hold): a fixed 10%. Customer codes use the admin setting. */
export const PARTNER_REFERRAL_DISCOUNT_RATE = 0.10;

export interface PriceCheckFigures {
  /** What the browser asks to charge, in pence */
  amount: number;
  /** Catalogue price of the goods (including stall prints, less the stall multi-buy saving), in pence */
  goodsFloor: number;
  /** Delivery that must be included, in pence */
  shipping: number;
  /** Verified percentage discount on goods: 0, a referral rate (0.10 for a partner code, the setting for a customer code) or 0.20 */
  discountRate: number;
  /** Verified reward credit that may be redeemed, in pence */
  rewardsAllowed: number;
}

/**
 * The goods floor: catalogue price of the goods plus the verified stall prints, less the stall multi-buy saving.
 * The saving can never take more than the stall prints cost (lib/stall/multibuy.ts).
 */
export function goodsFloorPence(catalogue: number, stallTotal: number, stallMultibuy: number): number {
  const saving = Math.min(Math.max(0, stallMultibuy || 0), Math.max(0, stallTotal));
  return catalogue + stallTotal - saving;
}

/** Pure comparison, kept separate so it can be tested without a database. */
export function evaluatePriceCheck(f: PriceCheckFigures): { status: 'ok' | 'low' | 'suspicious'; required: number; paidForGoods: number } {
  const discounted = Math.max(0, f.goodsFloor * (1 - f.discountRate) - f.rewardsAllowed);
  const required = Math.round(discounted);
  const paidForGoods = f.amount - f.shipping;
  // Rounding differences between browser and server (per-line vs per-basket rounding)
  const tolerance = Math.max(5, Math.round(required * 0.005));
  if (paidForGoods >= required - tolerance) return { status: 'ok', required, paidForGoods };
  if (paidForGoods >= required * 0.5) return { status: 'low', required, paidForGoods };
  return { status: 'suspicious', required, paidForGoods };
}

export interface PriceCheckCartItem { productId: string; imageId?: string; quantity: number; unitPrice: number }

export interface PriceCheckRequest {
  amount: number;
  currency?: string;
  customerEmail: string;
  cartItems?: PriceCheckCartItem[];
  shippingCountry?: string | null;
  /** Delivery price the browser sent (used only where the server has no rate for the country) */
  clientShippingPrice?: number;
  referralCode?: string;
  rewardRedemption?: number;
  /** 'customer' | 'partner' | 'partner_for_client' etc. from checkoutValidation.getOrderType */
  orderType: string;
  /** Total of stall prints, already verified against the stall offer, in pence */
  stallTotal: number;
  /** Stall multi-buy saving the server worked out from the settings (lib/stall/multibuy.ts), in pence; taken off before any other discount */
  stallMultibuy?: number;
}

export interface PriceCheckResult {
  status: PriceCheckStatus;
  required: number;
  floor: number;
  paidForGoods: number;
  discountRate: number;
  rewardsAllowed: number;
  shipping: number;
  reason?: string;
  /** What the server confirmed about the referral code: always present. `discount` is pence off the goods, the server's own figure. */
  referral: ReferralOutcome;
}

export interface ReferralOutcome { applied: boolean; discount: number; ownerCustomerId: string | null; reason: string }
const NO_REFERRAL: ReferralOutcome = { applied: false, discount: 0, ownerCustomerId: null, reason: 'no code' };

/** Pence off the goods for a referral rate: the same base and rounding as evaluatePriceCheck uses for the amount required. */
export function referralDiscountPence(goodsFloor: number, discountRate: number): number {
  return Math.max(0, Math.round(goodsFloor * discountRate));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Basket lines must be whole, positive quantities at non-negative prices. */
export function invalidCartLine(items: PriceCheckCartItem[] | undefined): string | null {
  for (const i of items || []) {
    if (!Number.isInteger(i.quantity) || i.quantity < 1) return 'quantity';
    if (typeof i.unitPrice !== 'number' || !Number.isFinite(i.unitPrice) || i.unitPrice < 0) return 'unitPrice';
    if (typeof i.productId !== 'string' || !i.productId) return 'productId';
  }
  return null;
}

async function sessionUser(): Promise<{ id: string; email: string | null } | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore } as any);
    const { data: { user } } = await supabase.auth.getUser();
    return user ? { id: user.id, email: user.email?.toLowerCase() ?? null } : null;
  } catch {
    return null;
  }
}

/**
 * PARTNER codes only (the `referrals` table): the code exists, is not expired, and it is the customer's first discounted order.
 * A customer's personal code is decided by customerReferralEligibility (lib/referrals/eligibility.ts), which needs the signed-in user.
 * Returns false for a code that is not a partner code.
 */
export async function referralEligible(code: string, customerEmail: string): Promise<boolean> {
  if (typeof code !== 'string' || typeof customerEmail !== 'string') return false;   // never throw on odd input: a throw skips the whole price check
  const db = serviceClient();
  const upper = code.toUpperCase();
  const { data: referral } = await db.from('referrals').select('id, expires_at').eq('referral_code', upper).maybeSingle();
  if (!referral) return false;
  if (new Date(referral.expires_at) < new Date()) return false;
  const { data: orders } = await db.from('orders').select('referral_code, discount_amount, status').eq('customer_email', customerEmail);
  const used = (orders || []).some(o =>
    (o.referral_code || (o.discount_amount && o.discount_amount > 0)) &&
    ['confirmed', 'processing', 'shipped', 'delivered', 'completed'].includes(o.status));
  return !used;
}

/** Is this code a partner's (the `referrals` table)? */
async function isPartnerCode(code: string): Promise<boolean> {
  const { data } = await serviceClient().from('referrals').select('id').eq('referral_code', code.toUpperCase()).maybeSingle();
  return !!data;
}

export async function runPriceCheck(body: PriceCheckRequest): Promise<PriceCheckResult> {
  const base = { required: 0, floor: 0, paidForGoods: 0, discountRate: 0, rewardsAllowed: 0, shipping: 0, referral: NO_REFERRAL };
  try {
    const db = serviceClient();
    const items = body.cartItems || [];
    const catalogueItems = items.filter(i => !isStallProductId(i.productId));
    const currency = (body.currency || 'gbp').toUpperCase();

    // 1. Catalogue price of the goods
    let catalogueFloor = 0;
    let missingPrice = false;
    let needsShipping = false;
    if (catalogueItems.length) {
      const ids = Array.from(new Set(catalogueItems.map(i => i.productId)));
      if (ids.some(id => !UUID.test(id))) {
        missingPrice = true;
      } else {
        const { data: prices, error } = await db
          .from('product_pricing')
          .select('product_id, sale_price, discount_price, is_on_sale, currency_code')
          .in('product_id', ids)
          .eq('is_current', true);
        if (error) throw error;
        const min = new Map<string, number>();
        for (const p of prices ?? []) {
          if ((p.currency_code || '').toUpperCase() !== currency) continue;
          const v = p.is_on_sale && p.discount_price ? p.discount_price : p.sale_price;
          if (typeof v !== 'number') continue;
          if (!min.has(p.product_id) || v < min.get(p.product_id)!) min.set(p.product_id, v);
        }
        for (const i of catalogueItems) {
          const m = min.get(i.productId);
          if (m === undefined) { missingPrice = true; continue; }
          catalogueFloor += m * i.quantity;
        }
        // Anything that is not a digital download has to be posted
        // (same rule as itemNeedsShipping in lib/cart/items.ts; if the lookup fails, delivery is not insisted on)
        const { data: products } = await db.from('products').select('*').in('id', ids);
        if (products) needsShipping = products.some((p: any) => itemNeedsShipping({ productId: p.id, product: p }));
      }
    }

    const floor = goodsFloorPence(catalogueFloor, body.stallTotal, body.stallMultibuy || 0);

    // 2. Delivery: the server's flat rate for the country where it has one
    let shipping = 0;
    if (needsShipping || body.clientShippingPrice !== undefined) {
      shipping = shippingQuoteFor(body.shippingCountry)?.price ?? body.clientShippingPrice ?? 0;
    }

    // 3. Discounts the server can confirm
    const user = await sessionUser();
    let discountRate = 0;
    if (user) {
      const { data: profile } = await db.from('user_profiles').select('user_type').eq('user_id', user.id).maybeSingle();
      if (profile?.user_type === 'partner') discountRate = PARTNER_DISCOUNT_RATE;
    }
    let referral: ReferralOutcome = NO_REFERRAL;
    if (!discountRate && body.referralCode && body.customerEmail) {
      if (await isPartnerCode(body.referralCode)) {
        // Partner code: unchanged (fixed 10%, first discounted order)
        if (await referralEligible(body.referralCode, body.customerEmail)) {
          discountRate = PARTNER_REFERRAL_DISCOUNT_RATE;
          referral = { applied: true, discount: 0, ownerCustomerId: null, reason: 'ok' };
        } else referral = { ...NO_REFERRAL, reason: 'partner code not eligible' };
      } else {
        // Customer code: signed in, new customer, someone else's code; the rate is the admin setting
        const e = await customerReferralEligibility(body.referralCode, body.customerEmail, user?.email ?? null);
        if (e.eligible) {
          discountRate = rateFraction((await referralRates()).friendPct);
          referral = { applied: discountRate > 0, discount: 0, ownerCustomerId: e.ownerCustomerId, reason: discountRate > 0 ? 'ok' : 'rate is 0' };
        } else referral = { ...NO_REFERRAL, reason: e.reason };
      }
    } else if (discountRate && body.referralCode) {
      referral = { ...NO_REFERRAL, reason: 'partner discount applies' };
    }
    if (referral.applied) referral = { ...referral, discount: referralDiscountPence(floor, discountRate) };

    let rewardsAllowed = 0;
    const claimed = body.rewardRedemption && body.rewardRedemption > 0 ? body.rewardRedemption : 0;
    if (claimed && body.orderType === 'customer' && user?.email && user.email === body.customerEmail.toLowerCase().trim()) {
      const { data: customer } = await db.from('customers').select('current_credit_balance').eq('email', user.email).maybeSingle();
      rewardsAllowed = Math.min(claimed, Math.max(0, customer?.current_credit_balance || 0));
    }

    const verdict = evaluatePriceCheck({ amount: body.amount, goodsFloor: floor, shipping, discountRate, rewardsAllowed });
    const result: PriceCheckResult = { ...verdict, floor, discountRate, rewardsAllowed, shipping, referral };

    // A product with no current price in this currency cannot be priced by the server:
    // never better than "low", so the order is looked at before anything is printed.
    if (missingPrice && result.status === 'ok') return { ...result, status: 'low', reason: 'no current price for a product in this currency' };
    return result;
  } catch (e) {
    console.warn('Price check could not run', e);
    return { ...base, status: 'unchecked', reason: 'check failed' };
  }
}
