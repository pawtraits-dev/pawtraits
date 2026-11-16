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
