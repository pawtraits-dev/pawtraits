/**
 * Words on the picture, server side (see lib/picture-words.ts).
 *   bakeWords()            a stored copy of a picture with the words drawn on
 *   breedPhrase()          "the Cocker Spaniel" for a breed id ("the dog" when unknown)
 *   applyWordsToDesign()   draw a design's words for its own breed onto its stored picture
 *   applyWordsToVersions() the same for every breed / coat version made from it
 *   wordsForNewVersion()   a version just made from the design's clean copy gets the words too
 */
import { v2 as cloudinary } from 'cloudinary';
import type { SupabaseClient } from '@supabase/supabase-js';
import { catalogVariants } from '@/lib/catalog/register-image';
import { cloudinaryService } from '@/lib/cloudinary';
import { fillWords, petPhrase, readWords, wordsLayer, type PictureWords } from './picture-words';

function configure() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  }
}

/** Store a copy of a Cloudinary picture with the words drawn on (full size, PNG) */
export async function bakeWords(publicId: string, words: PictureWords, text: string, folder = 'pawtraits/catalog-words'): Promise<{ public_id: string; secure_url: string; width: number; height: number; bytes: number }> {
  configure();
  const url = cloudinary.url(publicId, { secure: true, raw_transformation: wordsLayer(words, text), format: 'png' });
  const r = await cloudinary.uploader.upload(url, { folder, resource_type: 'image', tags: ['picture-words'] });
  return { public_id: r.public_id, secure_url: r.secure_url, width: r.width, height: r.height, bytes: r.bytes };
}

/** "the Cocker Spaniel" (or its short name) for a breed; "the dog" / "the cat" when there's none */
export async function breedPhrase(supabase: SupabaseClient, breedId: string | null | undefined, animal?: 'dog' | 'cat' | null): Promise<string> {
  if (!breedId) return petPhrase({ animal });
  const { data } = await supabase.from('breeds').select('name, animal_type').eq('id', breedId).maybeSingle();
  // short_name: separate read so this still works before the 2026-10-23 migration
  const { data: s } = await supabase.from('breeds').select('short_name').eq('id', breedId).maybeSingle();
  return petPhrase({ breed: data?.name ?? null, shortName: (s as any)?.short_name ?? null, animal: (data?.animal_type as any) ?? animal ?? null });
}

/** The design's animal (from its breed), for "the dog" / "the cat" */
async function animalOf(supabase: SupabaseClient, breedId: string | null): Promise<'dog' | 'cat' | null> {
  if (!breedId) return null;
  const { data } = await supabase.from('breeds').select('animal_type').eq('id', breedId).maybeSingle();
  return (data?.animal_type as any) ?? null;
}

/**
 * Draw the words (for the design's own breed) onto its stored picture: the design's picture
 * becomes clean copy + words; the picture it had before is kept as original_public_id.
 */
export async function applyWordsToDesign(supabase: SupabaseClient, imageId: string, settings?: PictureWords): Promise<{ text: string; public_id: string }> {
  const { data: row } = await supabase.from('image_catalog').select('id, breed_id, cloudinary_public_id, text_overlay').eq('id', imageId).maybeSingle();
  if (!row) throw new Error('Design not found');
  const words = settings ?? readWords((row as any).text_overlay);
  if (!words) throw new Error('This design has no words set up');
  if (!words.clean_public_id) throw new Error('Upload the text-free copy first');

  const text = fillWords(words.template, await breedPhrase(supabase, row.breed_id, await animalOf(supabase, row.breed_id)));
  // The box is a share of the picture: use the clean copy's own shape (a format version differs)
  const dims = await cloudinaryService.getSourceDimensions(words.clean_public_id).catch(() => null);
  const shaped: PictureWords = dims?.width && dims?.height ? { ...words, aspect: dims.width / dims.height } : words;
  const baked = await bakeWords(words.clean_public_id, shaped, text);
  // The picture it had before the words were first drawn (words painted in), kept for reference
  const original = words.original_public_id ?? (!words.applied && row.cloudinary_public_id !== words.clean_public_id ? row.cloudinary_public_id : null);
  const variants = catalogVariants(baked.public_id, baked.secure_url);
  const { error } = await supabase.from('image_catalog').update({
    cloudinary_public_id: baked.public_id,
    public_url: variants.mid_size?.url || baked.secure_url,
    storage_path: `cloudinary:${baked.public_id}`,
    image_variants: variants,
    cloudinary_version: null, cloudinary_signature: null,
    text_overlay: { ...shaped, original_public_id: original, applied: { text, at: new Date().toISOString() } },
  }).eq('id', imageId);
  if (error) throw new Error(error.message);
  return { text, public_id: baked.public_id };
}

/**
 * Breed / coat versions of a design: each one made from the clean copy has its own clean picture,
 * and gets the design's words for its own breed. Versions made before the clean copy existed
 * still have the old words painted in: they're counted, not changed (make them again).
 */
export async function applyWordsToVersions(supabase: SupabaseClient, parentId: string): Promise<{ updated: number; failed: number; needsRemake: number }> {
  const { data: parent } = await supabase.from('image_catalog').select('text_overlay').eq('id', parentId).maybeSingle();
  const words = readWords((parent as any)?.text_overlay);
  if (!words) throw new Error('This design has no words set up');
  const { data: versions } = await supabase.from('image_catalog').select('id, text_overlay').eq('variation_of', parentId).limit(500);
  let updated = 0, failed = 0, needsRemake = 0;
  for (const v of versions ?? []) {
    const own = readWords((v as any).text_overlay);
    if (!own?.clean_public_id) { needsRemake++; continue; }
    try {
      // The design's wording and layout, the version's own clean picture
      await applyWordsToDesign(supabase, v.id, { ...words, clean_public_id: own.clean_public_id, original_public_id: own.original_public_id, applied: own.applied });
      updated++;
    } catch (e) {
      console.warn('words on version failed', v.id, e);
      failed++;
    }
  }
  return { updated, failed, needsRemake };
}

/** The picture a variation should be made from: the design's clean copy when it has words */
export async function variationSource(supabase: SupabaseClient, ref: { id?: string; cloudinary_public_id?: string | null; public_url?: string | null; text_overlay?: any }): Promise<{ cloudinary_public_id?: string | null; public_url?: string | null }> {
  let overlay = ref.text_overlay;
  if (overlay === undefined && ref.id) {
    const { data } = await supabase.from('image_catalog').select('text_overlay').eq('id', ref.id).maybeSingle();
    overlay = (data as any)?.text_overlay;
  }
  const words = readWords(overlay);
  return words?.clean_public_id ? { cloudinary_public_id: words.clean_public_id, public_url: null } : ref;
}

/**
 * A version just saved from a design with words: it was made from the clean copy, so its picture
 * is clean too. Keep that as its clean copy and draw the words for its own breed. Never throws.
 */
export async function wordsForNewVersion(supabase: SupabaseClient, versionId: string, parentId: string): Promise<void> {
  try {
    const { data: parent } = await supabase.from('image_catalog').select('text_overlay').eq('id', parentId).maybeSingle();
    const words = readWords((parent as any)?.text_overlay);
    if (!words?.clean_public_id) return;
    const { data: v } = await supabase.from('image_catalog').select('cloudinary_public_id').eq('id', versionId).maybeSingle();
    if (!v?.cloudinary_public_id) return;
    await applyWordsToDesign(supabase, versionId, { ...words, clean_public_id: v.cloudinary_public_id, original_public_id: null, applied: null });
  } catch (e) {
    console.warn('words for new version failed', versionId, e);
  }
}
