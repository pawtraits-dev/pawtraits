/**
 * Browser helpers for admin image uploads (catalogue designs): read size, shrink for the
 * analysis call, and fit under the save endpoint's 4 MB limit at the best quality we can.
 */
import { nearestAllowedRatio } from '@/lib/print/print-geometry';

export const MAX_SAVE_BYTES = 3.9 * 1024 * 1024;

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image'));
    img.src = URL.createObjectURL(file);
  });
}

/** Re-encode as JPEG within maxDim, stepping quality then size down until under maxBytes */
export async function shrinkImage(file: File, maxDim: number, maxBytes: number): Promise<File> {
  const img = await loadImage(file);
  try {
    let dim = Math.min(maxDim, Math.max(img.naturalWidth, img.naturalHeight));
    let quality = 0.92;
    for (let attempt = 0; attempt < 8; attempt++) {
      const scale = dim / Math.max(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
      if (blob && blob.size <= maxBytes) {
        return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
      }
      if (quality > 0.8) quality -= 0.04; else dim = Math.round(dim * 0.85);
    }
    throw new Error('Could not make this image small enough to upload');
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

/** The file to save: the original when it fits, otherwise a high-quality re-encode */
export async function fileForSaving(file: File): Promise<File> {
  if (file.size <= MAX_SAVE_BYTES && /image\/(jpeg|png|webp)/.test(file.type)) return file;
  return shrinkImage(file, 4096, MAX_SAVE_BYTES);
}

/** Size, a preview URL and the matching format (by shape) for a picked image */
export async function inspectImage(file: File, formats: { id: string; aspect_ratio: string }[]) {
  const img = await loadImage(file);
  const width = img.naturalWidth, height = img.naturalHeight;
  const { ratio, offBy } = nearestAllowedRatio(width, height);
  const accepted = offBy <= 0.03 || (ratio === '2:1' && offBy <= 0.2);
  const format = accepted ? formats.find((f) => f.aspect_ratio === ratio) ?? null : null;
  const warning = !accepted
    ? `${width}×${height} isn't an allowed shape (nearest ${ratio}, ${Math.round(offBy * 100)}% off). Re-export it at ${ratio}.`
    : !format ? `No active ${ratio} format. Pick one.` : null;
  return { preview: img.src, width, height, formatId: format?.id ?? '', warning };
}
