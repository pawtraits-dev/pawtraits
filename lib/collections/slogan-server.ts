/**
 * Team mottos and customer slogans, server side (see lib/collections/slogan.ts).
 *   teamMotto()   the motto for a team (admin override, else the default)
 *   designMotto() the motto for a design or team version (its team's), when its kit shows one
 *   bakeSlogan()  a stored copy of a picture with the slogan drawn on (print files, downloads)
 */
import { v2 as cloudinary } from 'cloudinary';
import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultMotto } from './sports-teams';
import { sloganLayer } from './slogan';
import { readKit } from './kit-lettering';
import { teamContext } from './team-variants';

function configure() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  }
}

/** A team's motto: the admin's wording (collections.metadata.motto), else the default */
export async function teamMotto(supabase: SupabaseClient, teamPath: string): Promise<string | null> {
  const { data } = await supabase.from('collections').select('metadata').eq('path', teamPath).maybeSingle();
  const custom = (data?.metadata as any)?.motto;
  return typeof custom === 'string' && custom.trim() ? custom : defaultMotto(teamPath);
}

/** The motto to show on a design (its team's), or null when its kit doesn't show one */
export async function designMotto(supabase: SupabaseClient, imageId: string): Promise<string | null> {
  const { data } = await supabase.from('image_catalog').select('kit_personalisation').eq('id', imageId).maybeSingle();
  const kit = readKit((data as any)?.kit_personalisation);
  if (!kit?.slogan) return null;
  const ctx = await teamContext(supabase, imageId);
  const path = ctx?.currentTeamPath ?? ctx?.homeTeamPath;
  return path ? teamMotto(supabase, path) : null;
}

/** Store a copy of a Cloudinary picture with the slogan drawn on; returns the new image */
export async function bakeSlogan(publicId: string, slogan: string, folder = 'customer-custom-images'): Promise<{ public_id: string; secure_url: string; width: number; height: number }> {
  configure();
  const url = cloudinary.url(publicId, { secure: true, raw_transformation: sloganLayer(slogan), format: 'png' });
  const r = await cloudinary.uploader.upload(url, { folder, resource_type: 'image', tags: ['slogan'] });
  return { public_id: r.public_id, secure_url: r.secure_url, width: r.width, height: r.height };
}
