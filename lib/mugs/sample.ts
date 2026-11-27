/** Pure helpers for admin mug sample print files (no network, no database). */

export const SAMPLE_PHOTO_FOLDER = 'pawtraits/mugs/sample-photos';
export const SAMPLE_PAINTED_FOLDER = 'pawtraits/mugs/samples/painted';
export const SAMPLE_WRAP_FOLDER = 'pawtraits/mugs/samples';
export const SAMPLE_NAME_MAX = 20;

export type SampleMode = 'reference' | 'photo';

export interface SampleInput { mode: SampleMode; colour: string; name: string; photoPublicId?: string }

/** Checks the request body. The wrap's name text cannot be empty, so a name is required. */
export function validateSampleInput(body: any): { ok: true; value: SampleInput } | { ok: false; error: string } {
  const mode = body?.mode;
  if (mode !== 'reference' && mode !== 'photo') return { ok: false, error: 'Choose the design’s picture or a photo' };
  const colour = String(body?.colour ?? '').trim();
  if (!colour) return { ok: false, error: 'Choose a mug colour' };
  const name = String(body?.name ?? '').trim();
  if (!name || name.length > SAMPLE_NAME_MAX) return { ok: false, error: `Enter a name for the mug (up to ${SAMPLE_NAME_MAX} characters)` };
  let photoPublicId: string | undefined;
  if (mode === 'photo') {
    photoPublicId = String(body?.photo_public_id ?? '');
    if (!isSamplePhotoId(photoPublicId)) return { ok: false, error: 'Upload the photo again' };
  }
  return { ok: true, value: { mode, colour, name, photoPublicId } };
}

/** Only photos uploaded through the sample upload may be painted */
export function isSamplePhotoId(id: string): boolean {
  return id.startsWith(`${SAMPLE_PHOTO_FOLDER}/`) && id.length > SAMPLE_PHOTO_FOLDER.length + 1 && !id.includes('..');
}

/** Cloudinary id for a stored sample wrap */
export function sampleWrapPublicId(designSlug: string, colourSlug: string, hash: string): string {
  return `${SAMPLE_WRAP_FOLDER}/${designSlug}-${colourSlug}-${hash}`;
}
