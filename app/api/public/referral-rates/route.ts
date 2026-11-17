import { NextResponse } from 'next/server';
import { referralRates } from '@/lib/app-settings';

/**
 * GET /api/public/referral-rates → { friendPct, referrerPct }
 * The two customer-referral percentages, so the wording on every page follows the admin settings. No personal data.
 */
export async function GET() {
  const rates = await referralRates();
  return NextResponse.json(rates, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
