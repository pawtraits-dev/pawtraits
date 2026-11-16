/**
 * The framed-card selling rule, in one place (client-safe): a framed design (catalogue design
 * with a frame on, or a customer's portrait made from one) is sold as a print (which comes with
 * a bonus digital copy, the framed 2:3 picture) or as a digital download on its own (the same
 * framed 2:3 picture). Not as a mug or phone case, which would carry the frame at the wrong shape
 * or not at all.
 */
import { readFrameOverlay } from './frame';

export const FRAMED_PRINTS_ONLY = 'Framed cards are sold as prints, which come with a bonus digital copy, or as a digital download. They are not available as a mug or a phone case.';

/** A catalogue row (frame_overlay) or a customer image row (generation_metadata) that shows a frame */
export function isFramed(image: { frame_overlay?: unknown; generation_metadata?: any } | null | undefined): boolean {
  if (!image) return false;
  if (readFrameOverlay(image.frame_overlay)?.applied) return true;
  const f = image.generation_metadata?.frame;
  return !!(f && typeof f.title === 'string' && f.title);
}

/** May this product be bought for a framed design? Prints (including the stall's) and digital downloads; never mugs or phone cases. */
export function framedProductAllowed(product: any): boolean {
  if (!product) return true;
  const t = product.product_type;
  // Digital downloads are allowed (shape_family 'any' is only ever the digital product). 'hybrid' counts as a print everywhere else (lib/fulfillment/shared.ts)
  if (t === 'digital_download' || product.shape_family === 'any' || product.sku === 'DIGITAL' || product.fulfillment_method === 'download' || product.medium?.slug === 'digital') return true;
  const text = [product.media_name, product.medium?.name, product.name, product.sku].filter(Boolean).join(' ');
  return !/\bmugs?\b|phone\s*-?\s*cases?/i.test(text);
}
