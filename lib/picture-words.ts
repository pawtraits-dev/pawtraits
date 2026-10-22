/**
 * Words on the picture (client-safe): designs with a sentence on them, e.g.
 *   "Please be seated, {pet} will see you shortly"
 * where {pet} becomes "the Cocker Spaniel" (the design's or customer's breed), the customer's pet's
 * name ("Biscuit"), or "the dog" / "the cat" when no breed is known. {Pet} is the same with a
 * capital first letter (for the start of a sentence).
 *
 * The words are drawn by Cloudinary as a text layer over a text-free copy of the design, so they
 * are always spelled right and change instantly. Settings live in image_catalog.text_overlay
 * (2026-10-23 migration); server helpers are in lib/picture-words-server.ts.
 */

export interface WordsBox { x: number; y: number; w: number; h: number }   // fractions of the picture

export interface PictureWords {
  template: string;
  font: string;              // a Google Font name (Cloudinary loads it by name)
  size: number;              // letter size in px, in a 1000 px wide box
  colour: string;            // hex, no #
  align: 'center' | 'left' | 'right';
  lineSpacing: number;       // px, can be negative
  box: WordsBox;
  aspect: number | null;     // width ÷ height of the clean copy
  clean_public_id: string | null;
  original_public_id: string | null;   // the picture as first uploaded (words painted in)
  applied: { text: string; at: string } | null;
}

export const DEFAULT_TEMPLATE = 'Please be seated, {pet} will see you shortly';
export const DEFAULT_WORDS: Omit<PictureWords, 'clean_public_id' | 'original_public_id' | 'applied' | 'aspect'> = {
  template: DEFAULT_TEMPLATE,
  font: 'Gloria Hallelujah',
  size: 110,
  colour: '2b1d14',
  align: 'center',
  lineSpacing: -10,
  box: { x: 0.03, y: 0.03, w: 0.74, h: 0.2 },
};

/** Handwriting fonts to try (all Google Fonts) */
export const WORD_FONTS = [
  'Gloria Hallelujah', 'Gochi Hand', 'Schoolbell', 'Delius', 'Patrick Hand', 'Indie Flower',
  'Kalam', 'Caveat', 'Short Stack', 'Coming Soon', 'Shadows Into Light Two', 'Itim', 'Life Savers',
];

const num = (v: any, d: number, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

/** image_catalog.text_overlay → settings (defaults filled in), or null when the design has none */
export function readWords(v: any): PictureWords | null {
  if (!v || typeof v !== 'object' || typeof v.template !== 'string' || !v.template.trim()) return null;
  const b = v.box ?? {};
  return {
    template: v.template.slice(0, 200),
    font: typeof v.font === 'string' && /^[A-Za-z0-9 ]{2,40}$/.test(v.font) ? v.font : DEFAULT_WORDS.font,
    size: Math.round(num(v.size, DEFAULT_WORDS.size, 30, 300)),
    colour: typeof v.colour === 'string' && /^#?[0-9a-f]{6}$/i.test(v.colour) ? v.colour.replace('#', '').toLowerCase() : DEFAULT_WORDS.colour,
    align: v.align === 'left' || v.align === 'right' ? v.align : 'center',
    lineSpacing: Math.round(num(v.lineSpacing, DEFAULT_WORDS.lineSpacing, -60, 60)),
    box: {
      x: num(b.x, DEFAULT_WORDS.box.x, 0, 0.95), y: num(b.y, DEFAULT_WORDS.box.y, 0, 0.95),
      w: num(b.w, DEFAULT_WORDS.box.w, 0.05, 1), h: num(b.h, DEFAULT_WORDS.box.h, 0.03, 1),
    },
    aspect: Number(v.aspect) > 0 ? Number(v.aspect) : null,
    clean_public_id: typeof v.clean_public_id === 'string' && v.clean_public_id ? v.clean_public_id : null,
    original_public_id: typeof v.original_public_id === 'string' && v.original_public_id ? v.original_public_id : null,
    applied: v.applied && typeof v.applied.text === 'string' ? v.applied : null,
  };
}

const RUDE = ['FUCK', 'SHIT', 'CUNT', 'TWAT', 'WANK', 'NAZI', 'SLUT', 'WHORE', 'BITCH', 'NIGG', 'FAGG', 'PAEDO', 'PEDO', 'BOLLOCK', 'BELLEND', 'HITLER'];
export const PET_NAME_MAX = 16;

/** A pet's name for the picture: letters, spaces, hyphens, apostrophes; capitalised; ≤16 */
export function cleanPetName(raw: unknown): string | null {
  const s = String(raw ?? '').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  if (!s || s.length > PET_NAME_MAX || !/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '\-.]*$/.test(s)) return null;
  if (RUDE.some(w => s.toUpperCase().replace(/[^A-Z]/g, '').includes(w))) return null;
  return s.replace(/(^|[\s'-])([a-zà-ÿ])/g, (_m, a, b) => a + b.toUpperCase());
}

/** What {pet} becomes: the name as is; a breed with "the" (short name when there is one) */
export function petPhrase(p: { name?: string | null; breed?: string | null; shortName?: string | null; animal?: 'dog' | 'cat' | null }): string {
  if (p.name) return p.name;
  const breed = (p.shortName || p.breed || '').trim();
  if (breed && !/^(mixed|domestic|unknown)/i.test(breed)) return `the ${breed}`;
  return `the ${p.animal === 'cat' ? 'cat' : 'dog'}`;
}

/** The template with {pet} / {Pet} filled in */
export function fillWords(template: string, phrase: string): string {
  const cap = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  return template.replace(/\{Pet\}/g, cap).replace(/\{pet\}/g, phrase);
}

/** Cloudinary text needs commas and slashes double-escaped */
export const escapeWords = (t: string) => encodeURIComponent(t).replace(/%2C/g, '%252C').replace(/%2F/g, '%252F').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');

/** Stands in for the words in a URL template (the page swaps in escapeWords(text)) */
export const WORDS_TOKEN = '__PAWWORDS__';

const BOX_W = 1000;
const rel = (v: number) => (v === 0 ? '0' : String(Math.round(v * 10000) / 10000));

/**
 * Raw Cloudinary transformation drawing the words in their box. The text is set at `size` px in
 * a 1000 px wide column (wrapping by itself; line breaks in the template force new lines), shrunk
 * if it's too tall for the box, padded to the box's shape so the letter size stays the same
 * whatever the words, then scaled to the box's width and placed at its top-left corner.
 * Pass `text` already filled in, or WORDS_TOKEN for a URL template.
 */
export function wordsLayer(w: PictureWords, text: string): string {
  const aspect = w.aspect || 2 / 3;
  const boxH = Math.max(40, Math.round(BOX_W * w.box.h / (w.box.w * aspect)));
  const font = w.font.replace(/\s+/g, '%20');
  const body = text === WORDS_TOKEN ? WORDS_TOKEN : escapeWords(text);
  return [
    `l_text:${font}_${w.size}_${w.align}_line_spacing_${w.lineSpacing}:${body},co_rgb:${w.colour},c_fit,w_${BOX_W}`,
    `c_limit,w_${BOX_W},h_${boxH}`,
    `c_mpad,w_${BOX_W},h_${boxH}`,
    `c_scale,w_${rel(w.box.w)},fl_relative`,
    `fl_layer_apply,g_north_west,x_${rel(w.box.x)},y_${rel(w.box.y)}`,
  ].join('/');
}
