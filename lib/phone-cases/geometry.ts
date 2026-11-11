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

// ---------------------------------------------------------------------------------------------
// Case art layout. One canvas per design per layout group, in PAINTING-WIDTH units (the 2:3
// painting is 1 wide and 1.5 tall). Every model in the group is cut from the same canvas: the
// model's case is scaled so its width equals the painting's, standing on the painting's bottom
// edge, plus the wrap margin all round. The canvas is shaped 9:16 for Gemini.
// ---------------------------------------------------------------------------------------------

export const CASE_ART_RATIO = '9:16';
const CANVAS_W_OVER_H = 9 / 16;

export interface Box { x: number; y: number; w: number; h: number }
export interface CaseArtLayout { cw: number; ch: number; slot: Box }

type Sized = Pick<PhoneModel, 'case_w_mm' | 'case_h_mm'>;

export function caseArtLayout(models: Sized[]): CaseArtLayout {
  const wrap = Math.max(...models.map(m => WRAP_MARGIN_MM / Number(m.case_w_mm)));
  const above = Math.max(0, ...models.map(m => Number(m.case_h_mm) / Number(m.case_w_mm) - 1 / PAINTING_RATIO));
  const w0 = 1 + 2 * wrap, h0 = above + 1 / PAINTING_RATIO + 2 * wrap;
  const [cw, ch] = w0 / h0 < CANVAS_W_OVER_H ? [h0 * CANVAS_W_OVER_H, h0] : [w0, w0 / CANVAS_W_OVER_H];
  return { cw, ch, slot: { x: (cw - 1) / 2, y: ch - wrap - 1 / PAINTING_RATIO, w: 1, h: 1 / PAINTING_RATIO } };
}

/** A model's case on the canvas (painting-width units): the case itself, and with its wrap margin */
export function modelOnCanvas(layout: CaseArtLayout, m: Sized): { case: Box; print: Box; scale: number } {
  const W = Number(m.case_w_mm), H = Number(m.case_h_mm);
  const s = layout.slot.w / W;                       // units per mm
  const bottom = layout.slot.y + layout.slot.h;
  const c = { x: layout.slot.x, y: bottom - H * s, w: W * s, h: H * s };
  const k = WRAP_MARGIN_MM * s;
  return { case: c, print: { x: c.x - k, y: c.y - k, w: c.w + 2 * k, h: c.h + 2 * k }, scale: s };
}

/** The camera cut-out boxes for a model, on the canvas */
export function cameraOnCanvas(layout: CaseArtLayout, m: Sized, camera: CameraBox[]): Array<CameraBox> {
  const { case: c, scale } = modelOnCanvas(layout, m);
  return camera.map(b => ({ x: c.x + b.x * scale, y: c.y + b.y * scale, w: b.w * scale, h: b.h * scale, r: b.r * scale }));
}

/** Stored per design: image_catalog.case_art[groupId] */
export interface CaseArtEntry {
  public_id: string;
  width: number; height: number;         // px
  layout: CaseArtLayout;                 // painting-width units
  status: 'pending' | 'approved' | 'rejected';
  match: number | null;                  // 0–1: how closely Gemini kept the painting in place (1 = identical)
  created_at: string;
  approved_at?: string | null;
}
