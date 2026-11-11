/**
 * What the shop shows for phone cases (server): designs with approved case art, the models on the
 * dropdowns with their product and price, and the camera layouts. Preview images are watermarked.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { watermarkTiles } from '@/lib/watermark';
import { LISTED_ONLY } from '@/lib/catalog/listing';
import type { CaseArtEntry, CaseArtLayout, PhoneLayoutGroup } from './geometry';

const cloud = () => process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
export const previewUrl = (publicId: string, w = 900) => `https://res.cloudinary.com/${cloud()}/image/upload/w_${w},c_limit/${watermarkTiles()}/q_auto,f_auto/${publicId}`;
const plainUrl = (publicId: string, w = 500) => `https://res.cloudinary.com/${cloud()}/image/upload/w_${w},c_limit,q_auto,f_auto/${publicId}`;
const title = (d: string | null) => (d || '').match(/\*\*(.+?)\*\*/)?.[1]?.trim() || (d || '').replace(/[#*_]/g, '').trim().slice(0, 60) || 'Pawtrait';

export interface PublicCaseDesign { id: string; title: string; thumb: string; art: Record<string, { url: string; layout: CaseArtLayout }> }
export interface PublicPhoneModel {
  id: string; brand: 'apple' | 'samsung'; name: string; group: string; case_w_mm: number; case_h_mm: number;
  product: { id: string; sku: string; price_pence: number; on_sale: boolean; gelato_sku: string | null; name: string } | null;
}

function approvedArt(caseArt: Record<string, CaseArtEntry> | null) {
  return Object.fromEntries(Object.entries(caseArt || {}).filter(([, e]) => e.status === 'approved').map(([g, e]) => [g, { url: previewUrl(e.public_id), layout: e.layout }]));
}

export async function phoneCaseCatalogue(db: SupabaseClient, designId?: string) {
  let q = db.from('image_catalog').select('id, description, cloudinary_public_id, case_art').neq('case_art', '{}').eq('is_public', true).or(LISTED_ONLY);
  if (designId) q = q.eq('id', designId);
  const [designs, models, groups] = await Promise.all([
    q.order('created_at', { ascending: false }).limit(200),
    db.from('phone_models').select('id, brand, name, layout_group, case_w_mm, case_h_mm, display_order, product:products(id, sku, name, is_active, gelato_sku, pricing:product_pricing(sale_price, is_current, country_code))').eq('is_active', true).order('display_order'),
    db.from('phone_layout_groups').select('id, label, camera'),
  ]);
  const out: PublicCaseDesign[] = (designs.data ?? []).map((d: any) => ({ id: d.id, title: title(d.description), thumb: plainUrl(d.cloudinary_public_id), art: approvedArt(d.case_art) }))
    .filter(d => Object.keys(d.art).length > 0);
  const phoneModels: PublicPhoneModel[] = (models.data ?? []).map((m: any) => {
    const p = Array.isArray(m.product) ? m.product[0] : m.product;
    const price = (p?.pricing ?? []).find((r: any) => r.is_current !== false && r.country_code === 'GB');
    return {
      id: m.id, brand: m.brand, name: m.name, group: m.layout_group, case_w_mm: Number(m.case_w_mm), case_h_mm: Number(m.case_h_mm),
      product: p && price ? { id: p.id, sku: p.sku, name: p.name, price_pence: price.sale_price, on_sale: !!p.is_active, gelato_sku: p.gelato_sku ?? null } : null,
    };
  });
  return { designs: out, models: phoneModels, groups: (groups.data ?? []) as PhoneLayoutGroup[] };
}
