/**
 * Zodiac (and other designed) mugs, server side.
 *
 * A finished mug is stored as a customised Pawtrait (customer_custom_images) whose picture is the
 * full mug wrap (2362×1134, 2:1). That lets it use everything a customised painting already has:
 * the buy sheet (Mug products are in the "wide" 2:1 shape family), basket, checkout, order pages,
 * print files and fulfilment. mug_generations keeps the mug-specific detail (design, colour, name).
 */
import { v2 as cloudinary } from 'cloudinary';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildMugPreviewUrl, buildMugPrintUrl, type MugCompositeParams } from '@/lib/cloudinary-mug';
import { plainText, snippet } from '@/lib/text/plain';
import type { MugCatalogEntry, MugColour } from '@/lib/product-types';

function configure() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  }
}

/** Composite inputs with the catalogue text cleaned up (no markdown, a length that fits the wrap) */
export function compositeParams(personalisedImagePublicId: string, petName: string, colour: MugColour, entry: MugCatalogEntry): MugCompositeParams {
  return {
    personalisedImagePublicId,
    petName: plainText(petName).slice(0, 20),
    mugColour: colour,
    catalogEntry: {
      ...entry,
      sub_heading: plainText(entry.sub_heading),
      description_short: plainText(entry.description_short) || snippet(entry.description, 240),
    },
  };
}

/** The format id for 2:1 designs (the shape the Mug products are offered on) */
export async function wideFormatId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from('formats').select('id').eq('aspect_ratio', '2:1').eq('is_active', true).limit(1).maybeSingle();
  return data?.id ?? null;
}

export interface MugOwner {
  customerId: string | null;     // customers.id
  customerEmail: string | null;
  guestId: string | null;
}

/**
 * Store (or update) the finished wrap as a customised Pawtrait so it can be bought.
 * The print-resolution composite is saved as a real Cloudinary image, so print files and
 * downloads come from a stored file rather than a long transformation URL.
 */
export async function saveMugAsCustomImage(supabase: SupabaseClient, opts: {
  generationId: string;
  existingCustomImageId?: string | null;
  owner: MugOwner;
  params: MugCompositeParams;
  petPhotoUrl: string;
  petPhotoPublicId: string;
  colour: MugColour;
  entry: MugCatalogEntry;
  ipHash?: string | null;
}): Promise<{ customImageId: string; previewUrl: string; printUrl: string }> {
  configure();
  const previewUrl = buildMugPreviewUrl(opts.params);
  const printUrl = buildMugPrintUrl(opts.params);
  const stored = await cloudinary.uploader.upload(printUrl, {
    folder: 'customer-custom-images/mugs',
    resource_type: 'image',
    tags: ['mug-wrap', `generation-${opts.generationId}`],
  });
  const fields = {
    generated_image_url: previewUrl,
    generated_cloudinary_id: stored.public_id,
    status: 'complete',
    generated_at: new Date().toISOString(),
    generation_metadata: {
      kind: 'mug',
      mug_generation_id: opts.generationId,
      mug_design: opts.entry.slug,
      mug_colour: opts.colour.slug,
      full_size_url: stored.secure_url,
      aspect_ratio: '2:1',
    },
  };
  if (opts.existingCustomImageId) {
    const { error } = await supabase.from('customer_custom_images').update(fields).eq('id', opts.existingCustomImageId);
    if (error) throw new Error(`Saving the mug failed: ${error.message}`);
    return { customImageId: opts.existingCustomImageId, previewUrl, printUrl: stored.secure_url };
  }
  const { data, error } = await supabase.from('customer_custom_images').insert({
    customer_id: opts.owner.customerId,
    customer_email: opts.owner.customerEmail,
    guest_session_id: opts.owner.guestId,
    ip_hash: opts.ipHash ?? null,
    catalog_image_id: null,
    pet_name: opts.params.petName,
    pet_image_url: opts.petPhotoUrl,
    pet_cloudinary_id: opts.petPhotoPublicId,
    is_public: false,
    metadata: { product: 'mug', mug_design: opts.entry.slug, mug_design_name: opts.entry.name, all_pet_names: [opts.params.petName] },
    ...fields,
  }).select('id').single();
  if (error || !data) throw new Error(`Saving the mug failed: ${error?.message}`);
  return { customImageId: data.id, previewUrl, printUrl: stored.secure_url };
}
