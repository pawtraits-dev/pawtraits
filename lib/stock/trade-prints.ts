/**
 * Trade print orders (server only): foamex stall stock ordered by hand from the UK trade printer.
 * Gelato handles everything online; this is only stall stock (see the 2026-10-22 migration).
 *
 *   stallSales()   what sold at the stalls in a period (stall_print_<size> order lines), to replace
 *   linePrint()    the print-ready file for a line: the design centre-cropped to the size, exact
 *                  finished size at 300 dpi, no bleed or crop marks (the printer's spec), sRGB JPG
 *                  (AI-upscaled by Cloudinary when the design is too small for the size)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudinaryService } from '@/lib/cloudinary';
import { planPrint, planUpscale, PRINT_DPI, DPI_MIN, DPI_OK } from '@/lib/print/print-geometry';

export type TradeSize = 'S' | 'M' | 'L' | 'XL';
/** Foamex sizes (cm, short × long side); turned to match each design's orientation */
export const TRADE_SIZES: Record<TradeSize, { w: number; h: number; label: string }> = {
  S: { w: 15, h: 20, label: 'Small 15×20 cm' },
  M: { w: 20, h: 30, label: 'Medium 20×30 cm' },
  L: { w: 30, h: 40, label: 'Large 30×40 cm' },
  XL: { w: 40, h: 60, label: 'Extra large 40×60 cm' },
};
export const isTradeSize = (s: unknown): s is TradeSize => typeof s === 'string' && s in TRADE_SIZES;

const PAID_EXCLUDED = new Set(['cancelled', 'canceled', 'refunded']);
const chunks = <T,>(list: T[], n = 200) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

/** Units of each design × size sold at the stalls between two dates (inclusive), optionally by stall */
export async function stallSales(supabase: SupabaseClient, from: string, to: string, locationIds?: string[] | null): Promise<{ image_id: string; size: TradeSize; sold: number }[]> {
  const end = new Date(`${to}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
  let q = supabase.from('orders').select('id, status, payment_status').gte('created_at', `${from}T00:00:00Z`).lt('created_at', end.toISOString()).eq('payment_status', 'paid').limit(5000);
  if (locationIds?.length) q = q.in('pos_location_id', locationIds);
  const { data: orders, error } = await q;
  if (error) throw new Error(error.message);
  const ids = (orders ?? []).filter(o => !PAID_EXCLUDED.has(String(o.status || '').toLowerCase())).map(o => o.id);

  const tally = new Map<string, { image_id: string; size: TradeSize; sold: number }>();
  for (const part of chunks(ids)) {
    const { data: lines } = await supabase.from('order_items').select('image_id, product_id, quantity').in('order_id', part).like('product_id', 'stall_print_%');
    for (const l of lines ?? []) {
      const size = String(l.product_id).replace('stall_print_', '').toUpperCase();
      if (!isTradeSize(size)) continue;
      const key = `${l.image_id}|${size}`;
      const t = tally.get(key) ?? { image_id: l.image_id, size, sold: 0 };
      t.sold += l.quantity ?? 1;
      tally.set(key, t);
    }
  }
  return Array.from(tally.values()).sort((a, b) => b.sold - a.sold);
}

/** Title and thumbnail of each design */
export async function designInfo(supabase: SupabaseClient, ids: string[]): Promise<Map<string, { title: string; thumb: string | null; publicId: string | null }>> {
  const out = new Map<string, { title: string; thumb: string | null; publicId: string | null }>();
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  for (const part of chunks(Array.from(new Set(ids)))) {
    const { data } = await supabase.from('image_catalog').select('id, description, cloudinary_public_id, public_url').in('id', part);
    for (const d of data ?? []) {
      out.set(d.id, {
        title: (d.description || '').match(/\*\*(.+?)\*\*/)?.[1]?.trim() || 'Untitled design',
        thumb: d.cloudinary_public_id && cloud ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_120,h_160,g_auto/f_auto,q_auto/${d.cloudinary_public_id}` : d.public_url,
        publicId: d.cloudinary_public_id,
      });
    }
  }
  return out;
}

/** Pixel size of a design (cached on the line once read from Cloudinary) */
export async function sourcePx(supabase: SupabaseClient, line: { id: string; source_px: number[] | null }, publicId: string | null): Promise<{ width: number; height: number } | null> {
  if (line.source_px?.length === 2) return { width: line.source_px[0], height: line.source_px[1] };
  if (!publicId) return null;
  const dims = await cloudinaryService.getSourceDimensions(publicId);
  if (dims) await supabase.from('trade_print_order_lines').update({ source_px: [dims.width, dims.height] }).eq('id', line.id);
  return dims;
}

export interface LinePrint {
  widthMm: number; heightMm: number;
  px: { width: number; height: number };
  effectiveDpi: number;       // from the design as it is
  finalDpi: number;           // after AI upscaling, if used
  upscaled: boolean;
  quality: 'good' | 'ok' | 'low';
  cropNote: string | null;
  url: string;                // print-ready JPG
}

/** The print-ready file for a design at a size */
export function linePrint(publicId: string, source: { width: number; height: number }, size: TradeSize): LinePrint {
  const s = TRADE_SIZES[size];
  const plan = planPrint(source, s.w, s.h);   // no bleed: the printer doesn't want any
  const maxMp = Number(process.env.CLOUDINARY_MAX_TRANSFORM_MP) || 25;
  const upscale = planUpscale(plan, maxMp);
  const finalDpi = upscale
    ? Math.min(PRINT_DPI, Math.round(Math.min(upscale.upscaled.width / (plan.size.widthMm / 25.4), upscale.upscaled.height / (plan.size.heightMm / 25.4))))
    : Math.min(PRINT_DPI, plan.effectiveDpi);
  return {
    widthMm: plan.size.widthMm, heightMm: plan.size.heightMm,
    px: plan.outputPx,
    effectiveDpi: plan.effectiveDpi,
    finalDpi,
    upscaled: !!upscale,
    quality: finalDpi >= DPI_OK ? 'good' : finalDpi >= DPI_MIN ? 'ok' : 'low',
    cropNote: plan.mismatch ?? (plan.crop.kept < 0.97 ? (plan.crop.trims === 'top_bottom' ? 'Trimmed a little top and bottom' : 'Trimmed a little at the sides') : null),
    url: cloudinaryService.getTradePrintUrl(publicId, plan, upscale),
  };
}

/** TP-20261022-1, -2 … */
export async function nextRef(supabase: SupabaseClient): Promise<string> {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { count } = await supabase.from('trade_print_orders').select('id', { count: 'exact', head: true }).like('ref', `TP-${day}-%`);
  return `TP-${day}-${(count ?? 0) + 1}`;
}

/** "03_robin-hound_M_20x30cm_x4" (without extension) */
export function fileStem(n: number, title: string, size: TradeSize, p: { widthMm: number; heightMm: number }, qty: number): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'design';
  return `${String(n).padStart(2, '0')}_${slug}_${size}_${p.widthMm / 10}x${p.heightMm / 10}cm_x${qty}`;
}
