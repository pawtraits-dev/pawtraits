/**
 * 4K print masters for customised portraits (server only).
 *
 * Customer previews are generated at CUSTOMER_PREVIEW_SIZE (2K, or 1K for speed). When an order
 * needs more real detail than the preview has (any print below 200 dpi, or a download from a
 * small preview), we ask Gemini to re-render the approved portrait at 4K — same image, more
 * resolution. The master is
 * stored against the custom image (reused by any later order) and the print files of every
 * open order line for that image are rebuilt from it.
 *
 * Runs after the Stripe webhook has replied (next/server `after`), or from the admin
 * "Rebuild print files" action.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_IMAGE_MODELS, GEMINI_IMAGE_SIZES, geminiImageConfig, ratioOfImage } from '@/lib/gemini-models';
import { generateWithUsage, type UsageContext } from '@/lib/ai/usage';

export const PRINT_MASTER_PROMPT = [
  'Recreate this exact image at a higher resolution for a large fine-art print.',
  'Keep everything identical: the composition and framing, the animal\'s face, eyes, markings and fur colours,',
  'its expression, the clothing and accessories, the background, the lighting and the painting style.',
  'Do not add, remove, move or restyle anything, and do not add any text, border or watermark.',
  'Only increase fine detail and sharpness so it holds up when printed at 30 × 40 cm.',
].join(' ');

/**
 * Re-render an approved preview at print resolution (4K): same picture, more detail.
 * Also used by the admin size test to show exactly what a buyer would get from a smaller preview.
 */
export async function renderPrintMaster(ai: GoogleGenAI, sourceBase64: string, ctx: UsageContext): Promise<string> {
  const response = await generateWithUsage(ai, ctx, {
    model: GEMINI_IMAGE_MODELS.pro,
    contents: [{ text: PRINT_MASTER_PROMPT }, { inlineData: { mimeType: 'image/png', data: sourceBase64 } }],
    config: { responseModalities: ['IMAGE'], ...geminiImageConfig(ratioOfImage(sourceBase64), GEMINI_IMAGE_SIZES.print) } as any,
  });
  const imageData = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data)?.inlineData?.data;
  if (!imageData) throw new Error('Gemini returned no image');
  return imageData;
}

/** A render in progress this recently is left alone (avoids duplicate 4K calls). */
const RENDER_LOCK_MS = 10 * 60_000;

export type PrintMasterResult =
  | { status: 'ready'; publicId: string; rebuilt: number }
  | { status: 'pending' }
  | { status: 'failed'; error: string }
  | { status: 'not_needed' };

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Couldn't download the preview (${res.status})`);
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

/**
 * Make (or reuse) the 4K master for a custom image, then rebuild print files for its open orders.
 */
