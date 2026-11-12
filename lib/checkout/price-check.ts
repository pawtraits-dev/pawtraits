import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { serviceClient } from '@/lib/qr/server';
import { isStallProductId, itemNeedsShipping } from '@/lib/cart/items';
import { shippingQuoteFor } from '@/lib/shipping/rates';

/**
 * Server-side check of what the browser asks to pay.
 *
 * The browser sends the amount, so it is compared with what the basket should cost:
 * current catalogue prices (plus verified stall prices and delivery), less only the
 * discounts the server can confirm for itself:
 *   - partner discount (20%): the signed-in user is a partner
 *   - referral discount (10%, first order): the code exists and the customer is eligible
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
export const REFERRAL_DISCOUNT_RATE = 0.10;

export interface PriceCheckFigures {
  /** What the browser asks to charge, in pence */
  amount: number;
  /** Catalogue price of the goods (including stall prints), in pence */
  goodsFloor: number;
  /** Delivery that must be included, in pence */
  shipping: number;
  /** Verified percentage discount on goods: 0, 0.10 or 0.20 */
  discountRate: number;
  /** Verified reward credit that may be redeemed, in pence */
  rewardsAllowed: number;
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

/** Same rules as POST /api/referrals/validate: the code exists, is not expired, is not the customer's own, and it is their first discounted order. */
async function referralEligible(code: string, customerEmail: string): Promise<boolean> {
  const db = serviceClient();
  const upper = code.toUpperCase();
  const { data: referral } = await db.from('referrals').select('id, expires_at').eq('referral_code', upper).maybeSingle();
  if (referral) {
    if (new Date(referral.expires_at) < new Date()) return false;
  } else {
    const { data: owner } = await db.from('customers').select('id, email').eq('personal_referral_code', upper).maybeSingle();
    if (!owner) return false;
    if ((owner.email || '').toLowerCase() === customerEmail.toLowerCase()) return false;
  }
  const { data: orders } = await db.from('orders').select('referral_code, discount_amount, status').eq('customer_email', customerEmail);
  const used = (orders || []).some(o =>
    (o.referral_code || (o.discount_amount && o.discount_amount > 0)) &&
    ['confirmed', 'processing', 'shipped', 'delivered', 'completed'].includes(o.status));
  return !used;
}

export async function runPriceCheck(body: PriceCheckRequest): Promise<PriceCheckResult> {
  const base = { required: 0, floor: 0, paidForGoods: 0, discountRate: 0, rewardsAllowed: 0, shipping: 0 };
  try {
    const db = serviceClient();
    const items = body.cartItems || [];
    const catalogueItems = items.filter(i => !isStallProductId(i.productId));
    const currency = (body.currency || 'gbp').toUpperCase();

    // 1. Catalogue price of the goods
    let floor = body.stallTotal;
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
          floor += m * i.quantity;
        }
        // Anything that is not a digital download has to be posted
        // (same rule as itemNeedsShipping in lib/cart/items.ts; if the lookup fails, delivery is not insisted on)
        const { data: products } = await db.from('products').select('*').in('id', ids);
        if (products) needsShipping = products.some((p: any) => itemNeedsShipping({ productId: p.id, product: p }));
      }
    }

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
    if (!discountRate && body.referralCode && body.customerEmail) {
      if (await referralEligible(body.referralCode, body.customerEmail)) discountRate = REFERRAL_DISCOUNT_RATE;
    }

    let rewardsAllowed = 0;
    const claimed = body.rewardRedemption && body.rewardRedemption > 0 ? body.rewardRedemption : 0;
    if (claimed && body.orderType === 'customer' && user?.email && user.email === body.customerEmail.toLowerCase().trim()) {
      const { data: customer } = await db.from('customers').select('current_credit_balance').eq('email', user.email).maybeSingle();
      rewardsAllowed = Math.min(claimed, Math.max(0, customer?.current_credit_balance || 0));
    }

    const verdict = evaluatePriceCheck({ amount: body.amount, goodsFloor: floor, shipping, discountRate, rewardsAllowed });
    const result: PriceCheckResult = { ...verdict, floor, discountRate, rewardsAllowed, shipping };

    // A product with no current price in this currency cannot be priced by the server:
    // never better than "low", so the order is looked at before anything is printed.
    if (missingPrice && result.status === 'ok') return { ...result, status: 'low', reason: 'no current price for a product in this currency' };
    return result;
  } catch (e) {
    console.warn('Price check could not run', e);
    return { ...base, status: 'unchecked', reason: 'check failed' };
  }
}
