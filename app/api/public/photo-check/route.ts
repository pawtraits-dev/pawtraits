/**
 * POST /api/public/photo-check (multipart: photo) → { pets: number | null }
 * Used on multi-pet designs when a photo is added: each photo should show one pet. Advice only;
 * the page warns but lets people carry on. Max 6 MB; 40 checks per visitor per hour.
 */
import { NextRequest, NextResponse } from 'next/server';
import { countPets } from '@/lib/catalog/pet-count';
import { getClientIp } from '@/lib/public-rate-limiter';

export const dynamic = 'force-dynamic';
const HOURLY = 40;
const seen = new Map<string, { n: number; at: number }>();

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const now = Date.now();
  const cur = seen.get(ip);
  if (cur && now - cur.at < 3600_000 && cur.n >= HOURLY) return NextResponse.json({ pets: null });
  seen.set(ip, cur && now - cur.at < 3600_000 ? { n: cur.n + 1, at: cur.at } : { n: 1, at: now });
  if (seen.size > 5000) seen.forEach((v, k) => { if (now - v.at > 3600_000) seen.delete(k); });

  try {
    const form = await request.formData();
    const file = form.get('photo');
    if (!(file instanceof File) || file.size === 0 || file.size > 6 * 1024 * 1024) return NextResponse.json({ pets: null });
    const type = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
    const pets = await countPets(Buffer.from(await file.arrayBuffer()).toString('base64'), type);
    return NextResponse.json({ pets });
  } catch {
    return NextResponse.json({ pets: null });
  }
}
