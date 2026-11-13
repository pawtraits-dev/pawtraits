/**
 * Framed cards (client-safe): a picture with an ornate frame laid over it, e.g. a zodiac card
 * (the sign's symbol in the round medallion at the top) or a tarot card (a Roman numeral there),
 * with the title on the banner plate at the bottom and a tagline under it.
 *
 * The frame art is the same for every card and is never painted by AI: it is a pre-made image
 * per print shape (2:3 for Medium, 3:4 for Small and Large) that Cloudinary stretches over the
 * whole picture, and the words are Cloudinary text layers drawn on top of it. A design keeps its
 * clean picture (image_catalog.frame_overlay) so AI variations never copy the frame. Server code
 * (uploading the frame files, baking, applying) is in lib/frames/server.ts.
 *
 * Every layout value is a whole number of pixels of a known base size (Cloudinary only keeps two
 * decimals of fl_relative values, which is too coarse). Crop the picture to the base with
 * frameCrop(), then add frameLayers(card, shape, base); the base is required. Per-customer
 * frames (the pet name in the title) call the same functions with frameTitle(base, petName).
 */
import { escapeWords } from '@/lib/picture-words';
import { symbolPublicId } from '@/lib/captions/caption';

export type FrameShape = '2:3' | '3:4';
export const FRAME_SHAPES: FrameShape[] = ['2:3', '3:4'];

/** What a frame shows: the medallion content, the title and the tagline (title and tagline may already hold a pet name) */
export interface FrameCard {
  title: string;
  tagline: string | null;
  medallion: { symbol: string } | { numeral: string } | null;   // symbol: zodiac slug
}

/** image_catalog.frame_overlay */
export interface FrameOverlay {
  style: FrameStyleId;
  clean_public_id: string;                                       // the picture without the frame
  applied: (FrameCard & { at: string }) | null;                  // what's drawn on now (null = none)
}

interface ShapeGeometry {
  aspect: number;                                                // width ÷ height
  medallion: { x: number; y: number; r: number };               // centre x of width, centre y of height, radius of width
  plate: { x0: number; x1: number; y0: number; y1: number };     // x of width, y of height
}

export interface FrameStyle {
  frames: Record<FrameShape, string>;                            // Cloudinary public ids of the frame images
  titleFont: string;                                             // Cloudinary public id of a custom font (raw, authenticated), extension included
  taglineFont: string;
  ink: string; highlight: string; medallionInk: string;          // hex colours
  geometry: Record<FrameShape, ShapeGeometry>;
}

export const FRAME_STYLES = {
  celestial: {
    frames: { '2:3': 'pawtraits/frames/celestial-2x3', '3:4': 'pawtraits/frames/celestial-3x4' },
    titleFont: 'pawtraits/frames/fonts/playfair-display-800.woff2',
    taglineFont: 'pawtraits/frames/fonts/playfair-display-700-italic.woff2',
    ink: '1E1708', highlight: 'ECDEAA', medallionInk: 'D9C48A',
    geometry: {
      '2:3': { aspect: 2 / 3, medallion: { x: 0.4997, y: 0.0744, r: 0.0704 }, plate: { x0: 0.2689, x1: 0.7402, y0: 0.9114, y1: 0.9561 } },
      '3:4': { aspect: 3 / 4, medallion: { x: 0.4997, y: 0.0838, r: 0.0704 }, plate: { x0: 0.2689, x1: 0.7402, y0: 0.9002, y1: 0.9506 } },
    },
  },
} satisfies Record<string, FrameStyle>;
export type FrameStyleId = keyof typeof FRAME_STYLES;
export const DEFAULT_FRAME_STYLE: FrameStyleId = 'celestial';

/** Every Cloudinary file a style needs (frame images are normal uploads; fonts are raw + authenticated) */
export const frameAssetIds = (style: FrameStyleId = DEFAULT_FRAME_STYLE) => {
  const s = FRAME_STYLES[style];
  return { images: [s.frames['2:3'], s.frames['3:4']], fonts: [s.titleFont, s.taglineFont] };
};

export const FRAME_MAX = { pet: 14 };

