/**
 * Offers: the photo an offer paints from (server only).
 *   - a customisation's stored pet photo (previewers; buyers' bought or made pictures), or
 *   - a saved pet's primary photo (account customers).
 * Either way it is shaped like a customer_custom_images row so the painting code does not care which it is: the generation job is fed the stored
 * photo's URL (it is fetched from there, never uploaded again), exactly as the customise page does for a saved pet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudinaryIdFromUrl, imageUsable, petUsable } from './photo';

export interface OfferSource {
  fromPet: boolean;
  customer_id: string | null;
  customer_email: string | null;
  guest_session_id: string | null;
  catalog_image_id: string | null;
  pet_id: string | null;
  pet_name: string | null;
  pet_breed_id: string | null;
  pet_coat_id: string | null;
  pet_image_url: string;
  pet_cloudinary_id: string;
  metadata: any;
  /** a saved pet: its animal, breed name and analysis (the customise route passes the last two to the job) */
  animal_type: 'dog' | 'cat' | null;
  breed_name: string | null;
  ai_analysis_data: any;
}

export async function loadOfferSource(supabase: SupabaseClient, offer: { source_custom_image_id: string | null; source_pet_id?: string | null }): Promise<OfferSource | null> {
  if (offer.source_custom_image_id) {
    const { data } = await supabase.from('customer_custom_images').select('*').eq('id', offer.source_custom_image_id).maybeSingle();
    const i: any = data;
    if (!i || !imageUsable(i)) return null;
    return {
      fromPet: false, customer_id: i.customer_id ?? null, customer_email: i.customer_email ?? null, guest_session_id: i.guest_session_id ?? null, catalog_image_id: i.catalog_image_id ?? null,
      pet_id: i.pet_id ?? null, pet_name: i.pet_name ?? null, pet_breed_id: i.pet_breed_id ?? null, pet_coat_id: i.pet_coat_id ?? null,
      pet_image_url: i.pet_image_url, pet_cloudinary_id: i.pet_cloudinary_id, metadata: i.metadata ?? {}, animal_type: null, breed_name: null, ai_analysis_data: null,
    };
  }
  if (offer.source_pet_id) {
    const { data } = await supabase.from('pets').select('id, customer_id, name, breed_id, coat_id, animal_type, primary_photo_url, ai_analysis_data, is_active, breeds(name)').eq('id', offer.source_pet_id).maybeSingle();
    const p: any = data;
    if (!p || !petUsable(p)) return null;
    const breed = Array.isArray(p.breeds) ? p.breeds[0] : p.breeds;
    return {
      fromPet: true, customer_id: p.customer_id ?? null, customer_email: null, guest_session_id: null, catalog_image_id: null, pet_id: p.id, pet_name: p.name ?? null,
      pet_breed_id: p.breed_id ?? null, pet_coat_id: p.coat_id ?? null, pet_image_url: p.primary_photo_url, pet_cloudinary_id: cloudinaryIdFromUrl(p.primary_photo_url),
      metadata: {}, animal_type: p.animal_type === 'cat' ? 'cat' : p.animal_type === 'dog' ? 'dog' : null, breed_name: breed?.name ?? null, ai_analysis_data: p.ai_analysis_data ?? null,
    };
  }
  return null;
}
