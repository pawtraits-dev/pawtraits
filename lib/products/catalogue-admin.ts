/**
 * Admin product catalogue (server only): list / create / update / delete products with their
 * UK price and unit costs. Prices live in product_pricing (GB row, is_current) so every
 * existing reader (shop, checkout, price checks) keeps working; changing a price closes the
 * old row and adds a new one, so price history is kept.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { withFormatIds } from './catalogue';
import type { ShapeFamily } from './shape-family';

export class CatalogueError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface CatalogueProductInput {
  product_type: 'physical_print' | 'digital_download';
  medium_id: string;
  shape_family: ShapeFamily;
  size_name: string;
  size_code: string;
  /** Portrait orientation (short side = width). Not needed for digital downloads. */
  width_cm?: number | null;
  height_cm?: number | null;
  description?: string | null;
  price_pence: number;
  unit_cost_pence?: number;
  postage_cost_pence?: number;
  gelato_sku?: string | null;
  gelato_sku_landscape?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
  display_order?: number;
}

const PRODUCT_SELECT = '*, medium:media(id, name, slug, description, category)';

function currentGbPrice(rows: any[]): any | null {
  const gb = (rows || []).filter(r => r.country_code === 'GB');
  gb.sort((a, b) => Number(b.is_current === true) - Number(a.is_current === true)
    || new Date(b.effective_date || b.created_at || 0).getTime() - new Date(a.effective_date || a.created_at || 0).getTime());
  return gb[0] ?? null;
}

function withMargin(p: any) {
  const price = currentGbPrice(p.product_pricing);
  const pricePence = price?.sale_price ?? null;
  const unitCost = price?.product_cost ?? 0;
  const postage = price?.shipping_cost ?? 0;
  // Card fees: Stripe UK ≈ 1.5% + 20p (estimate, for the margin column only)
  const fees = pricePence ? Math.round(pricePence * 0.015 + 20) : 0;
  const margin = pricePence ? pricePence - unitCost - postage - fees : null;
  const { product_pricing, ...rest } = p;
  return {
    ...rest,
    price_pence: pricePence,
    unit_cost_pence: unitCost,
    postage_cost_pence: postage,
    card_fee_pence: fees,
    margin_pence: margin,
    margin_percent: pricePence && margin !== null ? Math.round((margin / pricePence) * 100) : null,
    price_history_count: (product_pricing || []).filter((r: any) => r.country_code === 'GB').length,
  };
}

export async function listCatalogueProducts(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('products').select(`${PRODUCT_SELECT}, product_pricing(*)`).order('created_at', { ascending: true });
  if (error) throw new CatalogueError(error.message, 500);
  const annotated = await withFormatIds(supabase, data || []);
  return annotated
    .map(withMargin)
    .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0) || String(a.name).localeCompare(String(b.name)));
}

function validate(input: CatalogueProductInput) {
  if (!['physical_print', 'digital_download'].includes(input.product_type)) throw new CatalogueError('Choose print or digital download.');
  if (!input.medium_id) throw new CatalogueError('Choose a material (medium).');
  if (!['rect_2x3', 'square', 'wide', 'any'].includes(input.shape_family)) throw new CatalogueError('Choose which designs it is offered on.');
  if (!input.size_name?.trim()) throw new CatalogueError('Give the size a name (e.g. Medium).');
  if (!/^[A-Z0-9]{1,4}$/.test((input.size_code || '').trim().toUpperCase())) throw new CatalogueError('Size code: 1–4 letters or digits (e.g. M).');
  if (!Number.isInteger(input.price_pence) || input.price_pence < 50 || input.price_pence > 100000) throw new CatalogueError('Price must be between £0.50 and £1,000.');
  for (const [k, v] of [['Unit cost', input.unit_cost_pence], ['Postage cost', input.postage_cost_pence]] as const) {
    if (v !== undefined && v !== null && (!Number.isInteger(v) || v < 0 || v > 100000)) throw new CatalogueError(`${k} must be between £0 and £1,000.`);
  }
  if (input.product_type === 'physical_print') {
    const w = Number(input.width_cm), h = Number(input.height_cm);
    if (!(w > 0 && h > 0 && w <= 200 && h <= 200)) throw new CatalogueError('Enter the print size in cm.');
    if (input.shape_family === 'any') throw new CatalogueError('A print needs a design shape (portrait & landscape, square or wide).');
    if (input.shape_family === 'square' && Math.abs(w - h) > 0.01) throw new CatalogueError('A square product needs equal width and height.');
  }
  for (const sku of [input.gelato_sku, input.gelato_sku_landscape]) {
    if (sku && !/^[A-Za-z0-9_\-.:]{6,200}$/.test(sku.trim())) throw new CatalogueError('That Gelato SKU doesn\'t look right — paste the product UID from Gelato.');
  }
}

