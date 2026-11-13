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
 * Use frameLayers() on a picture ALREADY cropped to the shape (frameCrop()). Phase B (print files
 * per size, the customer's pet name) calls it with a shape and frameTitle(base, petName).
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
      '2:3': { aspect: 2 / 3, medallion: { x: 0.4997, y: 0.0744, r: 0.0704 }, plate: { x0: 0.2647, x1: 0.7360, y0: 0.9096, y1: 0.9544 } },
      '3:4': { aspect: 3 / 4, medallion: { x: 0.4997, y: 0.0838, r: 0.0704 }, plate: { x0: 0.2647, x1: 0.7360, y0: 0.8983, y1: 0.9487 } },
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
  engrave: 0.02,                                                 // highlight offset down × plate height
  fit: 0.88,                                                     // text may use this share of the plate width
  symbolWidth: 1.45,                                             // zodiac symbol width × radius
  numeralWidth: 1.5, numeralSize: 1.1,                           // numeral box width and nominal size × radius (cap height 0.78 r, under the 0.9 r limit)
  // Where the letters sit in a Cloudinary text layer, as a share of the font size below the
  // layer's centre (Playfair: ascent 1.082, descent 0.251, cap height 0.708, x height 0.514).
  // Estimates: tune against a real preview if the words look high or low on the plate.
  capsDrop: 0.06, mixedDrop: 0.11,
};

/** Text is drawn this many pixels wide per 1.0 of the picture's width, then scaled down: crisp up to a ~3,500 px print file */
export const RENDER_PX = 7000;

