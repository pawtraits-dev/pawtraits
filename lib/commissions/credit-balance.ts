/**
 * Store credit arithmetic. Everything here is in PENCE: customers.current_credit_balance, the
 * rewardRedemption amount in the payment metadata, and orders.credit_applied are all integer pence.
 */

/**
 * The balance left after a customer spends credit at checkout.
 * Never below zero; never more taken than was held; a missing or malformed amount takes nothing.
 */
export function balanceAfterRedemption(balancePence: number | null | undefined, redeemedPence: number | null | undefined): number {
  const balance = Number.isFinite(balancePence as number) ? Math.max(0, Math.round(balancePence as number)) : 0;
  const redeemed = Number.isFinite(redeemedPence as number) ? Math.max(0, Math.round(redeemedPence as number)) : 0;
  return Math.max(0, balance - redeemed);
}

/**
 * The redemption to record against a payment (PaymentIntent metadata, then orders.credit_applied and the
 * deduction). The browser CLAIMS an amount; the server price check works out how much the signed-in customer
 * really holds (`rewardsAllowed`). Record the smaller of the two, so a made-up claim can neither be deducted
 * nor inflate the pre-discount order value that referral credit and partner commission are worked out from.
 * If the check could not run at all ('unchecked'), nothing is confirmed, so nothing is recorded; create-intent
 * refuses such a payment before it is taken, so a genuine redemption is never left undeducted.
 */
export function redemptionToRecord(claimedPence: number | null | undefined, check: { status: string; rewardsAllowed?: number | null }): number {
  const claimed = Number.isFinite(claimedPence as number) ? Math.max(0, Math.round(claimedPence as number)) : 0;
  if (!claimed) return 0;
  if (check.status === 'unchecked') return 0;
  const allowed = Number.isFinite(check.rewardsAllowed as number) ? Math.max(0, Math.round(check.rewardsAllowed as number)) : 0;
  return Math.min(claimed, allowed);
}

/** Order statuses that mean the order was not, in the end, a sale (same set as the admin reports use) */
const NOT_A_SALE = new Set(['cancelled', 'canceled', 'refunded', 'failed']);

/**
 * A referrer earns credit on the FIRST order their friend places, and only that one (the friend's own
 * discount is first-order only too). Given the friend's OTHER orders (not the one being processed),
 * true when none of them is a paid order that still stands.
 */
export function isFriendsFirstOrder(otherOrders: { payment_status?: string | null; status?: string | null }[] | null | undefined): boolean {
  return !(otherOrders || []).some(o =>
    String(o.payment_status ?? '').toLowerCase() === 'paid' && !NOT_A_SALE.has(String(o.status ?? '').toLowerCase()));
}