async function productFields(supabase: SupabaseClient, input: CatalogueProductInput, existingId?: string) {
  const { data: medium } = await supabase.from('media').select('id, name, slug').eq('id', input.medium_id).maybeSingle();
  if (!medium) throw new CatalogueError('That material no longer exists.');
  const isPrint = input.product_type === 'physical_print';
  const w = isPrint ? Math.min(Number(input.width_cm), Number(input.height_cm)) : null;
  const h = isPrint ? Math.max(Number(input.width_cm), Number(input.height_cm)) : null;
  const code = input.size_code.trim().toUpperCase();
  const familyTag = input.shape_family === 'square' ? 'SQ-' : input.shape_family === 'wide' ? 'W-' : '';
  let sku = isPrint ? `${medium.slug}-${familyTag}${code}`.toUpperCase() : `${medium.slug}-DIGITAL`.toUpperCase();
  // Keep SKUs unique
  for (let n = 2; ; n++) {
    const { data: clash } = await supabase.from('products').select('id').eq('sku', sku).maybeSingle();
    if (!clash || clash.id === existingId) break;
    sku = `${sku.replace(/-\d+$/, '')}-${n}`;
  }
  const name = isPrint ? `${medium.name} ${input.size_name.trim()}` : input.size_name.trim() === 'Digital' ? 'Digital download' : `Digital download ${input.size_name.trim()}`;
  return {
    sku,
    name,
    description: input.description?.trim() || null,
    medium_id: medium.id,
    format_id: null,
    shape_family: input.shape_family,
    size_name: input.size_name.trim(),
    size_code: code,
    width_cm: w,
    height_cm: h,
    width_inches: w ? Math.round((w / 2.54) * 10) / 10 : null,
    height_inches: h ? Math.round((h / 2.54) * 10) / 10 : null,
    product_type: input.product_type,
    fulfillment_method: isPrint ? 'manual' : 'download',
    requires_shipping: isPrint,
    gelato_sku: isPrint ? (input.gelato_sku?.trim() || null) : null,
    gelato_sku_landscape: isPrint && input.shape_family === 'rect_2x3' ? (input.gelato_sku_landscape?.trim() || null) : null,
    is_active: input.is_active ?? true,
    is_featured: input.is_featured ?? false,
    display_order: Number.isInteger(input.display_order) ? input.display_order : 0,
    digital_file_type: isPrint ? null : 'jpg',
    license_type: isPrint ? null : 'personal',
    updated_at: new Date().toISOString(),
  };
}

async function setGbPrice(supabase: SupabaseClient, productId: string, input: CatalogueProductInput, userId?: string | null) {
  const { data: rows } = await supabase.from('product_pricing').select('*').eq('product_id', productId).eq('country_code', 'GB');
  const current = currentGbPrice(rows || []);
  const unitCost = input.unit_cost_pence ?? 0;
  const postage = input.postage_cost_pence ?? 0;
  if (current && current.sale_price === input.price_pence && (current.product_cost ?? 0) === unitCost && (current.shipping_cost ?? 0) === postage) return;
  const now = new Date().toISOString();
  if (rows?.length) {
    await supabase.from('product_pricing').update({ is_current: false, end_date: now, updated_at: now }).eq('product_id', productId).eq('country_code', 'GB').eq('is_current', true);
  }
  const profit = input.price_pence - unitCost - postage;
  const { error } = await supabase.from('product_pricing').insert({
    product_id: productId,
    country_code: 'GB',
    currency_code: 'GBP',
    currency_symbol: '£',
    sale_price: input.price_pence,
    product_cost: unitCost,
    shipping_cost: postage,
    profit_amount: profit,
    profit_margin_percent: input.price_pence ? Math.round((profit / input.price_pence) * 10000) / 100 : null,
    markup_percent: unitCost + postage > 0 ? Math.round((profit / (unitCost + postage)) * 10000) / 100 : null,
    is_current: true,
    effective_date: now,
    created_by: userId || null,
    notes: 'Set in /admin/products',
  });
  if (error) throw new CatalogueError(`Price not saved: ${error.message}`, 500);
}

export async function createCatalogueProduct(supabase: SupabaseClient, input: CatalogueProductInput, userId?: string | null) {
  validate(input);
  const fields = await productFields(supabase, input);
  const { data, error } = await supabase.from('products').insert(fields).select('id').single();
  if (error) {
    throw new CatalogueError(/shape_family|gelato_sku_landscape|display_order|format_id/.test(error.message)
      ? 'Run db/migrations/2026-09-30-product-catalogue.sql in Supabase first.' : error.message, 500);
  }
  await setGbPrice(supabase, data.id, input, userId);
  return getCatalogueProduct(supabase, data.id);
}

export async function updateCatalogueProduct(supabase: SupabaseClient, id: string, input: CatalogueProductInput, userId?: string | null) {
  validate(input);
  const fields = await productFields(supabase, input, id);
  const { error } = await supabase.from('products').update(fields).eq('id', id);
  if (error) throw new CatalogueError(error.message, 500);
  await setGbPrice(supabase, id, input, userId);
  return getCatalogueProduct(supabase, id);
}

export async function setCatalogueProductActive(supabase: SupabaseClient, id: string, isActive: boolean) {
  const { error } = await supabase.from('products').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new CatalogueError(error.message, 500);
  return getCatalogueProduct(supabase, id);
}

export async function getCatalogueProduct(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from('products').select(`${PRODUCT_SELECT}, product_pricing(*)`).eq('id', id).maybeSingle();
  if (error) throw new CatalogueError(error.message, 500);
  if (!data) throw new CatalogueError('Product not found', 404);
  const [annotated] = await withFormatIds(supabase, [data]);
  return withMargin(annotated);
}

/**
 * Delete a product. Products that have been ordered are only deactivated (order history
 * keeps its own copy, but stock SKUs and reports may point at the product).
 */
export async function deleteCatalogueProduct(supabase: SupabaseClient, id: string): Promise<{ deleted: boolean; deactivated: boolean }> {
  const { count } = await supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id);
  const { count: stockRefs } = await supabase.from('stock_skus').select('id', { count: 'exact', head: true }).eq('product_id', id);
  if ((count ?? 0) > 0 || (stockRefs ?? 0) > 0) {
    await setCatalogueProductActive(supabase, id, false);
    return { deleted: false, deactivated: true };
  }
  await supabase.from('product_pricing').delete().eq('product_id', id);
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw new CatalogueError(error.message, 500);
  return { deleted: true, deactivated: false };
}