/** A relative Cloudinary number: 4 places; whole numbers keep ".0" (a bare 1 would mean one pixel) */
export function rel(v: number): string {
  const n = Math.round(v * 10000) / 10000;
  if (n === 0) return '0';
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

/** Cloudinary refers to a font or image in a layer by its public id with "/" as ":" */
export const layerId = (publicId: string) => publicId.replace(/\//g, ':');

/** The print shape nearest a picture's aspect (width ÷ height); anything unusable counts as 2:3 */
export function frameShapeFor(aspect: number): FrameShape {
  if (!(aspect > 0)) return '2:3';
  return Math.abs(aspect - 2 / 3) <= Math.abs(aspect - 3 / 4) ? '2:3' : '3:4';
}

/** Cloudinary crop to a shape (centred): put it before frameLayers() unless the picture is already that shape */
export const frameCrop = (shape: FrameShape) => `c_fill,ar_${shape},g_center`;

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

/** Estimated width of a line as a share of the picture's width, letter spacing included */
export function estimateWidth(text: string, size: number, spacing = 0): number {
  return Array.from(text).reduce((w, ch) => w + (charWidth(ch) + spacing) * size, 0);
}

/** The size to use: the wanted size, or smaller so the line's estimated width fits `maxWidth` */
export function fitSize(text: string, size: number, maxWidth: number, spacing = 0): number {
  const w = estimateWidth(text, size, spacing);
  return w > maxWidth ? size * (maxWidth / w) : size;
}

export interface FrameLine { text: string; size: number; x: number; y: number; maxWidth: number }
export interface FrameLayout {
  shape: FrameShape;
  title: FrameLine;
  tagline: FrameLine | null;
  medallion: { x: number; y: number; r: number; symbolWidth: number; numeral: FrameLine | null };
  engrave: number;                                               // highlight offset, share of height
}

/**
 * Where everything goes, as shares of the picture: x and sizes of its width, y of its height.
 * Title and tagline are centred on the plate together (the title alone when there is no tagline).
 * `y` of a line is where its letters are centred (the text layer is nudged for its own padding).
 */
export function frameLayout(card: FrameCard, shape: FrameShape, style: FrameStyleId = DEFAULT_FRAME_STYLE): FrameLayout {
  const g = FRAME_STYLES[style].geometry[shape];
  const L = FRAME_LAYOUT;
  const plateHW = (g.plate.y1 - g.plate.y0) / g.aspect;          // plate height in width units
  const maxWidth = (g.plate.x1 - g.plate.x0) * L.fit;
  const x = (g.plate.x0 + g.plate.x1) / 2;
  const cyW = ((g.plate.y0 + g.plate.y1) / 2) / g.aspect;        // plate centre, width units
  const title = frameCaps(card.title);
  const tagline = (card.tagline ?? '').trim();
  const titleSize = fitSize(title, (tagline ? L.title : L.titleSolo) * plateHW, maxWidth, L.spacing);
  let titleY = cyW, tagY = 0, tagSize = 0;
  if (tagline) {
    tagSize = fitSize(tagline, L.tagline * plateHW, maxWidth);
    const block = L.title * plateHW + L.gap * plateHW + L.tagline * plateHW;   // laid out at the nominal sizes so a shrunk line doesn't move the other
    const top = cyW - block / 2;
    titleY = top + (L.title * plateHW) / 2;
    tagY = top + (L.title + L.gap) * plateHW + (L.tagline * plateHW) / 2;
  }
  const toH = (yW: number, size: number, drop: number) => (yW - drop * size) * g.aspect;
  const m = g.medallion;
  const numeral = card.medallion && 'numeral' in card.medallion && card.medallion.numeral.trim() ? card.medallion.numeral.trim() : null;
  const numMax = L.numeralWidth * m.r;
  const numSize = numeral ? fitSize(numeral, L.numeralSize * m.r, numMax) : 0;
  return {
    shape,
    title: { text: title, size: titleSize, x, y: toH(titleY, titleSize, L.capsDrop), maxWidth },
    tagline: tagline ? { text: tagline, size: tagSize, x, y: toH(tagY, tagSize, L.mixedDrop), maxWidth } : null,
    medallion: {
      x: m.x, y: m.y, r: m.r, symbolWidth: L.symbolWidth * m.r,
      numeral: numeral ? { text: numeral, size: numSize, x: m.x, y: toH(m.y / g.aspect, numSize, L.capsDrop), maxWidth: numMax } : null,
    },
    engrave: L.engrave * (g.plate.y1 - g.plate.y0),
  };
}

const frameCaps = (t: string) => String(t ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

/**
 * One line of words as layers. The text is set big (RENDER_PX per picture width), shrunk by
 * c_limit if it is wider than its box, padded to a fixed box so its centre is the box's centre,
 * then the box is scaled to `maxWidth` of the picture's width. Every number is a share of the
 * picture, so the same string suits a 600 px thumbnail and a 3,500 px print file.
 */
export function textLayer(line: FrameLine, font: string, colour: string, opts: { spacing?: number; dy?: number } = {}): string {
  const px = Math.max(8, Math.round(line.size * RENDER_PX));
  const boxW = Math.max(40, Math.round(line.maxWidth * RENDER_PX));
  const boxH = Math.round(px * 1.7);
  const ls = opts.spacing ? `_letter_spacing_${Math.round(px * opts.spacing)}` : '';
  return [
    `l_text:${layerId(font)}_${px}${ls}:${escapeWords(line.text)},co_rgb:${colour}`,
    `c_limit,w_${boxW},h_${boxH}`,
    `c_mpad,w_${boxW},h_${boxH}`,
    `c_scale,w_${rel(line.maxWidth)},fl_relative`,
    `fl_layer_apply,g_center,x_${rel(line.x - 0.5)},y_${rel(line.y + (opts.dy ?? 0) - 0.5)},fl_relative`,
  ].join('/');
}

/**
 * Raw Cloudinary transformation drawing the frame, medallion content, title and tagline on a
 * picture already cropped to `shape`, in this order: the frame image (stretched to cover the
 * whole picture), the medallion content, then each line twice (highlight colour a hair lower,
 * then ink) for an engraved look.
 */
export function frameLayers(card: FrameCard, shape: FrameShape, style: FrameStyleId = DEFAULT_FRAME_STYLE): string {
  const S = FRAME_STYLES[style];
  const lay = frameLayout(card, shape, style);
  const layers = [`l_${layerId(S.frames[shape])}/c_scale,w_1.0,h_1.0,fl_relative/fl_layer_apply`];
  const med = card.medallion;
  if (med && 'symbol' in med && /^[a-z-]+$/.test(med.symbol)) {
    layers.push(`l_${layerId(symbolPublicId(med.symbol))}/e_colorize:100,co_rgb:${S.medallionInk}/c_scale,w_${rel(lay.medallion.symbolWidth)},fl_relative/fl_layer_apply,g_center,x_${rel(lay.medallion.x - 0.5)},y_${rel(lay.medallion.y - 0.5)},fl_relative`);
  } else if (lay.medallion.numeral) {
    layers.push(textLayer(lay.medallion.numeral, S.titleFont, S.medallionInk));
  }
  if (lay.title.text) {
    layers.push(textLayer(lay.title, S.titleFont, S.highlight, { spacing: FRAME_LAYOUT.spacing, dy: lay.engrave }));
    layers.push(textLayer(lay.title, S.titleFont, S.ink, { spacing: FRAME_LAYOUT.spacing }));
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
