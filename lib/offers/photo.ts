/**
 * Offers: which photo of a buyer's pet to paint from (pure; the database side is in data.ts).
 * In order: the pet photo of their most recent completed customisation that they BOUGHT; else their most recent completed customisation
 * (by the address they made it with); else a saved pet's primary photo (account customers).
 * "Usable" matches the preview offers: a finished customisation that still has its stored pet photo (url and Cloudinary id).
 */
import type { PhotoRef } from './eligibility';

export interface ImageRow { id: string; status: string | null; pet_image_url: string | null; pet_cloudinary_id: string | null; created_at?: string | null }
export interface SavedPetRow { id: string; primary_photo_url: string | null; is_active?: boolean | null; updated_at?: string | null }

export const imageUsable = (i: Pick<ImageRow, 'status' | 'pet_image_url' | 'pet_cloudinary_id'> | null | undefined) =>
  !!i && i.status === 'complete' && !!i.pet_image_url && !!i.pet_cloudinary_id;
export const petUsable = (p: Pick<SavedPetRow, 'primary_photo_url' | 'is_active'> | null | undefined) =>
  !!p && p.is_active !== false && typeof p.primary_photo_url === 'string' && /^https?:\/\//.test(p.primary_photo_url);

const newest = <T extends { created_at?: string | null; updated_at?: string | null }>(xs: T[], key: 'created_at' | 'updated_at' = 'created_at') =>
  [...xs].sort((a, b) => Date.parse(String((b as any)[key] ?? 0)) - Date.parse(String((a as any)[key] ?? 0)));

/**
 * `boughtInOrder`: the images they bought, most recently bought first (the caller orders them by order date).
 * `byEmail`: their customisations (any order); `pets`: their saved pets.
 */
export function chooseBuyerPhoto(input: { boughtInOrder: ImageRow[]; byEmail: ImageRow[]; pets: SavedPetRow[] }): PhotoRef | null {
  const bought = input.boughtInOrder.find(imageUsable);
  if (bought) return { customImageId: bought.id, petId: null, source: 'bought' };
  const made = newest(input.byEmail.filter(imageUsable))[0];
  if (made) return { customImageId: made.id, petId: null, source: 'customisation' };
  const pet = newest(input.pets.filter(petUsable), 'updated_at')[0];
  if (pet) return { customImageId: null, petId: pet.id, source: 'saved_pet' };
  return null;
}

/** Cloudinary public id for a saved pet's photo URL, the way the customise route works it out ('non-cloudinary' when it is not one) */
export function cloudinaryIdFromUrl(url: string | null | undefined): string {
  if (!url || !url.includes('cloudinary.com')) return 'non-cloudinary';
  const parts = url.split('/');
  const upload = parts.indexOf('upload');
  return upload !== -1 && upload + 2 < parts.length ? parts.slice(upload + 2).join('/').split('.')[0] : 'unknown';
}
