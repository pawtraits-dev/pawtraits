import { NextResponse } from 'next/server';
import { getStallMultibuyTiers } from '@/lib/app-settings';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/stall-multibuy → { tiers: [{ count, savingPence }] }
 * The stall multi-buy saving, so the basket and checkout show what the server will charge. [] = switched off. No personal data.
 */
export async function GET() {
  const tiers = await getStallMultibuyTiers();
  return NextResponse.json({ tiers }, { headers: { 'Cache-Control': 'no-store' } });
}
