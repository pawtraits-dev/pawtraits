/**
 * Admin → Catalogue → a design → Words on the picture (lib/picture-words.ts).
 * GET    settings, the design's breed phrase, its versions and the clean copy
 * PATCH  { words: {...} }  save the wording, font, colour and box (nothing redrawn yet)
 * POST   { action: 'set-clean', public_id, width, height }  the text-free copy (uploaded by the browser)
 *        { action: 'apply', versions?: true, adoptClean?: true }  draw the words on the design (and its
 *        breed versions; adoptClean: versions with no words set up were painted without words, so
 *        their own picture is their clean copy)
 *        { action: 'remove' }  no words: back to the picture it had first
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { DEFAULT_WORDS, readWords } from '@/lib/picture-words';
import { applyWordsToDesign, applyWordsToVersions, breedPhrase } from '@/lib/picture-words-server';
import { catalogVariants } from '@/lib/catalog/register-image';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const UUID = /^[0-9a-f-]{36}$/i;
const NEEDS_MIGRATION = 'Run the 2026-10-23-picture-words migration first';

async function load(id: string) {
  const supabase = serviceClient();
  const { data, error } = await supabase.from('image_catalog').select('id, breed_id, cloudinary_public_id, public_url, text_overlay').eq('id', id).maybeSingle();
  return { supabase, row: data as any, error };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { supabase, row, error } = await load(id);
  if (error) return NextResponse.json({ error: error.message.includes('text_overlay') ? NEEDS_MIGRATION : error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: versions } = await supabase.from('image_catalog').select('id, text_overlay').eq('variation_of', id).limit(500);
  return NextResponse.json({
    words: readWords(row.text_overlay),
    defaults: DEFAULT_WORDS,
    phrase: await breedPhrase(supabase, row.breed_id),
    current: row.cloudinary_public_id,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    versions: { total: versions?.length ?? 0, ready: (versions ?? []).filter((v: any) => readWords(v.text_overlay)?.clean_public_id).length },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { supabase, row } = await load(id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const current = readWords(row.text_overlay);
  const next = readWords({ ...(current ?? {}), ...(body.words ?? {}), clean_public_id: current?.clean_public_id ?? null, original_public_id: current?.original_public_id ?? null, applied: current?.applied ?? null, aspect: current?.aspect ?? null });
  if (!next) return NextResponse.json({ error: 'Write the words first' }, { status: 400 });
  if (!/\{pet\}/i.test(next.template)) return NextResponse.json({ error: 'Put {pet} where the name or breed goes' }, { status: 400 });
  const { error } = await supabase.from('image_catalog').update({ text_overlay: next }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message.includes('text_overlay') ? NEEDS_MIGRATION : error.message }, { status: 500 });
  return NextResponse.json({ ok: true, words: next });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { supabase, row } = await load(id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const words = readWords(row.text_overlay);

  try {
    if (body.action === 'set-clean') {
      const publicId = String(body.public_id || '');
      if (!/^[\w\-/]+$/.test(publicId)) return NextResponse.json({ error: 'Upload the picture first' }, { status: 400 });
      const w = Number(body.width), h = Number(body.height);
      const next = { ...(words ?? DEFAULT_WORDS), clean_public_id: publicId, aspect: w > 0 && h > 0 ? w / h : (words?.aspect ?? null), original_public_id: words?.original_public_id ?? null, applied: words?.applied ?? null };
      const { error } = await supabase.from('image_catalog').update({ text_overlay: next }).eq('id', id);
      if (error) throw new Error(error.message.includes('text_overlay') ? NEEDS_MIGRATION : error.message);
      return NextResponse.json({ ok: true, words: readWords(next) });
    }

    if (body.action === 'apply') {
      const done = await applyWordsToDesign(supabase, id);
      const versions = body.versions ? await applyWordsToVersions(supabase, id, { adoptClean: body.adoptClean === true }) : null;
      return NextResponse.json({ ok: true, text: done.text, versions });
    }

    if (body.action === 'remove') {
      const back = words?.original_public_id;
      const update: Record<string, unknown> = { text_overlay: null };
      if (back) {
        const variants = catalogVariants(back, `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${back}`);
        Object.assign(update, { cloudinary_public_id: back, storage_path: `cloudinary:${back}`, image_variants: variants, public_url: variants.mid_size?.url ?? null });
      }
      const { error } = await supabase.from('image_catalog').update(update).eq('id', id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    console.error('picture words failed', id, e);
    return NextResponse.json({ error: e?.message || 'Something went wrong' }, { status: 500 });
  }
}
