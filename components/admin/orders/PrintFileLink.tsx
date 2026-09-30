'use client';

import { ExternalLink } from 'lucide-react';
import type { FulfilmentOrderItem } from '@/lib/product-types';

/**
 * Link to an order line's print file (the self-print version with bleed when we have it),
 * with its resolution, whether it was AI-upscaled, and the 4K master status for Large prints.
 */
export default function PrintFileLink({ item, compact = false }: { item: FulfilmentOrderItem; compact?: boolean }) {
  const url = item.self_print_file_url || item.print_image_url;
  if (!url) return <span className="text-xs text-red-600 whitespace-nowrap">No print file</span>;
  const meta = item.print_file_meta;
  const dpi = meta?.final_dpi ?? meta?.effective_dpi;
  const tone = meta?.quality === 'low' ? 'text-red-600' : meta?.quality === 'ok' ? 'text-amber-700' : 'text-gray-500';
  const title = [
    meta?.uncropped ? 'uncropped original' : meta?.print_mm ? `${meta.print_mm[0]}×${meta.print_mm[1]} mm${meta.bleed_mm && item.self_print_file_url ? ` +${meta.bleed_mm} mm bleed` : ''}` : null,
    meta?.source === 'print_master' ? 'from the 4K master' : meta?.source === 'preview' ? 'from the 2K preview' : null,
    meta?.effective_dpi ? `${meta.effective_dpi} dpi from the source${meta.ai_upscaled ? `, ${meta.final_dpi} dpi after AI upscale` : ''}` : null,
    meta?.crop && meta.crop.trims !== 'none' ? `${Math.round((1 - meta.crop.kept) * 100)}% trimmed ${meta.crop.trims === 'top_bottom' ? 'top/bottom' : 'at the sides'}` : null,
    meta?.mismatch,
  ].filter(Boolean).join(' · ');

  const status = meta?.uncropped
    ? { text: 'not cropped to size', cls: tone }
    : meta?.print_master === 'pending'
      ? { text: '4K master rendering…', cls: 'text-blue-700' }
      : meta?.print_master === 'failed'
        ? { text: '4K master failed — rebuild', cls: 'text-red-600' }
        : dpi
          ? { text: `${dpi} dpi${meta?.source === 'print_master' ? ' · 4K' : meta?.ai_upscaled ? ' · AI upscaled' : ''}${meta?.quality === 'low' ? ' — too low' : ''}`, cls: tone }
          : null;

  return (
    <span className="flex flex-col items-end">
      <a href={url} target="_blank" rel="noopener noreferrer" title={title || undefined}
        className="flex items-center gap-1 whitespace-nowrap text-xs text-purple-700 hover:underline">
        Print file<ExternalLink className="w-3 h-3" />
      </a>
      {!compact && status && <span className={`text-[11px] whitespace-nowrap ${status.cls}`}>{status.text}</span>}
      {!compact && meta?.mismatch && <span className="text-[11px] text-red-600 max-w-[12rem] text-right">{meta.mismatch}</span>}
    </span>
  );
}
