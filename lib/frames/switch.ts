/**
 * Framed ↔ unframed for a customer's portrait (client-safe, pure). The clean painting is always
 * stored, and the frame is only layers, so the customer can have either look without a new AI
 * generation. The state lives in generation_metadata:
 *   framed    generation_metadata.frame     (isFramed() is true: prints only)
 *   unframed  generation_metadata.frame_off the same card kept aside so it can be switched back
 *             (isFramed() is false: an ordinary portrait)
 *   neither   a portrait of a design that has no frame, or one made "without frame" (the card comes from the design)
 * `base_cloudinary_id` is the painting without the frame: it is the displayed picture when unframed.
 */
import { DEFAULT_FRAME_STYLE, type FrameCard, type FrameStyleId } from './frame';

export type FrameChoice = 'on' | 'off';

export const FRAME_ORDERED = 'This picture has already been ordered, so its card can no longer be changed. Make a new picture to try the other look.';
export const FRAME_IN_BASKET = 'This picture is in your basket as a download, mug or phone case, which framed cards cannot be. Take that out of your basket first.';

/** 'on' when the portrait shows the frame, 'off' when it was framed and is switched off, else null */
export function frameState(meta: any): FrameChoice | null {
  if (meta?.frame && typeof meta.frame.title === 'string' && meta.frame.title) return 'on';
  if (meta?.frame_off && typeof meta.frame_off.title === 'string' && meta.frame_off.title) return 'off';
  return null;
}

/** The metadata with the frame set aside as frame_off (not framed any more), or null when it has no frame to set aside */
export function metaWithoutFrame(meta: any): Record<string, any> | null {
  if (frameState(meta) !== 'on') return null;
  const { frame, ...rest } = meta;
  return { ...rest, frame_off: { ...frame } };
}

export interface FrameOnInput {
  card: FrameCard;                 // title already holds the pet's name
  petName: string | null;
  animal?: 'dog' | 'cat' | null;
  baseId: string;                  // the painting without the frame
  baseUrl?: string | null;
  framedUrl: string;               // the stored framed copy (full size)
}

/** The metadata with the frame on: frame_off is removed, the clean painting is kept for print files */
export function metaWithFrame(meta: any, i: FrameOnInput): Record<string, any> {
  const { frame_off, frame: _old, ...rest } = meta ?? {};
  const style = (frame_off?.style || _old?.style || DEFAULT_FRAME_STYLE) as FrameStyleId;
  return {
    ...rest,
    clean_cloudinary_id: rest.clean_cloudinary_id ?? i.baseId,
    ...(rest.clean_url || i.baseUrl ? { clean_url: rest.clean_url ?? i.baseUrl } : {}),
    full_size_url: i.framedUrl,
    frame: { style, title: i.card.title, tagline: i.card.tagline, medallion: i.card.medallion, pet_name: i.petName, base_cloudinary_id: i.baseId, ...(i.animal ? { animal: i.animal } : {}) },
  };
}

/** The painting without the frame: the unframed picture (frame or frame_off remember where it is) */
export function unframedBaseId(meta: any, displayedId: string | null | undefined): string | null {
  return meta?.frame?.base_cloudinary_id || meta?.frame_off?.base_cloudinary_id || displayedId || null;
}

/**
 * Why this portrait can't be switched now, or null. Order lines keep what was bought, so a portrait
 * that has been ordered stays as it is; a basket with a download, mug or case blocks switching the
 * frame on (those can't be framed cards). Prints are fine either way.
 */
export function switchBlocked(to: FrameChoice, ctx: { ordered: boolean; basketProducts: any[] }, productAllowed: (p: any) => boolean): string | null {
  if (ctx.ordered) return FRAME_ORDERED;
  if (to === 'on' && ctx.basketProducts.some(p => !productAllowed(p))) return FRAME_IN_BASKET;
  return null;
}
