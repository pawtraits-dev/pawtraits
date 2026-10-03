/**
 * GET /api/public/social/feed → { items: FeedItem[] }
 * Latest paid customised Pawtraits for the home page "recent custom creations" strip.
 * Empty when the feed is switched off. Edge-cached 2 minutes.
 */
import { NextResponse } from 'next/server';
import { getFeed } from '@/lib/social/feed';

export async function GET() {
  try {
    const items = await getFeed(12);
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } });
  } catch (err) {
    console.error('social feed failed', err);
    return NextResponse.json({ items: [] });
  }
}
