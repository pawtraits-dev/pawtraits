/**
 * Phone-case geometry (client-safe). All sizes in mm from the case's top-left corner, as seen from
 * the back (camera top-left). Plan: claude/phone-cases-plan.md.
 *
 * A design's case art is the 2:3 painting in a fixed SLOT at the bottom of the case, with
 * generated background around it. The slot never moves once approved, so a customer's pet
 * (painted into the same 2:3 picture) always lands in exactly the same place.
 */

export interface CameraBox { x: number; y: number; w: number; h: number; r: number }
export interface PhoneLayoutGroup { id: string; label: string; camera: CameraBox[]; notes?: string | null }
export interface PhoneModel {
  id: string; brand: 'apple' | 'samsung'; name: string; layout_group: string; group_verified: boolean;
  gelato_uid: string; case_w_mm: number; case_h_mm: number; display_order: number; is_active: boolean;
  product_id: string | null;
}
/** The painting's place on the case, mm */
export interface Slot { x: number; y: number; w: number; h: number }

/** Design aspect: width / height of the painting (2:3 portrait) */
export const PAINTING_RATIO = 2 / 3;
/** Background kept beyond the case edge for the sublimation wrap until the pilot confirms the real bleed */
export const WRAP_MARGIN_MM = 4;

/** Lowest point of the camera cut-out (mm from the top) */
export function cameraBottom(camera: CameraBox[]): number {
  return Math.max(0, ...camera.map(b => b.y + b.h));
}

/** Default slot: painting at full case width, standing on the bottom edge */
export function defaultSlot(model: Pick<PhoneModel, 'case_w_mm' | 'case_h_mm'>): Slot {
  const w = Number(model.case_w_mm), H = Number(model.case_h_mm);
  const h = w / PAINTING_RATIO;
  return { x: 0, y: Math.max(0, H - h), w, h: Math.min(h, H) };
}

/** Slot shrunk (centred, still on the bottom edge) so its top clears the camera by `clearMm` */
export function clearedSlot(model: Pick<PhoneModel, 'case_w_mm' | 'case_h_mm'>, camera: CameraBox[], clearMm = 1): Slot {
  const W = Number(model.case_w_mm), H = Number(model.case_h_mm);
  const h = Math.min(W / PAINTING_RATIO, H - cameraBottom(camera) - clearMm);
  const w = h * PAINTING_RATIO;
  return { x: (W - w) / 2, y: H - h, w, h };
}

/** How far the camera reaches into the slot: depth (mm) and the share of the slot's width it covers */
export function cameraOverlap(slot: Slot, camera: CameraBox[]): { depthMm: number; widthShare: number } {
  let depth = 0, x0 = Infinity, x1 = -Infinity;
  for (const b of camera) {
    const d = b.y + b.h - slot.y;
    if (d <= 0) continue;
    const l = Math.max(b.x, slot.x), r = Math.min(b.x + b.w, slot.x + slot.w);
    if (r <= l) continue;
    depth = Math.max(depth, d); x0 = Math.min(x0, l); x1 = Math.max(x1, r);
  }
  return { depthMm: Math.round(depth * 10) / 10, widthShare: depth ? Math.round(((x1 - x0) / slot.w) * 100) / 100 : 0 };
}

/** Case art canvas for a group: big enough for every model in it, plus the wrap margin (mm) */
export function groupCanvas(models: Array<Pick<PhoneModel, 'case_w_mm' | 'case_h_mm'>>): { w: number; h: number } {
  return {
    w: Math.max(...models.map(m => Number(m.case_w_mm))) + 2 * WRAP_MARGIN_MM,
    h: Math.max(...models.map(m => Number(m.case_h_mm))) + 2 * WRAP_MARGIN_MM,
  };
}