// --- Sizes, as shares of the plate height (title, tagline, gap) or of the medallion radius ----
export const FRAME_LAYOUT = {
  title: 0.36, titleSolo: 0.46, tagline: 0.24, gap: 0.09,        // × plate height
  spacing: 0.10,                                                 // title letter spacing × title size
  engrave: 0.02,                                                 // highlight offset down × plate height (at least 1 px)
  fit: 0.88,                                                     // text may use this share of the plate width
  symbolWidth: 1.45,                                             // zodiac symbol width × radius
  numeralWidth: 1.5, numeralSize: 1.1,                           // numeral box width and size × radius
  capHeight: 0.708,                                              // Playfair capital height × font size (both fonts)
  // Measured on real Cloudinary renders: the capitals' band sits this far below the text layer's
  // centre, as a share of the font size.
  titleDrop: 0.02, taglineDrop: 0.03, numeralDrop: 0.02,
};

/** A relative Cloudinary number is only exact to 2 places, so everything is emitted in whole pixels of a known base size */
export interface FrameBase { width: number; height: number }

/** Cloudinary refers to a font or image in a layer by its public id with "/" as ":" */
export const layerId = (publicId: string) => publicId.replace(/\//g, ':');

/** The print shape nearest a picture's aspect (width ÷ height); anything unusable counts as 2:3 */
export function frameShapeFor(aspect: number): FrameShape {
  if (!(aspect > 0)) return '2:3';
  return Math.abs(aspect - 2 / 3) <= Math.abs(aspect - 3 / 4) ? '2:3' : '3:4';
}

const SHAPE_PARTS: Record<FrameShape, [number, number]> = { '2:3': [2, 3], '3:4': [3, 4] };

/** The largest exactly-shaped base inside a picture of this size (k × the shape's parts) */
export function frameBase(shape: FrameShape, within: { width: number; height: number }): FrameBase {
  const [a, b] = SHAPE_PARTS[shape];
  const k = Math.max(1, Math.floor(Math.min(within.width / a, within.height / b)));
  return { width: a * k, height: b * k };
}

/** The base for a display size: this width, in the shape's proportions */
export function frameBaseForWidth(shape: FrameShape, width: number): FrameBase {
  const [a, b] = SHAPE_PARTS[shape];
  const w = Math.max(1, Math.round(width));
  return { width: w, height: Math.round((w * b) / a) };
}

/** Cloudinary crop (centred) to exactly the base: put it before frameLayers(), which needs this size */
export const frameCrop = (base: FrameBase) => `c_fill,w_${base.width},h_${base.height},g_center`;

/** "DAISY · TAURUS" with a pet name (trimmed, 14 characters at most), else "TAURUS" */
export function frameTitle(base: string, petName?: string | null): string {
  const pet = String(petName ?? '').replace(/\s+/g, ' ').trim().slice(0, FRAME_MAX.pet).trim();
  const b = String(base ?? '').replace(/\s+/g, ' ').trim();
  return (pet && b ? `${pet} · ${b}` : pet || b).toUpperCase();
}

// --- Fitting words to the plate -----------------------------------------------------------------

/** Rough advance width of a Playfair Display letter, in ems (the layer's c_limit is the safety net) */
export function charWidth(ch: string): number {
  if (ch === ' ') return 0.25;
  if (/[IJ1]/.test(ch)) return 0.45;
  if (/[MW]/.test(ch)) return 1.0;
  if (/[A-Z0]/.test(ch)) return 0.8;
  if (/[iljtf.,'’:;!|]/.test(ch)) return 0.34;
  if (/[mw]/.test(ch)) return 0.92;
  if (/[a-z]/.test(ch)) return 0.58;
  if (/[0-9]/.test(ch)) return 0.66;
  return 0.4;                                                    // "·", dashes, other punctuation, accents (close enough)
}

/** Estimated width of a line in the same unit as `size`, letter spacing (a share of the size, after every letter) included */
export function estimateWidth(text: string, size: number, spacing = 0): number {
  return Array.from(text).reduce((w, ch) => w + (charWidth(ch) + spacing) * size, 0);
}

/** The size to use: the wanted size, or smaller so the line's estimated width fits `maxWidth` (same unit) */
export function fitSize(text: string, size: number, maxWidth: number, spacing = 0): number {
  const w = estimateWidth(text, size, spacing);
  return w > maxWidth ? size * (maxWidth / w) : size;
}

/** One line of text, in whole pixels: font size, letter spacing, max width, and where its layer's centre goes (offset from the base centre) */
export interface FrameLine { text: string; size: number; spacing: number; maxWidth: number; dx: number; dy: number; font: 'title' | 'tagline' }
export interface FrameLayout {
  shape: FrameShape;
  base: FrameBase;
  title: FrameLine;
  tagline: FrameLine | null;
  medallion: { dx: number; dy: number; symbolWidth: number; numeral: FrameLine | null };
  engrave: number;                                               // highlight offset down, px
}

const frameCaps = (t: string) => String(t ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
const int = (v: number) => { const n = Math.round(v); return n === 0 ? 0 : n; };   // never -0

function checkBase(base: FrameBase): FrameBase {
  if (!base || !Number.isInteger(base.width) || !Number.isInteger(base.height) || base.width < 1 || base.height < 1) {
    throw new Error('frameLayers needs the base picture size in whole pixels (crop the picture to it first)');
  }
  return base;
}

/**
 * Where everything goes, in whole pixels of `base` (a picture already cropped to `shape` and exactly
 * that size). Offsets are from the base centre (g_center). The title and tagline INK (capital
 * bands) plus the gap are centred together on the plate; the title alone when there is no tagline.
 */
export function frameLayout(card: FrameCard, shape: FrameShape, base: FrameBase, style: FrameStyleId = DEFAULT_FRAME_STYLE): FrameLayout {
  checkBase(base);
  const g = FRAME_STYLES[style].geometry[shape];
  const L = FRAME_LAYOUT;
  const W = base.width, H = base.height;
  const plateH = (g.plate.y1 - g.plate.y0) * H;
  const maxWidth = int((g.plate.x1 - g.plate.x0) * W * L.fit);
  const cx = ((g.plate.x0 + g.plate.x1) / 2) * W, cy = ((g.plate.y0 + g.plate.y1) / 2) * H;
  const title = frameCaps(card.title);
  const tagline = (card.tagline ?? '').trim();
  const px = (v: number) => Math.max(1, Math.round(v));
  const titleNominal = (tagline ? L.title : L.titleSolo) * plateH;
  const titleSize = px(fitSize(title, titleNominal, maxWidth, L.spacing));
  const spacing = Math.round(L.spacing * titleSize);
  // Capital band centres: the whole block (title band, gap, tagline band) is centred on the plate
  let titleBand = cy, tagBand = 0, tagSize = 0;
  if (tagline) {
    const tagNominal = L.tagline * plateH;
    tagSize = px(fitSize(tagline, tagNominal, maxWidth));
    const block = L.capHeight * titleNominal + L.gap * plateH + L.capHeight * tagNominal;
    const top = cy - block / 2;
    titleBand = top + (L.capHeight * titleNominal) / 2;
    tagBand = top + L.capHeight * titleNominal + L.gap * plateH + (L.capHeight * tagNominal) / 2;
  }
  // Text layers are centred on their box, the capitals sit a little below it: move the layer up by the drop.
  // Letter spacing also follows the last letter, which pushes the word left by half a space: shift right.
  const titleLine: FrameLine = { text: title, size: titleSize, spacing, maxWidth, dx: int(cx - W / 2 + spacing / 2), dy: int(titleBand - L.titleDrop * titleSize - H / 2), font: 'title' };
  const m = g.medallion;
  const mx = m.x * W, my = m.y * H, r = m.r * W;
  const numeral = card.medallion && 'numeral' in card.medallion && card.medallion.numeral.trim() ? card.medallion.numeral.trim() : null;
  const numSize = numeral ? px(fitSize(numeral, L.numeralSize * r, L.numeralWidth * r)) : 0;
  return {
    shape, base,
    title: titleLine,
    tagline: tagline ? { text: tagline, size: tagSize, spacing: 0, maxWidth, dx: int(cx - W / 2), dy: int(tagBand - L.taglineDrop * tagSize - H / 2), font: 'tagline' } : null,
    medallion: {
      dx: int(mx - W / 2), dy: int(my - H / 2), symbolWidth: px(L.symbolWidth * r),
      numeral: numeral ? { text: numeral, size: numSize, spacing: 0, maxWidth: int(L.numeralWidth * r), dx: int(mx - W / 2), dy: int(my - L.numeralDrop * numSize - H / 2), font: 'title' } : null,
    },
    engrave: Math.max(1, Math.round(L.engrave * plateH)),
  };
}

/**
 * One line of text as a layer, drawn directly at its pixel size (no scaling: Cloudinary's relative
 * values are only exact to 2 places). c_limit is the safety net if the font is wider than expected.
 */
export function textLayer(line: FrameLine, fontId: string, colour: string, opts: { dy?: number } = {}): string {
  const ls = line.spacing > 0 ? `_letter_spacing_${line.spacing}` : '';
  return [
    `l_text:${layerId(fontId)}_${line.size}${ls}:${escapeWords(line.text)},co_rgb:${colour}`,
    `c_limit,w_${line.maxWidth}`,
    `fl_layer_apply,g_center,x_${line.dx},y_${line.dy + (opts.dy ?? 0)}`,
  ].join('/');
}

/**
 * Raw Cloudinary transformation drawing the frame, medallion content, title and tagline on a
 * picture already cropped to `shape` and exactly `base` pixels (see frameCrop / frameBase), in this
 * order: the frame image (stretched to cover the whole picture), the medallion content, then each
 * line twice (highlight colour a hair lower, then ink) for an engraved look. Every size and offset is
 * a whole number of pixels, so the same card at another size needs another call with that size.
 */
export function frameLayers(card: FrameCard, shape: FrameShape, base: FrameBase, style: FrameStyleId = DEFAULT_FRAME_STYLE): string {
  const S = FRAME_STYLES[style];
  const lay = frameLayout(card, shape, base, style);
  const layers = [`l_${layerId(S.frames[shape])}/c_scale,w_1.0,h_1.0,fl_relative/fl_layer_apply`];
  const med = card.medallion;
  if (med && 'symbol' in med && /^[a-z-]+$/.test(med.symbol)) {
    layers.push(`l_${layerId(symbolPublicId(med.symbol))}/e_colorize:100,co_rgb:${S.medallionInk}/c_scale,w_${lay.medallion.symbolWidth}/fl_layer_apply,g_center,x_${lay.medallion.dx},y_${lay.medallion.dy}`);
  } else if (lay.medallion.numeral) {
    layers.push(textLayer(lay.medallion.numeral, S.titleFont, S.medallionInk));
  }
  if (lay.title.text) {
    layers.push(textLayer(lay.title, S.titleFont, S.highlight, { dy: lay.engrave }));
    layers.push(textLayer(lay.title, S.titleFont, S.ink));
  }
  if (lay.tagline) {
    layers.push(textLayer(lay.tagline, S.taglineFont, S.highlight, { dy: lay.engrave }));
    layers.push(textLayer(lay.tagline, S.taglineFont, S.ink));
  }
  return layers.join('/');
}

/** image_catalog.frame_overlay → value, or null */
export function readFrameOverlay(v: any): FrameOverlay | null {
  if (!v || typeof v !== 'object' || typeof v.clean_public_id !== 'string' || !v.clean_public_id) return null;
  const a = v.applied;
  const m = a?.medallion;
  const medallion: FrameCard['medallion'] = m && typeof m.symbol === 'string' ? { symbol: m.symbol } : m && typeof m.numeral === 'string' ? { numeral: m.numeral } : null;
  return {
    style: (v.style in FRAME_STYLES ? v.style : DEFAULT_FRAME_STYLE) as FrameStyleId,
    clean_public_id: v.clean_public_id,
    applied: a && typeof a.title === 'string' ? { title: a.title, tagline: typeof a.tagline === 'string' && a.tagline ? a.tagline : null, medallion, at: String(a.at || '') } : null,
  };
}

/** The same card? (title, tagline and medallion; not the time) */
export function sameCard(a: FrameCard, b: FrameCard): boolean {
  return a.title === b.title && (a.tagline || null) === (b.tagline || null) && JSON.stringify(a.medallion ?? null) === JSON.stringify(b.medallion ?? null);
}
