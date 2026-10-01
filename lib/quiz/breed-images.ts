/**
 * Breed-matched Pawsonality pictures (server only). Spec: docs/specs/pawsonality-quiz.md, phase 4.
 *
 * A type's Pawsonalities design is repainted as the pet's breed with the existing Gemini
 * variation service, saved to image_catalog as a normal design, and tracked in
 * quiz_breed_images (one row per design + breed), so each combination is only ever made once.
 */
import { serviceClient } from '@/lib/qr/server';
import { GeminiVariationService } from '@/lib/gemini-variation-service';
import { uploadImageBufferToCloudinary } from '@/lib/cloudinary-server';

export type BreedImageStatus =
  | { status: 'done'; imageId: string }
  | { status: 'pending' }
  | { status: 'failed'; error?: string }
  | { status: 'unavailable'; reason: string };

/** A job "running" for longer than this is assumed dead (function timed out) and may be retaken */
const STALE_MS = 4 * 60_000;
const MAX_ATTEMPTS = 2;

/** Existing finished picture for this design + breed, if any */
export async function findBreedImage(sourceImageId: string, breedId: string): Promise<string | null> {
  const { data } = await serviceClient().from('quiz_breed_images')
    .select('image_id, status').eq('source_image_id', sourceImageId).eq('breed_id', breedId).maybeSingle();
  return data?.status === 'done' && data.image_id ? data.image_id : null;
}

/** Current state without starting anything */
export async function peekBreedImage(sourceImageId: string, breedId: string): Promise<BreedImageStatus | null> {
  const { data } = await serviceClient().from('quiz_breed_images')
    .select('image_id, status, error, updated_at').eq('source_image_id', sourceImageId).eq('breed_id', breedId).maybeSingle();
  if (!data) return null;
  if (data.status === 'done' && data.image_id) return { status: 'done', imageId: data.image_id };
  if (data.status === 'failed') return { status: 'failed', error: data.error ?? undefined };
  if (Date.now() - new Date(data.updated_at).getTime() > STALE_MS) return null; // dead job, can be retaken
  return { status: 'pending' };
}

/**
 * Make (or reuse) the breed version. Claims the job first so concurrent requests don't paint the
 * same picture twice: the claimer generates (20–60 s); everyone else gets 'pending'.
 */
export async function ensureBreedImage(input: {
  animal: 'dog' | 'cat'; code: string; breedId: string; sourceImageId: string;
  requestedBy: 'quiz' | 'admin'; ipHash?: string | null;
}): Promise<BreedImageStatus> {
  const supabase = serviceClient();
  const now = new Date().toISOString();

  // 1. Claim
  const { data: existing } = await supabase.from('quiz_breed_images')
    .select('id, status, image_id, attempts, updated_at')
    .eq('source_image_id', input.sourceImageId).eq('breed_id', input.breedId).maybeSingle();

  let jobId: string;
  if (!existing) {
    const { data: created, error } = await supabase.from('quiz_breed_images').insert({
      animal_type: input.animal, type_code: input.code, breed_id: input.breedId, source_image_id: input.sourceImageId,
      status: 'running', attempts: 1, requested_by: input.requestedBy, ip_hash: input.ipHash ?? null,
    }).select('id').single();
    if (error) {
      if (error.code === '23505') return { status: 'pending' }; // someone else claimed it a moment ago
      throw error;
    }
    jobId = created.id;
  } else {
    if (existing.status === 'done' && existing.image_id) return { status: 'done', imageId: existing.image_id };
    const stale = Date.now() - new Date(existing.updated_at).getTime() > STALE_MS;
    if (existing.status === 'running' && !stale) return { status: 'pending' };
    if (existing.status === 'failed' && existing.attempts >= MAX_ATTEMPTS && input.requestedBy !== 'admin') {
      return { status: 'failed' };
    }
    // Retake: only if nobody else updated it since we read it
    const { data: claimed } = await supabase.from('quiz_breed_images')
      .update({ status: 'running', attempts: existing.attempts + 1, error: null, updated_at: now })
      .eq('id', existing.id).eq('updated_at', existing.updated_at).select('id');
    if (!claimed?.length) return { status: 'pending' };
    jobId = existing.id;
  }

  // 2. Generate and save
  try {
    const imageId = await generateBreedVersion(input.sourceImageId, input.breedId, input.code);
    await supabase.from('quiz_breed_images')
      .update({ status: 'done', image_id: imageId, error: null, updated_at: new Date().toISOString() }).eq('id', jobId);
    return { status: 'done', imageId };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : 'Unknown error';
    console.error('Pawsonality breed picture failed', { code: input.code, breedId: input.breedId, message });
    await supabase.from('quiz_breed_images')
      .update({ status: 'failed', error: message, updated_at: new Date().toISOString() }).eq('id', jobId);
    return { status: 'failed', error: message };
  }
}

async function generateBreedVersion(sourceImageId: string, breedId: string, code: string): Promise<string> {
  const supabase = serviceClient();
  const [{ data: source }, { data: breed }] = await Promise.all([
    supabase.from('image_catalog')
      .select('id, prompt_text, description, cloudinary_public_id, public_url, theme_id, style_id, format_id, themes:theme_id (*), styles:style_id (*)')
      .eq('id', sourceImageId).maybeSingle(),
    supabase.from('breeds').select('*').eq('id', breedId).maybeSingle(),
  ]);
  if (!source) throw new Error('Type design not found');
  if (!breed) throw new Error('Breed not found');

  // Source picture as PNG, capped in size for the model
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const sourceUrl = source.cloudinary_public_id && cloud
    ? `https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_1536,h_1536/f_png/${source.cloudinary_public_id}`
    : source.public_url;
  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Could not fetch the type design (${res.status})`);
  const base64 = Buffer.from(await res.arrayBuffer()).toString('base64');

  const gemini = new GeminiVariationService();
  const [variation] = await gemini.generateBreedVariations(base64, source.prompt_text || '', [breed as any], source.themes, source.styles);
  if (!variation?.imageData) throw new Error('The picture service returned no image');

  const filename = `pawsonality-${code.toLowerCase()}-${breed.slug || breed.id}.png`;
  const uploaded = await uploadImageBufferToCloudinary(Buffer.from(variation.imageData, 'base64'), filename, {
    folder: 'pawtraits/pawsonality', tags: ['pawsonality', `pawsonality-${code.toLowerCase()}`], breed: breed.name,
  });

  const { data: saved, error } = await supabase.from('image_catalog').insert({
    filename,
    original_filename: filename,
    file_size: uploaded.bytes,
    mime_type: 'image/png',
    storage_path: `cloudinary:${uploaded.public_id}`,
    public_url: uploaded.secure_url,
    prompt_text: variation.prompt || source.prompt_text || '',
    description: source.description,
    tags: ['pawsonality', `pawsonality:${code}`, 'quiz-generated'],
    breed_id: breed.id,
    theme_id: source.theme_id,
    style_id: source.style_id,
    format_id: source.format_id,
    cloudinary_public_id: uploaded.public_id,
    cloudinary_version: uploaded.version?.toString(),
    cloudinary_signature: uploaded.signature,
    rating: 4,
    is_featured: false,
    is_public: true,
  }).select('id').single();
  if (error || !saved) throw new Error(`Saving the picture failed: ${error?.message}`);
  return saved.id;
}
