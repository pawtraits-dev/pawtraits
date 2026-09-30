/**
 * Resolve the image behind an order line. order_items.image_id can point at either:
 *   - image_catalog.id               (a catalogue design bought as-is)
 *   - customer_custom_images.id      (a customised portrait with the customer's pet)
 * Previously only image_catalog was checked, so custom portraits could not be fulfilled.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolvedOrderImage {
  kind: 'catalog' | 'custom';
  id: string;
  cloudinaryPublicId: string | null;
  /** unwatermarked stored original, if we have one (fallback only) */
  originalUrl: string | null;
  /** safe-to-display preview (watermarked for custom portraits) */
  previewUrl: string | null;
  filename: string;
  catalogImageId: string | null;
  /** 4K re-render made for large prints (custom portraits only), if one exists */
  printMasterPublicId?: string | null;
}

export async function resolveOrderImage(supabase: SupabaseClient, imageId: string): Promise<ResolvedOrderImage | null> {
  if (!imageId) return null;

  const { data: cat } = await supabase
    .from('image_catalog')
    .select('id, cloudinary_public_id, public_url, image_variants, filename')
    .eq('id', imageId)
    .maybeSingle();
  if (cat) {
    return {
      kind: 'catalog',
      id: cat.id,
      cloudinaryPublicId: cat.cloudinary_public_id,
      originalUrl: cat.image_variants?.original?.url ?? cat.public_url ?? null,
      previewUrl: cat.public_url ?? null,
      filename: (cat.filename || `pawtraits-${cat.id}`).replace(/\.[a-z0-9]+$/i, ''),
      catalogImageId: cat.id,
    };
  }

  const { data: custom } = await supabase
    .from('customer_custom_images')
    .select('*') // '*' so print_master_* columns are picked up once the migration has run
    .eq('id', imageId)
    .maybeSingle();
  if (custom) {
    const petSlug = (custom.pet_name || 'pet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pet';
    return {
      kind: 'custom',
      id: custom.id,
      cloudinaryPublicId: custom.generated_cloudinary_id,
      originalUrl: custom.generation_metadata?.full_size_url ?? null,
      previewUrl: custom.generated_image_url,
      filename: `pawtraits-${petSlug}-${custom.id.slice(0, 8)}`,
      catalogImageId: custom.catalog_image_id,
      printMasterPublicId: custom.print_master_cloudinary_id ?? null,
    };
  }
  return null;
}

/** Unsigned, print-resolution URL Gelato can fetch. Throws rather than guessing. */
export async function getPrintUrl(img: ResolvedOrderImage, orderId: string): Promise<string> {
  if (img.cloudinaryPublicId) {
    const { cloudinaryService } = await import('@/lib/cloudinary');
    return cloudinaryService.getGelatoPrintUrl(img.cloudinaryPublicId, orderId);
  }
  if (img.originalUrl) return img.originalUrl;
  throw new Error(`No print source for ${img.kind} image ${img.id}`);
}

export interface PrintFiles {
  /** Exact print size at 300 dpi, no bleed — what Gelato gets */
  printUrl: string;
  /** Same crop plus bleed, for printing onto pre-cut blanks ourselves */
  selfPrintUrl: string | null;
  /** How the file was made (shown in admin: effective dpi, crop, warnings) */
  meta: Record<string, any>;
}

/**
 * Print files for one order line: the reference image centre-cropped to the product's shape
 * (S/L are 3:4 crops of a 2:3 reference; M prints edge to edge) at 300 dpi.
 * Falls back to the uncropped original when the product has no dimensions or the
 * image isn't in Cloudinary.
 */
export async function buildPrintFiles(img: ResolvedOrderImage, productData: any, orderId: string): Promise<PrintFiles> {
  const widthCm = Number(productData?.width_cm), heightCm = Number(productData?.height_cm);
  const sourceId = img.printMasterPublicId || img.cloudinaryPublicId;
  if (sourceId && widthCm > 0 && heightCm > 0) {
    const { cloudinaryService } = await import('@/lib/cloudinary');
    const g = await import('@/lib/print/print-geometry');
    const source = await cloudinaryService.getSourceDimensions(sourceId);
    if (source) {
      const maxMp = Number(process.env.CLOUDINARY_MAX_TRANSFORM_MP) || 25;
      const plan = g.planPrint(source, widthCm, heightCm);
      const bleedPlan = g.planPrint(source, widthCm, heightCm, { bleedMm: g.SELF_PRINT_BLEED_MM });
      const upscale = g.planUpscale(plan, maxMp);
      const bleedUpscale = g.planUpscale(bleedPlan, maxMp);
      // Resolution the print ends up with (AI upscale adds up to 4× the pre-upscale size)
      const finalDpi = upscale
        ? Math.min(g.PRINT_DPI, Math.round(Math.min(upscale.upscaled.width / (plan.size.widthMm / 25.4), upscale.upscaled.height / (plan.size.heightMm / 25.4))))
        : Math.min(g.PRINT_DPI, plan.effectiveDpi);
      const needsMaster = img.kind === 'custom' && !img.printMasterPublicId && plan.effectiveDpi < g.PRINT_MASTER_BELOW_DPI;
      return {
        printUrl: cloudinaryService.getCroppedPrintUrl(sourceId, plan, upscale),
        selfPrintUrl: cloudinaryService.getCroppedPrintUrl(sourceId, bleedPlan, bleedUpscale),
        meta: {
          version: 2,
          source: img.printMasterPublicId ? 'print_master' : img.kind === 'custom' ? 'preview' : 'catalogue',
          source_px: [source.width, source.height],
          print_mm: [plan.size.widthMm, plan.size.heightMm],
          orientation: plan.size.orientation,
          output_px: [plan.outputPx.width, plan.outputPx.height],
          bleed_mm: g.SELF_PRINT_BLEED_MM,
          crop: plan.crop,
          effective_dpi: plan.effectiveDpi,
          ai_upscaled: !!upscale,
          final_dpi: finalDpi,
          quality: finalDpi >= g.DPI_OK ? 'good' : finalDpi >= g.DPI_MIN ? 'ok' : 'low',
          mismatch: plan.mismatch,
          print_master: needsMaster ? 'pending' : img.printMasterPublicId ? 'ready' : undefined,
        },
      };
    }
  }
  // Fallback: the whole image, uncropped (the printer/Gelato fits it)
  const printUrl = await getPrintUrl(img, orderId);
  return { printUrl, selfPrintUrl: null, meta: { version: 1, uncropped: true, reason: !widthCm || !heightCm ? 'product has no size' : 'source dimensions unavailable' } };
}

/** Customer download: full quality, small brand mark, signed 7-day URL. */
export async function getCustomerDownloadUrl(img: ResolvedOrderImage, customerRef: string, orderRef: string): Promise<string> {
  if (!img.cloudinaryPublicId) throw new Error(`No download source for ${img.kind} image ${img.id}`);
  const { cloudinaryService } = await import('@/lib/cloudinary');
  return cloudinaryService.getDownloadUrl(img.cloudinaryPublicId, customerRef, orderRef);
}
