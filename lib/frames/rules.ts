/**
 * The framed-card selling rule, in one place (client-safe): a framed design (catalogue design
 * with a frame on, or a customer's portrait made from one) is sold as prints only. No digital
 * download, mug or phone case, because those would carry the frame at the wrong shape or not at all.
 */
import { readFrameOverlay } from './frame';

export const FRAMED_PRINTS_ONLY = 'Framed cards are sold as prints only. Digital downloads, mugs and phone cases are not available for them.';

/** A catalogue row (frame_overlay) or a customer image row (generation_metadata) that shows a frame */
export function isFramed(image: { frame_overlay?: unknown; generation_metadata?: any } | null | undefined): boolean {
  if (!image) return false;
  if (readFrameOverlay(image.frame_overlay)?.applied) return true;
  const f = image.generation_metadata?.frame;
  return !!(f && typeof f.title === 'string' && f.title);
}

/** May this product be bought for a framed design? Prints (including the stall's) only. */
export function framedProductAllowed(product: any): boolean {
  if (!product) return true;
  const t = product.product_type;
  if (t === 'digital_download') return false;   // 'hybrid' counts as a print everywhere else (lib/fulfillment/shared.ts), so it is allowed
  if (product.shape_family === 'any' || product.sku === 'DIGITAL' || product.fulfillment_method === 'download' || product.medium?.slug === 'digital') return false;
  const text = [product.media_name, product.medium?.name, product.name, product.sku].filter(Boolean).join(' ');
  return !/\bmugs?\b|phone\s*-?\s*cases?/i.test(text);
}