export async function ensurePrintMaster(supabase: SupabaseClient, customImageId: string, opts: { force?: boolean } = {}): Promise<PrintMasterResult> {
  const { data: custom, error } = await supabase.from('customer_custom_images').select('*').eq('id', customImageId).maybeSingle();
  if (error) return { status: 'failed', error: error.message };
  if (!custom) return { status: 'not_needed' };

  if (custom.print_master_cloudinary_id && !opts.force) {
    const rebuilt = await rebuildOpenOrderItems(supabase, customImageId);
    return { status: 'ready', publicId: custom.print_master_cloudinary_id, rebuilt };
  }
  if (custom.print_master_status === 'rendering' && custom.print_master_started_at
      && Date.now() - new Date(custom.print_master_started_at).getTime() < RENDER_LOCK_MS && !opts.force) {
    return { status: 'pending' };
  }

  const setStatus = (fields: Record<string, any>) =>
    supabase.from('customer_custom_images').update(fields).eq('id', customImageId);

  const { error: lockError } = await setStatus({ print_master_status: 'rendering', print_master_started_at: new Date().toISOString(), print_master_error: null });
  if (lockError) {
    // Migration not run yet — nothing to store the master against
    return { status: 'failed', error: /print_master/.test(lockError.message) ? 'Run db/migrations/2026-09-30-print-crops.sql first' : lockError.message };
  }

  try {
    const { cloudinaryService } = await import('@/lib/cloudinary');
    const cloudinary = (await import('cloudinary')).v2;
    const sourceUrl = custom.generated_cloudinary_id
      ? cloudinary.url(custom.generated_cloudinary_id, { secure: true, type: 'upload', format: 'png', sign_url: false })
      : custom.generation_metadata?.full_size_url;
    if (!sourceUrl) throw new Error('No unwatermarked preview to re-render');
    const sourceBase64 = await fetchAsBase64(sourceUrl);

    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not set');
    const ai = new GoogleGenAI({ apiKey: key });
    const started = Date.now();
    const imageData = await renderPrintMaster(ai, sourceBase64, { feature: 'print-master', customerImageId: customImageId });

    const uploaded = await cloudinaryService.uploadPrintMaster(imageData, `master-${customImageId}`);
    console.log(`🖼️ 4K print master for ${customImageId}: ${uploaded.width}×${uploaded.height} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

    await setStatus({
      print_master_cloudinary_id: uploaded.publicId,
      print_master_status: 'ready',
      print_master_at: new Date().toISOString(),
      print_master_error: null,
      print_master_px: [uploaded.width, uploaded.height],
    });
    const rebuilt = await rebuildOpenOrderItems(supabase, customImageId);
    return { status: 'ready', publicId: uploaded.publicId, rebuilt };
  } catch (e: any) {
    const message = (e?.message || 'Print master failed').slice(0, 500);
    console.error(`❌ 4K print master failed for ${customImageId}:`, e);
    await setStatus({ print_master_status: 'failed', print_master_error: message });
    await markOrderItems(supabase, customImageId, 'failed');
    return { status: 'failed', error: message };
  }
}

/** Order lines for this image that haven't been printed or sent to Gelato yet. */
async function openOrderItems(supabase: SupabaseClient, imageId: string) {
  const { data } = await supabase
    .from('order_items')
    .select('*, orders!inner(id, gelato_order_id, self_print_status, status)')
    .eq('image_id', imageId);
  return (data || []).filter((i: any) => !i.orders?.gelato_order_id && !['printed', 'packed', 'posted'].includes(i.orders?.self_print_status));
}

async function markOrderItems(supabase: SupabaseClient, imageId: string, state: 'failed') {
  for (const item of await openOrderItems(supabase, imageId)) {
    if (item.print_file_meta?.print_master !== 'pending') continue;
    await supabase.from('order_items').update({ print_file_meta: { ...item.print_file_meta, print_master: state } }).eq('id', item.id);
  }
}

/** Rebuild print files from the master for every open line; returns how many were rebuilt. */
export async function rebuildOpenOrderItems(supabase: SupabaseClient, imageId: string): Promise<number> {
  const { resolveOrderImage, buildPrintFiles } = await import('@/lib/orders/order-image');
  const { isPostedPrintItem } = await import('@/lib/fulfillment/shared');
  const { cloudinaryService } = await import('@/lib/cloudinary');
  const img = await resolveOrderImage(supabase, imageId);
  if (!img) return 0;
  let n = 0;
  for (const item of await openOrderItems(supabase, imageId)) {
    if (!isPostedPrintItem(item)) continue;
    const productData = typeof item.product_data === 'string' ? JSON.parse(item.product_data) : item.product_data;
    const files = await buildPrintFiles(img, productData, item.order_id);
    await supabase.from('order_items').update({
      print_image_url: files.printUrl,
      self_print_file_url: files.selfPrintUrl,
      print_file_meta: files.meta,
    }).eq('id', item.id);
    if (files.selfPrintUrl) await cloudinaryService.warmDerived(files.selfPrintUrl, 60_000);
    n++;
  }
  return n;
}

/**
 * After an order is created: make 4K masters for any lines that need one, and pre-generate
 * AI-upscaled print files so they open instantly (Cloudinary answers 423 while it works).
 */
export async function finishPrintFiles(supabase: SupabaseClient, orderItems: any[]): Promise<void> {
  const { cloudinaryService } = await import('@/lib/cloudinary');
  const needMaster = new Set<string>();
  for (const item of orderItems) {
    if (item.print_file_meta?.print_master === 'pending') needMaster.add(item.image_id);
    else if (item.print_file_meta?.ai_upscaled && item.self_print_file_url) {
      await cloudinaryService.warmDerived(item.self_print_file_url, 60_000);
    }
  }
  // Downloads of a customised portrait: 4K when the preview itself is small (1K/2K previews)
  for (const item of orderItems) {
    const digital = item.is_digital || (typeof item.product_data === 'object' && item.product_data?.product_type === 'digital_download');
    if (digital && item.image_id && !needMaster.has(item.image_id) && await customPreviewIsSmall(supabase, item.image_id)) needMaster.add(item.image_id);
  }
  for (const imageId of Array.from(needMaster)) {
    await ensurePrintMaster(supabase, imageId);
  }
}

/**
 * Downloads use the preview as bought unless its longest side is below this. 2K previews
 * (about 1700 × 2500) pass, so the customer gets exactly the picture they approved; 1K
 * previews (about 850 × 1260) get the 4K master.
 */
export const DOWNLOAD_MIN_PX = Number(process.env.DOWNLOAD_MIN_PX) || 2000;

/** A customised portrait whose only image is the (1K/2K) preview, with no 4K master yet */
export async function customPreviewIsSmall(supabase: SupabaseClient, imageId: string): Promise<boolean> {
  const { data: custom } = await supabase.from('customer_custom_images').select('*').eq('id', imageId).maybeSingle();
  if (!custom || custom.print_master_cloudinary_id || !custom.generated_cloudinary_id) return false;
  const { cloudinaryService } = await import('@/lib/cloudinary');
  const dims = await cloudinaryService.getSourceDimensions(custom.generated_cloudinary_id);
  return !!dims && Math.max(dims.width, dims.height) < DOWNLOAD_MIN_PX;
}
