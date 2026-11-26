import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/app-settings';
import { parseMultibuyTiers } from '@/lib/stall/multibuy';

/**
 * GET /api/public/stall-multibuy → { tiers: [{ count, savingPence }] }
 * The stall multi-buy saving, so the basket and checkout show what the server will charge. [] = switched off. No personal data.
 */
export async function GET() {
  const tiers = parseMultibuyTiers(await getSetting('stall_multibuy_pence'));
  return NextResponse.json({ tiers }, { headers: { 'Cache-Control': 'public, max-age=30' } });
}
